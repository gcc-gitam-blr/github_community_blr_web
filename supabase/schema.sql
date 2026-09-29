-- Epoch backend. Run once in the Supabase SQL editor.
-- Auth: enable the GitHub provider (Authentication → Providers) — attendees sign in with GitHub.
-- All coin movement happens inside SECURITY DEFINER functions, so a tampered client can't mint coins.
--
-- Economy (from the Epoch plan):
--   • ticket (₹199 example) × 2 coins/INR credited once by the organiser desk
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

create or replace function my_role() returns text language sql security definer stable as
$$ select role from profiles where id = auth.uid() $$;

create policy "read own profile" on profiles for select using (auth.uid() = id);
create policy "staff read profiles" on profiles for select using (my_role() in ('volunteer','admin'));
create policy "read booths" on booths for select using (true);
create policy "read rewards" on rewards for select using (true);
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

-- organiser desk: verify the ticket, credit price × rate coins. Once per attendee.
create or replace function issue_ticket(p_user uuid, p_price int default 199, p_rate int default 2)
returns json language plpgsql security definer as $$
declare t profiles; amt int := p_price * p_rate;
begin
  if my_role() not in ('volunteer','admin') then return json_build_object('ok', false, 'error', 'Organiser access required.'); end if;
  select * into t from profiles where id = p_user for update;
  if not found then return json_build_object('ok', false, 'error', 'Unknown attendee QR.'); end if;
  if t.ticket then return json_build_object('ok', false, 'error', t.name || ' already has a verified ticket.'); end if;
  update profiles set ticket = true, coins = coins + amt where id = t.id;
  insert into txs (user_id, delta, reason, ref) values (t.id, amt, 'Ticket ₹' || p_price || ' → ' || amt || ' EPC', 'ticket');
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
