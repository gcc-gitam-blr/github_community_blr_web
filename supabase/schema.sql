-- Epoch + club backend. Run it in the Supabase SQL editor (or `npm run connect`). Safe to run again after updates.
-- Auth: enable the GitHub provider (Authentication → Providers) — attendees sign in with GitHub.
-- All coin movement happens inside SECURITY DEFINER functions, so a tampered client can't mint coins.
--
-- Economy (from the Epoch plan):
--   • starter coins (398 by default) credited once by the organiser desk at check-in
--   • recharge points pay out ONCE per attendee each
--   • spend booths charge per session (repeatable, with a short double-scan cooldown)

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text not null unique,
  name text not null,
  email text,
  coins int not null default 0 check (coins >= 0),
  earned int not null default 0,
  ticket boolean not null default false,
  role text not null default 'attendee' check (role in ('attendee','volunteer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists booths (
  id text primary key, name text not null,
  kind text not null check (kind in ('spend','recharge','free')),
  category text not null default 'Play',
  coins int not null default 0 check (coins >= 0),
  blurb text not null default '', optional boolean not null default false
);

create table if not exists rewards (
  id text primary key, name text not null, cost int not null check (cost > 0),
  stock int not null check (stock >= 0), blurb text not null default ''
);

create table if not exists txs (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles on delete cascade,
  delta int not null, reason text not null, ref text not null,
  at timestamptz not null default now()
);
create index if not exists txs_user on txs (user_id, at desc);
-- a recharge point pays once per attendee; the ticket credit happens once
create unique index if not exists txs_one_recharge_per_user on txs (user_id, ref) where ref like 'booth:recharge-%';
create unique index if not exists txs_one_ticket_per_user on txs (user_id) where ref = 'ticket';

alter table profiles enable row level security;
alter table booths enable row level security;
alter table rewards enable row level security;
alter table txs enable row level security;

-- 'none' (never null) for visitors without a profile: `null not in (...)` is not true in SQL, so a null role
-- would slip past the organiser checks below.
create or replace function my_role() returns text language sql security definer stable as
$$ select coalesce((select role from profiles where id = auth.uid()), 'none') $$;

drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles for select using (auth.uid() = id);
drop policy if exists "staff read profiles" on profiles;
create policy "staff read profiles" on profiles for select using (my_role() in ('volunteer','admin'));
drop policy if exists "read booths" on booths;
create policy "read booths" on booths for select using (true);
drop policy if exists "read rewards" on rewards;
create policy "read rewards" on rewards for select using (true);
drop policy if exists "read own txs" on txs;
create policy "read own txs" on txs for select using (auth.uid() = user_id);

-- public leaderboard: no emails, no balances
create or replace view leaderboard as select id, handle, name, earned from profiles where earned > 0;
grant select on leaderboard to anon, authenticated;

create or replace function register_profile(p_name text)
returns profiles language plpgsql security definer as $$
declare me profiles; u auth.users;
begin
  select * into me from profiles where id = auth.uid();
  if found then return me; end if;
  select * into u from auth.users where id = auth.uid();
  insert into profiles (id, handle, name, email)
  values (u.id, coalesce(u.raw_user_meta_data->>'user_name', split_part(u.email,'@',1)), p_name, u.email)
  returning * into me;
  return me;
end $$;

-- organiser desk: check the attendee in and credit their starter coins. Once per attendee.
create or replace function issue_ticket(p_user uuid, p_coins int default 398)
returns json language plpgsql security definer as $$
declare t profiles; amt int := p_coins;
begin
  if my_role() not in ('volunteer','admin') then return json_build_object('ok', false, 'error', 'Organiser access required.'); end if;
  select * into t from profiles where id = p_user for update;
  if not found then return json_build_object('ok', false, 'error', 'Unknown attendee QR.'); end if;
  if t.ticket then return json_build_object('ok', false, 'error', t.name || ' already has a verified ticket.'); end if;
  update profiles set ticket = true, coins = coins + amt where id = t.id;
  insert into txs (user_id, delta, reason, ref) values (t.id, amt, 'Check-in → ' || amt || ' EPC', 'ticket');
  return json_build_object('ok', true);
end $$;

create or replace function scan_booth(p_booth text)
returns json language plpgsql security definer as $$
declare b booths; me profiles; d int; last_at timestamptz;
begin
  select * into b from booths where id = p_booth;
  if not found or b.kind = 'free' then return json_build_object('ok', false, 'error', 'That QR code isn''t a coin booth.'); end if;
  select * into me from profiles where id = auth.uid() for update;
  if not found then return json_build_object('ok', false, 'error', 'Register first.'); end if;
  if not me.ticket then return json_build_object('ok', false, 'error', 'Your ticket hasn''t been verified yet — visit the registration desk.'); end if;

  if b.kind = 'recharge' then
    d := b.coins;
    begin
      insert into txs (user_id, delta, reason, ref) values (me.id, d, b.name, 'booth:' || b.id);
    exception when unique_violation then
      return json_build_object('ok', false, 'error', 'You''ve already used ' || b.name || '. One attempt per recharge point.');
    end;
    update profiles set coins = coins + d, earned = earned + d where id = me.id returning * into me;
  else
    select max(at) into last_at from txs where user_id = me.id and ref = 'booth:' || b.id;
    if last_at is not null and now() - last_at < interval '20 seconds' then
      return json_build_object('ok', false, 'error', 'Just scanned — wait a few seconds before paying again.');
    end if;
    if me.coins < b.coins then return json_build_object('ok', false, 'error', 'Not enough coins — try a recharge point!'); end if;
    d := -b.coins;
    insert into txs (user_id, delta, reason, ref) values (me.id, d, b.name, 'booth:' || b.id);
    update profiles set coins = coins + d where id = me.id returning * into me;
  end if;
  return json_build_object('ok', true, 'delta', d, 'balance', me.coins);
end $$;

create or replace function redeem_reward(p_reward text)
returns json language plpgsql security definer as $$
declare r rewards; me profiles;
begin
  select * into r from rewards where id = p_reward for update;
  if not found then return json_build_object('ok', false, 'error', 'Item not found.'); end if;
  if r.stock <= 0 then return json_build_object('ok', false, 'error', 'Sold out.'); end if;
  select * into me from profiles where id = auth.uid() for update;
  if not found or me.coins < r.cost then return json_build_object('ok', false, 'error', 'Not enough coins.'); end if;
  update rewards set stock = stock - 1 where id = r.id;
  update profiles set coins = coins - r.cost where id = me.id returning * into me;
  insert into txs (user_id, delta, reason, ref) values (me.id, -r.cost, 'Bought ' || r.name, 'reward:' || r.id);
  return json_build_object('ok', true, 'balance', me.coins);
end $$;

create or replace function award_coins(p_user uuid, p_delta int, p_reason text)
returns json language plpgsql security definer as $$
declare t profiles;
begin
  if my_role() not in ('volunteer','admin') then return json_build_object('ok', false, 'error', 'Organiser access required.'); end if;
  select * into t from profiles where id = p_user for update;
  if not found then return json_build_object('ok', false, 'error', 'Unknown attendee QR.'); end if;
  if t.coins + p_delta < 0 then return json_build_object('ok', false, 'error', 'Balance would go below zero.'); end if;
  update profiles set coins = coins + p_delta, earned = earned + greatest(p_delta, 0) where id = t.id;
  insert into txs (user_id, delta, reason, ref) values (t.id, p_delta, coalesce(nullif(p_reason,''), 'Organiser award'), 'admin');
  return json_build_object('ok', true);
end $$;

-- Belt and braces: visitors who aren't signed in can't even call the coin functions.
revoke execute on function issue_ticket(uuid, int), award_coins(uuid, int, text), scan_booth(text), redeem_reward(text), register_profile(text) from public, anon;
grant execute on function issue_ticket(uuid, int), award_coins(uuid, int, text), scan_booth(text), redeem_reward(text), register_profile(text) to authenticated;

-- Seed: recharge points and spend booths (mirrors lib/epoch/config.ts — costs other than VR=40 and recharge=20 are placeholders)
insert into booths (id, name, kind, category, coins, blurb, optional) values
 ('recharge-trivia','Tech Trivia Point','recharge','Compete',20,'Rapid-fire tech & GitHub trivia.',false),
 ('recharge-puzzle','Mini Code Puzzle Point','recharge','Compete',20,'A five-minute coding puzzle.',false),
 ('recharge-wheel','Fortune Wheel of Challenges','recharge','Compete',20,'Spin the wheel and take the challenge.',false),
 ('recharge-git','Git Speed Quiz Point','recharge','Compete',20,'Reach for the right Git command, fast.',false),
 ('recharge-debug','Debug Dash Point','recharge','Compete',20,'Spot the bug before the timer does.',false),
 ('vr','Virtual Reality Merge Zone','spend','Play',40,'Oculus stations: Merge Master, Code Quest, Commit Carnival.',false),
 ('octocat-splash','Octocat Splash','spend','Make',30,'Octocat-inspired hand painting.',false),
 ('origami','Origami Wonderland','spend','Make',20,'Tech-themed origami sessions.',false),
 ('3d-print','3D Printing Showcase','spend','Make',30,'Code to model, then print.',true),
 ('retro','Retro Gaming Nexus','spend','Play',40,'Arcade cabinets and retro consoles.',false),
 ('git-escape','Git Escape Challenge','spend','Compete',60,'A GitHub-themed escape room.',false),
 ('fortune','Fortune Teller Booth','spend','Explore',20,'Tech tarot and fortunes.',false),
 ('lottery','Commit Lottery','spend','Play',20,'Tickets for the two-day draw.',false),
 ('dart','Dart Commit','spend','Play',20,'Git-command dartboard.',false),
 ('jenga','Pull and Stack','spend','Play',30,'Giant Jenga with merge-conflict blocks.',false),
 ('blindfold','Blindfolded Obstacle Course','spend','Play',30,'Guided only by your teammates.',false),
 ('snake-ladder','Human-Size Snake & Ladder','spend','Play',30,'Quiz-driven life-size board.',false),
 ('musical-chairs','Reverse Musical Chairs','spend','Play',20,'Debug a chair to remove it.',true),
 ('coin-drop','Coin Drop Challenge','spend','Play',20,'Execute a commit-push-pull sequence.',false),
 ('act-backwards','Act It Backwards','spend','Play',20,'Tech charades in reverse.',false),
 ('voiceover','Voiceover to Dialogues or Songs','spend','Make',20,'Dub tech clips.',true),
 ('digital-art','Digital Art Station','spend','Make',20,'Tablets and AI-assisted art.',false)
on conflict do nothing;
insert into rewards (id, name, cost, stock, blurb) values
 ('sticker-pack','Octocat Sticker Pack',40,200,'Octocat and event-specific designs.'),
 ('tee','Epoch T-Shirt',180,80,'Event-branded tee.'),
 ('hoodie','Epoch Hoodie',320,30,'Limited-edition hoodie.')
on conflict do nothing;

-- Make yourself an admin (replace with your GitHub handle after first login):
-- update profiles set role = 'admin' where handle = 'your-handle';

-- ============================================================
-- Club sign-ups (the "Join the club" form on the home page)
-- Anyone may INSERT one row (the site's /api/join validates first);
-- only volunteers/admins can read them, on the organiser desk.
-- ============================================================
create table if not exists join_requests (
  id bigint generated always as identity primary key,
  handle text not null check (handle ~* '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$'),
  email text not null check (length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  first_event text not null check (length(first_event) <= 20),
  created_at timestamptz not null default now()
);
create unique index if not exists join_requests_one_per_email on join_requests (lower(email));
alter table join_requests enable row level security;
drop policy if exists "anyone can sign up" on join_requests;
create policy "anyone can sign up" on join_requests for insert to anon, authenticated with check (true);
drop policy if exists "staff read sign-ups" on join_requests;
create policy "staff read sign-ups" on join_requests for select using (my_role() in ('volunteer','admin'));
grant insert on join_requests to anon, authenticated;

-- ============================================================
-- Email: welcome + organiser broadcasts (see lib/email, app/api/join, app/api/broadcast)
-- ============================================================
alter table join_requests add column if not exists unsubscribed boolean not null default false;

-- Anyone with a valid signed link can unsubscribe: unsubscribe_join, defined with the Epoch interest list below.

-- A record of every broadcast: who sent what, to how many.
create table if not exists broadcasts (
  id bigint generated always as identity primary key,
  sent_by uuid references profiles on delete set null,
  subject text not null check (length(subject) between 3 and 200),
  recipients int not null default 0,
  created_at timestamptz not null default now()
);
alter table broadcasts enable row level security;
drop policy if exists "staff read broadcasts" on broadcasts;
create policy "staff read broadcasts" on broadcasts for select using (my_role() in ('volunteer','admin'));
drop policy if exists "admins log broadcasts" on broadcasts;
create policy "admins log broadcasts" on broadcasts for insert with check (my_role() = 'admin' and sent_by = auth.uid());

-- ============================================================
-- "Get involved" messages: core-team applications, sponsors, speakers, questions.
-- Anyone may send one (the site validates and rate-limits first); only staff can read them.
-- ============================================================
create table if not exists messages (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('apply','sponsor','speaker','question')),
  name text not null check (length(name) between 2 and 80),
  email text not null check (length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  handle text check (handle is null or handle ~* '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$'),
  message text not null check (length(message) between 10 and 3000),
  created_at timestamptz not null default now()
);
alter table messages enable row level security;
drop policy if exists "anyone can send a message" on messages;
create policy "anyone can send a message" on messages for insert to anon, authenticated with check (true);
drop policy if exists "staff read messages" on messages;
create policy "staff read messages" on messages for select using (my_role() in ('volunteer','admin'));
grant insert on messages to anon, authenticated;

-- ============================================================
-- Event feedback: anonymous, one row per submission. Anyone may send; only staff can read.
-- ============================================================
create table if not exists event_feedback (
  id bigint generated always as identity primary key,
  event text not null check (length(event) <= 20),
  rating int not null check (rating between 1 and 5),
  liked text check (liked is null or length(liked) <= 1000),
  improve text check (improve is null or length(improve) <= 1000),
  created_at timestamptz not null default now()
);
alter table event_feedback enable row level security;
drop policy if exists "anyone can send feedback" on event_feedback;
create policy "anyone can send feedback" on event_feedback for insert to anon, authenticated with check (true);
drop policy if exists "staff read feedback" on event_feedback;
create policy "staff read feedback" on event_feedback for select using (my_role() in ('volunteer','admin'));
grant insert on event_feedback to anon, authenticated;

-- ============================================================
-- Attendance and certificates (the /admin dashboard)
-- Organisers record who actually came to an event — imported from Luma's check-in list, picked from
-- sign-ups, or added by hand. Only these people get a certificate. Anyone can verify a certificate
-- by its id (the link in the email); names and events are shown, emails never are.
-- ============================================================
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  event text not null,                 -- the event's date in lib/config.ts, e.g. '2026-10-07'
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (email = lower(email)),
  handle text,
  emailed_at timestamptz,              -- when the certificate email went out
  added_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (event, email)
);
alter table attendance enable row level security;
drop policy if exists "staff manage attendance" on attendance;
create policy "staff manage attendance" on attendance for all
  using (my_role() in ('volunteer','admin')) with check (my_role() in ('volunteer','admin'));
grant select, insert, update, delete on attendance to authenticated;

create or replace function certificate(p_id uuid)
returns table (name text, event text, handle text, issued timestamptz)
language sql security definer stable as
$$ select name, event, handle, coalesce(emailed_at, created_at) from attendance where id = p_id $$;
grant execute on function certificate(uuid) to anon, authenticated;

-- Admins give people organiser access by GitHub handle (they must have signed in once).
create or replace function set_role(p_handle text, p_role text)
returns json language plpgsql security definer as $$
declare h text := lower(ltrim(trim(p_handle), '@'));
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can change roles.'); end if;
  if p_role not in ('attendee','volunteer','admin') then return json_build_object('ok', false, 'error', 'Unknown role.'); end if;
  if exists (select 1 from profiles where id = auth.uid() and lower(handle) = h) then
    return json_build_object('ok', false, 'error', 'You can''t change your own role — ask another admin.');
  end if;
  update profiles set role = p_role where lower(handle) = h;
  if not found then return json_build_object('ok', false, 'error', 'Nobody with that GitHub username has signed in yet. Ask them to sign in at /admin once.'); end if;
  return json_build_object('ok', true);
end $$;
revoke execute on function set_role(text, text) from public, anon;
grant execute on function set_role(text, text) to authenticated;

-- ============================================================
-- "Notify me when Epoch dates are announced": an email-only interest list.
-- Nobody can insert or read it directly: the site calls epoch_interest_join (which checks the address), and only
-- admins can read the list, to email it from the broadcast tool. The same signed unsubscribe link covers it.
-- ============================================================
create table if not exists epoch_interest (
  id bigint generated always as identity primary key,
  email text not null check (length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  unsubscribed boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists epoch_interest_one_per_email on epoch_interest (lower(email));
alter table epoch_interest enable row level security;
drop policy if exists "admins read epoch interest" on epoch_interest;
create policy "admins read epoch interest" on epoch_interest for select using (my_role() = 'admin');

-- 'created' or 'exists'. An address that unsubscribed stays unsubscribed: someone else typing it in can't undo that.
create or replace function epoch_interest_join(p_email text) returns text language plpgsql security definer as $$
declare e text := lower(trim(p_email));
begin
  if e is null or length(e) > 254 or e !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'invalid email'; end if;
  insert into epoch_interest (email) values (e) on conflict ((lower(email))) do nothing;
  return case when found then 'created' else 'exists' end;
end $$;
revoke execute on function epoch_interest_join(text) from public;
grant execute on function epoch_interest_join(text) to anon, authenticated;

-- Anyone with a valid signed link can unsubscribe (the site checks the signature before calling this).
-- One link, every list: club sign-ups and the Epoch interest list.
create or replace function unsubscribe_join(p_email text) returns void language sql security definer as $$
  update join_requests set unsubscribed = true where lower(email) = lower(p_email);
  update epoch_interest set unsubscribed = true where lower(email) = lower(p_email);
$$;
grant execute on function unsubscribe_join(text) to anon, authenticated;
