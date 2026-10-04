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
-- Nothing in the ledger is ever deleted. A mistake is undone by a reversal: a new row with the opposite amount
-- (ref 'reverse:<original ref>', reverses = the original's id), and the original is stamped reversed_at.
alter table txs add column if not exists reverses bigint references txs;
alter table txs add column if not exists reversed_at timestamptz;
create unique index if not exists txs_one_reversal on txs (reverses) where reverses is not null;
-- a recharge point pays once per attendee (a reversed payout still counts as their attempt);
-- the ticket credit happens once, unless an admin reversed it (a wrong check-in) and the desk verifies again
create unique index if not exists txs_one_recharge_per_user on txs (user_id, ref) where ref like 'booth:recharge-%';
drop index if exists txs_one_ticket_per_user;
create unique index if not exists txs_one_live_ticket_per_user on txs (user_id) where ref = 'ticket' and reversed_at is null;

-- Volunteers run one booth each (set by an admin). No booth = desk volunteer: ticket check-in only.
alter table profiles add column if not exists booth text references booths on delete set null;

-- Every staff action (check-in, award, booth scan for someone, reversal, role or booth change): who, what, to whom,
-- how much, when. Written only inside the SECURITY DEFINER functions below, so it can't be skipped; only admins read it.
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid references profiles on delete set null,
  actor_handle text not null,
  action text not null check (action in ('ticket','award','scan','reverse','role','booth')),
  target uuid references profiles on delete set null,
  target_handle text,
  booth text,
  amount int,
  detail text not null default ''
);
create index if not exists audit_log_at on audit_log (at desc);

alter table profiles enable row level security;
alter table booths enable row level security;
alter table rewards enable row level security;
alter table txs enable row level security;
alter table audit_log enable row level security;

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
drop policy if exists "admins read the audit log" on audit_log;
create policy "admins read the audit log" on audit_log for select using (my_role() = 'admin');
-- no insert/update/delete policies: only the functions below write the audit log, and nobody edits it

-- One audit row, as the signed-in organiser. Internal: only the functions below call it.
create or replace function log_action(p_action text, p_target uuid, p_booth text, p_amount int, p_detail text default '')
returns void language sql security definer as $$
  insert into audit_log (actor, actor_handle, action, target, target_handle, booth, amount, detail)
  values (auth.uid(), coalesce((select handle from profiles where id = auth.uid()), 'unknown'), p_action,
          p_target, (select handle from profiles where id = p_target), p_booth, p_amount, coalesce(p_detail, ''));
$$;
revoke execute on function log_action(text, uuid, text, int, text) from public, anon, authenticated;

-- public leaderboard: no emails, no balances
create or replace view leaderboard as select id, handle, name, earned from profiles where earned > 0;
grant select on leaderboard to anon, authenticated;

-- Live leaderboard. Transactions stay private, so nothing personal is streamed: one public row holds a
-- counter that goes up whenever the leaderboard changes. Phones and the big screen listen to that row
-- (Supabase Realtime) and then re-read the public leaderboard view above.
create table if not exists leaderboard_version (
  id int primary key default 1 check (id = 1),
  v bigint not null default 0,
  at timestamptz not null default now()
);
insert into leaderboard_version (id) values (1) on conflict do nothing;
alter table leaderboard_version enable row level security;
drop policy if exists "anyone reads the leaderboard version" on leaderboard_version;
create policy "anyone reads the leaderboard version" on leaderboard_version for select using (true);
revoke insert, update, delete on leaderboard_version from anon, authenticated;
grant select on leaderboard_version to anon, authenticated;

-- Skips the bump if another transaction is bumping right now (SKIP LOCKED), so coin wins never queue behind each
-- other on this one row. That bump still tells every phone, and they re-read a moment later, after this one commits.
create or replace function bump_leaderboard() returns trigger language plpgsql security definer as $$
begin
  update leaderboard_version set v = v + 1, at = now()
  where id = (select id from leaderboard_version where id = 1 for update skip locked);
  return null;
end $$;
revoke execute on function bump_leaderboard() from public, anon, authenticated;
-- only changes the leaderboard shows: coins earned, or the name and handle next to them
drop trigger if exists leaderboard_changed on profiles;
create trigger leaderboard_changed after update of earned, name, handle on profiles for each row
  when (old.earned is distinct from new.earned or (new.earned > 0 and (old.name is distinct from new.name or old.handle is distinct from new.handle)))
  execute function bump_leaderboard();
drop trigger if exists leaderboard_left on profiles;
create trigger leaderboard_left after delete on profiles for each row when (old.earned > 0) execute function bump_leaderboard();

