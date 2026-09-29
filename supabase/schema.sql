-- Epoch backend. Run once in the Supabase SQL editor.
-- Auth: enable the GitHub provider (Authentication → Providers) — attendees sign in with GitHub.
-- All coin movement happens inside SECURITY DEFINER functions, so a tampered client can't mint coins.

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text not null unique,
  name text not null,
  email text,
  coins int not null default 0 check (coins >= 0),
  earned int not null default 0,
  role text not null default 'attendee' check (role in ('attendee','volunteer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists stalls (
  id text primary key, name text not null, kind text not null check (kind in ('earn','spend')),
  coins int not null check (coins > 0), blurb text not null default '', zone text not null default ''
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
-- a stall QR can be used once per attendee, no matter how many times it's scanned
create unique index if not exists txs_one_stall_per_user on txs (user_id, ref) where ref like 'stall:%';

alter table profiles enable row level security;
alter table stalls enable row level security;
alter table rewards enable row level security;
alter table txs enable row level security;

create policy "read own profile" on profiles for select using (auth.uid() = id);
create policy "staff read profiles" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('volunteer','admin')));
create policy "read stalls" on stalls for select using (true);
create policy "read rewards" on rewards for select using (true);
create policy "read own txs" on txs for select using (auth.uid() = user_id);

-- public leaderboard: no emails, no balances
create or replace view leaderboard as select id, handle, name, earned from profiles;
grant select on leaderboard to anon, authenticated;

create or replace function my_role() returns text language sql security definer stable as
$$ select role from profiles where id = auth.uid() $$;

create or replace function register_profile(p_name text, p_welcome int default 100)
returns profiles language plpgsql security definer as $$
declare me profiles; u auth.users;
begin
  select * into me from profiles where id = auth.uid();
  if found then return me; end if;
  select * into u from auth.users where id = auth.uid();
  insert into profiles (id, handle, name, email, coins, earned)
  values (u.id, coalesce(u.raw_user_meta_data->>'user_name', split_part(u.email,'@',1)), p_name, u.email, p_welcome, p_welcome)
  returning * into me;
  insert into txs (user_id, delta, reason, ref) values (me.id, p_welcome, 'Welcome bonus', 'signup');
  return me;
end $$;

create or replace function scan_stall(p_stall text)
returns json language plpgsql security definer as $$
declare s stalls; me profiles; d int;
begin
  select * into s from stalls where id = p_stall;
  if not found then return json_build_object('ok', false, 'error', 'That QR code isn''t an Epoch stall.'); end if;
  select * into me from profiles where id = auth.uid() for update;
  if not found then return json_build_object('ok', false, 'error', 'Register first.'); end if;
  d := case when s.kind = 'earn' then s.coins else -s.coins end;
  if me.coins + d < 0 then return json_build_object('ok', false, 'error', 'Not enough coins.'); end if;
  begin
    insert into txs (user_id, delta, reason, ref) values (me.id, d, s.name, 'stall:' || s.id);
  exception when unique_violation then
    return json_build_object('ok', false, 'error', 'You''ve already used ' || s.name || '.');
  end;
  update profiles set coins = coins + d, earned = earned + greatest(d, 0) where id = me.id returning * into me;
  return json_build_object('ok', true, 'delta', d, 'balance', me.coins);
end $$;

create or replace function redeem_reward(p_reward text)
returns json language plpgsql security definer as $$
declare r rewards; me profiles;
begin
  select * into r from rewards where id = p_reward for update;
  if not found then return json_build_object('ok', false, 'error', 'Reward not found.'); end if;
  if r.stock <= 0 then return json_build_object('ok', false, 'error', 'Sold out.'); end if;
  select * into me from profiles where id = auth.uid() for update;
  if not found or me.coins < r.cost then return json_build_object('ok', false, 'error', 'Not enough coins.'); end if;
  update rewards set stock = stock - 1 where id = r.id;
  update profiles set coins = coins - r.cost where id = me.id returning * into me;
  insert into txs (user_id, delta, reason, ref) values (me.id, -r.cost, 'Redeemed ' || r.name, 'reward:' || r.id);
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

-- seed (mirrors lib/epoch/config.ts — edit freely)
insert into stalls (id, name, kind, coins, zone, blurb) values
 ('git-quiz','Git Quiz Booth','earn',40,'Hall A','Answer five Git questions. No googling, no mercy.'),
 ('bug-bounty','Bug Bounty Desk','earn',75,'Lab 2','Find the planted bug in our repo.'),
 ('pr-clinic','First-PR Clinic','earn',60,'Lab 3','Open your very first pull request with a mentor.'),
 ('ctf','Capture The Flag','earn',120,'Lab 1','Crack three flags before the clock runs out.'),
 ('demo-day','Demo Day Stage','earn',50,'Auditorium','Watch a project demo and rate it.'),
 ('snack-bar','Commit Café','spend',20,'Lobby','Chai, cold coffee and snacks.')
on conflict do nothing;
insert into rewards (id, name, cost, stock, blurb) values
 ('sticker-pack','Sticker Pack',60,200,'Octocat & friends.'),
 ('tee','Epoch Tee',250,60,'Limited run. Black, obviously.'),
 ('hoodie','Merge Hoodie',500,25,'For the ones who ship at 2 a.m.'),
 ('mentor','1:1 Mentor Hour',300,20,'An hour with a senior engineer.'),
 ('mystery','Mystery Drop',150,40,'Nobody knows.')
on conflict do nothing;

-- Make yourself an admin (replace with your GitHub handle after first login):
-- update profiles set role = 'admin' where handle = 'your-handle';