-- Realtime only sends changes for tables in its publication. Supabase creates the publication; add the row once.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leaderboard_version') then
    alter publication supabase_realtime add table leaderboard_version;
  end if;
end $$;

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
-- Any volunteer can check people in (the desk), whether or not they also run a booth.
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
  perform log_action('ticket', t.id, null, amt);
  return json_build_object('ok', true);
end $$;

-- The coin rules for one booth scan, for whoever is being charged or paid. Internal: called by scan_booth
-- (the attendee scans the booth's code) and staff_scan (the booth's volunteer scans the attendee's wallet).
create or replace function booth_tx(p_user uuid, p_booth text, p_staff boolean default false)
returns json language plpgsql security definer as $$
declare b booths; me profiles; d int; last_at timestamptz;
begin
  select * into b from booths where id = p_booth;
  if not found or b.kind = 'free' then return json_build_object('ok', false, 'error', 'That QR code isn''t a coin booth.'); end if;
  select * into me from profiles where id = p_user for update;
  if not found then return json_build_object('ok', false, 'error', case when p_staff then 'Unknown attendee QR.' else 'Register first.' end); end if;
  if not me.ticket then return json_build_object('ok', false, 'error', case when p_staff then me.name || '''s ticket hasn''t been verified yet — send them to the registration desk.' else 'Your ticket hasn''t been verified yet — visit the registration desk.' end); end if;

  if b.kind = 'recharge' then
    d := b.coins;
    begin
      insert into txs (user_id, delta, reason, ref) values (me.id, d, b.name, 'booth:' || b.id);
    exception when unique_violation then
      return json_build_object('ok', false, 'error', case when p_staff then me.name || ' has already used ' || b.name || '. One attempt per recharge point.' else 'You''ve already used ' || b.name || '. One attempt per recharge point.' end);
    end;
    update profiles set coins = coins + d, earned = earned + d where id = me.id returning * into me;
  else
    select max(at) into last_at from txs where user_id = me.id and ref = 'booth:' || b.id;
    if last_at is not null and now() - last_at < interval '20 seconds' then
      return json_build_object('ok', false, 'error', 'Just scanned — wait a few seconds before paying again.');
    end if;
    if me.coins < b.coins then return json_build_object('ok', false, 'error', case when p_staff then 'Not enough coins — ' || me.name || ' has ' || me.coins || '.' else 'Not enough coins — try a recharge point!' end); end if;
    d := -b.coins;
    insert into txs (user_id, delta, reason, ref) values (me.id, d, b.name, 'booth:' || b.id);
    update profiles set coins = coins + d where id = me.id returning * into me;
  end if;
  return json_build_object('ok', true, 'delta', d, 'balance', me.coins);
end $$;

create or replace function scan_booth(p_booth text)
returns json language sql security definer as $$ select booth_tx(auth.uid(), p_booth, false) $$;

-- A booth's volunteer scans an attendee's wallet: charges the session, or pays out a recharge point once
-- they've passed. Volunteers only at their own booth; admins at any.
create or replace function staff_scan(p_user uuid, p_booth text)
returns json language plpgsql security definer as $$
declare me profiles; r json;
begin
  select * into me from profiles where id = auth.uid();
  if not found or me.role not in ('volunteer','admin') then return json_build_object('ok', false, 'error', 'Organiser access required.'); end if;
  if me.role = 'volunteer' and me.booth is distinct from p_booth then
    return json_build_object('ok', false, 'error', case when me.booth is null then 'You''re on the desk, so you can check people in. Ask an admin to give you a booth.' else 'You can only scan for your own booth.' end);
  end if;
  r := booth_tx(p_user, p_booth, true);
  if (r->>'ok')::boolean then perform log_action('scan', p_user, p_booth, (r->>'delta')::int); end if;
  return r;
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

-- Prizes and manual corrections: admins only (volunteers are limited to the desk and their own booth).
create or replace function award_coins(p_user uuid, p_delta int, p_reason text)
returns json language plpgsql security definer as $$
declare t profiles;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can award or deduct coins.'); end if;
  select * into t from profiles where id = p_user for update;
  if not found then return json_build_object('ok', false, 'error', 'Unknown attendee QR.'); end if;
  if t.coins + p_delta < 0 then return json_build_object('ok', false, 'error', 'Balance would go below zero.'); end if;
  update profiles set coins = coins + p_delta, earned = earned + greatest(p_delta, 0) where id = t.id;
  insert into txs (user_id, delta, reason, ref) values (t.id, p_delta, coalesce(nullif(p_reason,''), 'Organiser award'), 'admin');
  perform log_action('award', t.id, null, p_delta, coalesce(nullif(p_reason,''), 'Organiser award'));
  return json_build_object('ok', true);
end $$;

-- Undo a transaction by adding its opposite (the original stays, stamped reversed_at). The rules (lib/epoch/rules.ts too):
--   • admins can reverse anything except a reversal; a volunteer only a scan at their own booth, within 15 minutes
--   • once per transaction, and never below zero (if they've already spent the coins, it's refused)
--   • a booth charge or shop purchase gives the coins back (and the item goes back in stock)
--   • a recharge payout or award takes the coins back, and off the leaderboard; the recharge point stays used
--   • a check-in takes the starter coins back and sets the ticket to pending, so the desk can verify the right person
create or replace function reverse_tx(p_tx bigint, p_reason text default '')
returns json language plpgsql security definer as $$
declare me profiles; o txs; t profiles; amt int;
begin
  select * into me from profiles where id = auth.uid();
  if not found or me.role not in ('volunteer','admin') then return json_build_object('ok', false, 'error', 'Organiser access required.'); end if;
  select * into o from txs where id = p_tx for update;
  if not found then return json_build_object('ok', false, 'error', 'Transaction not found.'); end if;
  if o.ref like 'reverse:%' then return json_build_object('ok', false, 'error', 'A reversal can''t be reversed. Ask an admin to award or deduct instead.'); end if;
  if o.reversed_at is not null then return json_build_object('ok', false, 'error', 'Already reversed.'); end if;
  if me.role = 'volunteer' then
    if me.booth is null or o.ref <> 'booth:' || me.booth then return json_build_object('ok', false, 'error', 'You can only reverse scans at your own booth. Ask an admin.'); end if;
    if now() - o.at > interval '15 minutes' then return json_build_object('ok', false, 'error', 'That was more than 15 minutes ago. Ask an admin.'); end if;
  end if;
  select * into t from profiles where id = o.user_id for update;
  amt := -o.delta;
  if t.coins + amt < 0 then return json_build_object('ok', false, 'error', t.name || ' has already spent those coins (balance ' || t.coins || '), so it can''t be reversed.'); end if;
  update txs set reversed_at = now() where id = o.id;
  insert into txs (user_id, delta, reason, ref, reverses) values (t.id, amt, 'Reversed: ' || o.reason, 'reverse:' || o.ref, o.id);
  update profiles set coins = coins + amt,
    earned = case when o.delta > 0 and o.ref <> 'ticket' then greatest(0, earned - o.delta) else earned end,
    ticket = case when o.ref = 'ticket' then false else ticket end
  where id = t.id returning * into t;
  if o.ref like 'reward:%' then update rewards set stock = stock + 1 where id = substr(o.ref, 8); end if;
  perform log_action('reverse', t.id, case when o.ref like 'booth:%' then substr(o.ref, 7) end, amt, o.reason || coalesce(' — ' || nullif(trim(p_reason), ''), ''));
  return json_build_object('ok', true, 'delta', amt, 'balance', t.coins);
end $$;

-- Staff find an attendee by name, GitHub username or email (someone whose phone died, or who lost their QR).
create or replace function find_attendees(p_q text)
returns table (id uuid, handle text, name text, email text, coins int, earned int, ticket boolean, role text, booth text, created_at timestamptz)
language plpgsql security definer stable as $$
declare raw text := lower(ltrim(trim(coalesce(p_q, '')), '@')); q text;
begin
  if my_role() not in ('volunteer','admin') or length(raw) < 2 then return; end if;
  q := '%' || replace(replace(replace(raw, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query select p.id, p.handle, p.name, p.email, p.coins, p.earned, p.ticket, p.role, p.booth, p.created_at from profiles p
    where lower(p.name) like q or lower(p.handle) like q or lower(coalesce(p.email, '')) like q
    order by (lower(p.handle) = raw) desc, p.name limit 20;
end $$;

-- An attendee's recent transactions, to reverse one: admins see all, a volunteer only their own booth's.
create or replace function staff_txs(p_user uuid)
returns setof txs language plpgsql security definer stable as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if not found or me.role not in ('volunteer','admin') or (me.role = 'volunteer' and me.booth is null) then return; end if;
  return query select * from txs where user_id = p_user and (me.role = 'admin' or ref in ('booth:' || me.booth, 'reverse:booth:' || me.booth))
    order by at desc, id desc limit 30;
end $$;

-- Belt and braces: visitors who aren't signed in can't even call the coin functions.
revoke execute on function issue_ticket(uuid, int), award_coins(uuid, int, text), scan_booth(text), redeem_reward(text), register_profile(text),
  staff_scan(uuid, text), reverse_tx(bigint, text), find_attendees(text), staff_txs(uuid) from public, anon;
grant execute on function issue_ticket(uuid, int), award_coins(uuid, int, text), scan_booth(text), redeem_reward(text), register_profile(text),
  staff_scan(uuid, text), reverse_tx(bigint, text), find_attendees(text), staff_txs(uuid) to authenticated;
-- booth_tx charges whoever it's given: only scan_booth and staff_scan may call it
revoke execute on function booth_tx(uuid, text, boolean) from public, anon, authenticated;

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

-- "My club" (/me): the signed-in person's own attendance, and so their certificates. Matched by the email GitHub
-- gave them or their GitHub username; nobody can read anyone else's this way.
create or replace function my_attendance()
returns table (id uuid, event text, name text)
language sql security definer stable as $$
  select a.id, a.event, a.name from attendance a join auth.users u on u.id = auth.uid()
  where a.email = lower(u.email) or (a.handle is not null and lower(a.handle) = lower(u.raw_user_meta_data->>'user_name'))
  order by a.event desc
$$;
revoke execute on function my_attendance() from public, anon;
grant execute on function my_attendance() to authenticated;

-- Admins give people organiser access by GitHub handle (they must have signed in once).
create or replace function set_role(p_handle text, p_role text)
returns json language plpgsql security definer as $$
declare h text := lower(ltrim(trim(p_handle), '@')); t uuid;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can change roles.'); end if;
  if p_role not in ('attendee','volunteer','admin') then return json_build_object('ok', false, 'error', 'Unknown role.'); end if;
  if exists (select 1 from profiles where id = auth.uid() and lower(handle) = h) then
    return json_build_object('ok', false, 'error', 'You can''t change your own role — ask another admin.');
  end if;
  -- losing organiser access also takes them off their booth
  update profiles set role = p_role, booth = case when p_role = 'attendee' then null else booth end where lower(handle) = h returning id into t;
  if not found then return json_build_object('ok', false, 'error', 'Nobody with that GitHub username has signed in yet. Ask them to sign in at /admin once.'); end if;
  perform log_action('role', t, null, null, p_role);
  return json_build_object('ok', true);
end $$;
revoke execute on function set_role(text, text) from public, anon;
grant execute on function set_role(text, text) to authenticated;

-- Admins put a volunteer on a booth (or take them off it with an empty booth). What a volunteer can do follows:
-- with a booth, scan wallets and reverse recent scans there; without one, ticket check-in at the desk.
create or replace function assign_booth(p_handle text, p_booth text)
returns json language plpgsql security definer as $$
declare h text := lower(ltrim(trim(p_handle), '@')); b text := nullif(trim(coalesce(p_booth, '')), ''); t profiles;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can assign booths.'); end if;
  if b is not null and not exists (select 1 from booths where id = b and kind <> 'free') then return json_build_object('ok', false, 'error', 'That isn''t a coin booth.'); end if;
  select * into t from profiles where lower(handle) = h for update;
  if not found then return json_build_object('ok', false, 'error', 'Nobody with that GitHub username has signed in yet.'); end if;
  if t.role = 'attendee' then return json_build_object('ok', false, 'error', '@' || t.handle || ' isn''t a volunteer yet. Give them the volunteer role first.'); end if;
  update profiles set booth = b where id = t.id;
  perform log_action('booth', t.id, b, null, coalesce(b, 'desk'));
  return json_build_object('ok', true);
end $$;
revoke execute on function assign_booth(text, text) from public, anon;
grant execute on function assign_booth(text, text) to authenticated;
-- ============================================================
-- Rate limits shared by every server instance (lib/ratelimit.ts). Vercel runs many copies of the site,
-- so a counter in memory resets whenever a new one starts; this one doesn't. The site sends a keyed
-- SHA-256 of the visitor's IP, never the IP itself. Nobody can read the table; rows older than a day
-- are deleted as it goes.
-- ============================================================
create table if not exists rate_hits (
  key text primary key check (length(key) <= 100),
  window_start timestamptz not null default now(),
  hits int not null default 1
);
create index if not exists rate_hits_window on rate_hits (window_start);
alter table rate_hits enable row level security;

-- Counts one hit for p_key and answers whether it's still within p_limit hits per p_window_seconds.
-- One statement, so two servers counting the same visitor at once can't both slip through.
create or replace function rate_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer as $$
declare n int; w interval := make_interval(secs => greatest(1, least(coalesce(p_window_seconds, 600), 86400)));
begin
  if p_key is null or length(p_key) not between 1 and 100 then return false; end if;
  delete from rate_hits where window_start < now() - interval '1 day';
  insert into rate_hits as r (key) values (p_key)
  on conflict (key) do update set
    hits = case when r.window_start <= now() - w then 1 else r.hits + 1 end,
    window_start = case when r.window_start <= now() - w then now() else r.window_start end
  returning hits into n;
  return n <= p_limit;
end $$;
revoke execute on function rate_hit(text, int, int) from public;
grant execute on function rate_hit(text, int, int) to anon, authenticated;

-- ============================================================
-- Errors from visitors' browsers (components/ui/ErrorReporter.tsx → /api/errors), so we hear when
-- something breaks on someone's phone. Only the message, a trimmed stack, the page path and the
-- browser family: never form contents, emails or query strings. Anyone can add one through
-- log_client_error (nobody can insert directly); only admins can read them, on /admin.
-- ============================================================
create table if not exists client_errors (
  id bigint generated always as identity primary key,
  message text not null check (length(message) between 1 and 300),
  stack text check (stack is null or length(stack) <= 2000),
  path text not null check (length(path) between 1 and 200),
  browser text not null check (length(browser) between 1 and 40),
  created_at timestamptz not null default now()
);
create index if not exists client_errors_at on client_errors (created_at desc);
alter table client_errors enable row level security;
drop policy if exists "admins read errors" on client_errors;
create policy "admins read errors" on client_errors for select using (my_role() = 'admin');
grant select on client_errors to authenticated;

create or replace function log_client_error(p_message text, p_stack text, p_path text, p_browser text)
returns boolean language plpgsql security definer as $$
begin
  if coalesce(p_message, '') = '' or coalesce(p_path, '') = '' then return false; end if;
  -- a broken release on every phone, or someone scripting it: 2000 a day is plenty to see the pattern
  if (select count(*) from client_errors where created_at > now() - interval '1 day') >= 2000 then return false; end if;
  insert into client_errors (message, stack, path, browser)
  values (left(p_message, 300), nullif(left(coalesce(p_stack, ''), 2000), ''), left(p_path, 200), left(coalesce(nullif(p_browser, ''), 'Other'), 40));
  return true;
end $$;
revoke execute on function log_client_error(text, text, text, text) from public;
grant execute on function log_client_error(text, text, text, text) to anon, authenticated;

-- ============================================================
-- Data retention: old personal data is deleted every week (a Vercel cron calls /api/cron/retention,
-- which calls this). The periods are mirrored in lib/retention.ts, which /privacy quotes;
-- tests/schema.test.ts checks the two agree, so change both together.
-- Only the server-only key (service_role) may run it, so nobody can start a deletion from a browser.
-- Attendance is kept, so certificates stay verifiable; Epoch data is cleared by hand (docs/ROLLOVER.md).
-- ============================================================
create or replace function prune_old_data()
returns json language plpgsql security definer as $$
declare s int; m int; f int; e int;
begin
  delete from join_requests where created_at < now() - interval '18 months'; get diagnostics s = row_count;
  delete from messages where created_at < now() - interval '12 months'; get diagnostics m = row_count;
  delete from event_feedback where created_at < now() - interval '12 months'; get diagnostics f = row_count;
  delete from client_errors where created_at < now() - interval '30 days'; get diagnostics e = row_count;
  delete from rate_hits where window_start < now() - interval '1 day';
  return json_build_object('signups', s, 'messages', m, 'feedback', f, 'errors', e);
end $$;
revoke execute on function prune_old_data() from public;
grant execute on function prune_old_data() to service_role; -- only the weekly cron, with the server-only key, may delete
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

-- 'created', 'exists' or 'unsubscribed'. An address that unsubscribed stays unsubscribed: someone else typing it in
-- can't undo that, so the form says it won't be emailed instead of claiming it's on the list.
create or replace function epoch_interest_join(p_email text) returns text language plpgsql security definer as $$
declare e text := lower(trim(p_email));
begin
  if e is null or length(e) > 254 or e !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'invalid email'; end if;
  insert into epoch_interest (email) values (e) on conflict ((lower(email))) do nothing;
  if found then return 'created'; end if;
  return case when exists (select 1 from epoch_interest where lower(email) = e and unsubscribed) then 'unsubscribed' else 'exists' end;
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
