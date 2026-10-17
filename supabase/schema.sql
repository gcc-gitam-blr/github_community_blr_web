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
  role text not null default 'attendee' check (role in ('attendee','volunteer','core','admin')), -- a display mirror of the appointments below; access never reads it
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

-- Today's date in India. Postgres' current_date is UTC, which is a day behind from midnight to 05:30 here, so
-- anything that expires or is "due today" uses this. The argument is only there so tests can ask about other moments.
create or replace function today_ist(p_at timestamptz default now()) returns date
language sql stable set search_path = pg_catalog, pg_temp as $$ select (p_at at time zone 'Asia/Kolkata')::date $$;

-- ============================================================
-- Appointments: who holds which role, from when to when. Access follows these rows and ends by itself on the end
-- date (nobody has to remember to remove it). A person's role is the highest of their active appointments.
--   volunteer = event-day staff (Epoch desk and booths), core = the core team, admin = president / vice-president level.
-- profiles.role is only a display copy kept in step by triggers; no policy or function reads it to decide access.
-- ============================================================
create table if not exists appointments (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('volunteer','core','admin')),
  title text check (title is null or length(title) <= 60), -- e.g. 'President', 'Events lead'
  starts_on date not null default today_ist(),
  ends_on date not null, -- required: every grant has an end
  revoked_at timestamptz, revoked_by uuid, revoke_reason text check (revoke_reason is null or length(revoke_reason) <= 200),
  created_by uuid, created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists appointments_user on appointments (user_id);
alter table appointments enable row level security;
revoke insert, update, delete on appointments from anon, authenticated;

-- The live role of anyone, worked out from today's appointments (India date). Internal: the functions below call it.
-- 'attendee' = signed in with no active appointment; 'none' = no profile at all (never null, so `not in (...)` checks work).
create or replace function role_of(p_uid uuid) returns text
language sql security definer set search_path = public, pg_temp stable as $$
  select coalesce(
    (select case max(case a.role when 'admin' then 3 when 'core' then 2 when 'volunteer' then 1 end)
              when 3 then 'admin' when 2 then 'core' when 1 then 'volunteer' end
       from appointments a
      where a.user_id = p_uid and a.revoked_at is null and a.starts_on <= today_ist() and a.ends_on >= today_ist()),
    case when exists (select 1 from profiles where id = p_uid) then 'attendee' else 'none' end)
$$;
revoke execute on function role_of(uuid) from public, anon, authenticated;

-- The signed-in person's role, read from the database on every call, so an appointment that ended overnight
-- stops working on the next request. Row-level-security policies call this one.
create or replace function my_role() returns text language sql security definer set search_path = public, pg_temp stable as
$$ select role_of(auth.uid()) $$;

drop policy if exists "read own appointments" on appointments;
create policy "read own appointments" on appointments for select using (user_id = auth.uid() or my_role() = 'admin');

-- Keep profiles.role in step with the appointments (display only), however the change happens.
create or replace function profile_role_mirror() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin new.role := coalesce(nullif(role_of(new.id), 'none'), 'attendee'); return new; end $$;
revoke execute on function profile_role_mirror() from public, anon, authenticated;
drop trigger if exists profile_role_mirror on profiles;
create trigger profile_role_mirror before insert or update of role on profiles for each row execute function profile_role_mirror();

create or replace function appointment_changed() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin update profiles set role = role where id = coalesce(new.user_id, old.user_id); return null; end $$;
revoke execute on function appointment_changed() from public, anon, authenticated;
drop trigger if exists appointment_changed on appointments;
create trigger appointment_changed after insert or update or delete on appointments for each row execute function appointment_changed();

-- Appointments expire without any row changing, so the weekly digest asks for the display copies to catch up.
create or replace function sync_profile_roles() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  update profiles set role = role where role is distinct from coalesce(nullif(role_of(id), 'none'), 'attendee');
  get diagnostics n = row_count; return n;
end $$;
revoke execute on function sync_profile_roles() from public, anon, authenticated;
grant execute on function sync_profile_roles() to service_role;

-- ============================================================
-- The club's audit log (crm_audit): every change to who has access, and later members, applications, proposals and
-- so on. Written only by crm_log, from inside the functions that make the change; nobody can edit or delete a row.
-- detail holds ids and state changes, never names, notes or tokens. Only admins read it. (audit_log above is Epoch's.)
-- ============================================================
create table if not exists crm_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null check (length(action) between 1 and 60),
  entity text not null check (length(entity) between 1 and 40),
  entity_id text,
  detail jsonb not null default '{}'
);
create index if not exists crm_audit_at on crm_audit (at desc);
alter table crm_audit enable row level security;
revoke insert, update, delete, truncate on crm_audit from anon, authenticated;
drop policy if exists "admins read the crm audit" on crm_audit;
create policy "admins read the crm audit" on crm_audit for select using (my_role() = 'admin');
create or replace function crm_audit_readonly() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  -- only prune_old_data deletes (rows past their retention period), and only from the server key; nobody else can touch a row
  if tg_op = 'DELETE' and current_setting('club.pruning', true) = 'on' then return old; end if;
  raise exception 'crm_audit is append-only';
end $$;
drop trigger if exists crm_audit_readonly on crm_audit;
create trigger crm_audit_readonly before update or delete on crm_audit for each row execute function crm_audit_readonly();

create or replace function crm_log(p_action text, p_entity text, p_entity_id text, p_detail jsonb default '{}')
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into crm_audit (actor, action, entity, entity_id, detail) values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_detail, '{}'))
$$;
revoke execute on function crm_log(text, text, text, jsonb) from public, anon, authenticated;

drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles for select using (auth.uid() = id);
drop policy if exists "staff read profiles" on profiles;
create policy "staff read profiles" on profiles for select using (my_role() in ('volunteer','core','admin'));
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
returns void language sql security definer set search_path = public, pg_temp as $$
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
create or replace function bump_leaderboard() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
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
returns profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles; u auth.users; pr record; aid bigint;
begin
  select * into me from profiles where id = auth.uid();
  if found then return me; end if;
  select * into u from auth.users where id = auth.uid();
  insert into profiles (id, handle, name, email)
  values (u.id, coalesce(u.raw_user_meta_data->>'user_name', split_part(u.email,'@',1)), p_name, u.email)
  returning * into me;
  update members set user_id = me.id where user_id is null and (lower(email) = lower(coalesce(me.email, '')) or lower(handle) = lower(me.handle));
  -- an admin may have granted this GitHub username access before their first sign-in: it becomes an appointment now
  -- (a grant with no end date, or one that has already ended, is left for an admin to fix)
  select * into pr from pending_roles where handle = lower(me.handle);
  if found then
    if pr.ends_on is not null and pr.ends_on >= today_ist() then
      delete from pending_roles where handle = pr.handle;
      insert into appointments (user_id, role, title, ends_on) values (me.id, pr.role, pr.title, pr.ends_on) returning id into aid;
      perform crm_log('appointment_granted', 'appointment', aid::text, jsonb_build_object('user', me.id, 'role', pr.role, 'ends_on', pr.ends_on, 'via', 'pending'));
      select * into me from profiles where id = me.id; -- the mirror trigger has updated the role
    end if;
  end if;
  return me;
end $$;

-- organiser desk: check the attendee in and credit their starter coins. Once per attendee.
-- Any volunteer can check people in (the desk), whether or not they also run a booth.
create or replace function issue_ticket(p_user uuid, p_coins int default 398)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare t profiles; amt int := p_coins;
begin
  if my_role() not in ('volunteer','core','admin') then return json_build_object('ok', false, 'error', 'Organiser access required.'); end if;
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
returns json language plpgsql security definer set search_path = public, pg_temp as $$
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
returns json language sql security definer set search_path = public, pg_temp as $$ select booth_tx(auth.uid(), p_booth, false) $$;

-- A booth's volunteer scans an attendee's wallet: charges the session, or pays out a recharge point once
-- they've passed. Volunteers only at their own booth; admins at any.
create or replace function staff_scan(p_user uuid, p_booth text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles; r json; er text := my_role();
begin
  select * into me from profiles where id = auth.uid();
  if not found or er not in ('volunteer','core','admin') then return json_build_object('ok', false, 'error', 'Organiser access required.'); end if;
  if er <> 'admin' and me.booth is distinct from p_booth then
    return json_build_object('ok', false, 'error', case when me.booth is null then 'You''re on the desk, so you can check people in. Ask an admin to give you a booth.' else 'You can only scan for your own booth.' end);
  end if;
  r := booth_tx(p_user, p_booth, true);
  if (r->>'ok')::boolean then perform log_action('scan', p_user, p_booth, (r->>'delta')::int); end if;
  return r;
end $$;

create or replace function redeem_reward(p_reward text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
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
returns json language plpgsql security definer set search_path = public, pg_temp as $$
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
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles; o txs; t profiles; amt int; er text := my_role();
begin
  select * into me from profiles where id = auth.uid();
  if not found or er not in ('volunteer','core','admin') then return json_build_object('ok', false, 'error', 'Organiser access required.'); end if;
  select * into o from txs where id = p_tx for update;
  if not found then return json_build_object('ok', false, 'error', 'Transaction not found.'); end if;
  if o.ref like 'reverse:%' then return json_build_object('ok', false, 'error', 'A reversal can''t be reversed. Ask an admin to award or deduct instead.'); end if;
  if o.reversed_at is not null then return json_build_object('ok', false, 'error', 'Already reversed.'); end if;
  if er <> 'admin' then
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
language plpgsql security definer set search_path = public, pg_temp stable as $$
declare raw text := lower(ltrim(trim(coalesce(p_q, '')), '@')); q text;
begin
  if my_role() not in ('volunteer','core','admin') or length(raw) < 2 then return; end if;
  q := '%' || replace(replace(replace(raw, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query select p.id, p.handle, p.name, p.email, p.coins, p.earned, p.ticket, role_of(p.id), p.booth, p.created_at from profiles p
    where lower(p.name) like q or lower(p.handle) like q or lower(coalesce(p.email, '')) like q
    order by (lower(p.handle) = raw) desc, p.name limit 20;
end $$;

-- An attendee's recent transactions, to reverse one: admins see all, a volunteer only their own booth's.
create or replace function staff_txs(p_user uuid)
returns setof txs language plpgsql security definer set search_path = public, pg_temp stable as $$
declare me profiles; er text := my_role();
begin
  select * into me from profiles where id = auth.uid();
  if not found or er not in ('volunteer','core','admin') or (er <> 'admin' and me.booth is null) then return; end if;
  return query select * from txs where user_id = p_user and (er = 'admin' or ref in ('booth:' || me.booth, 'reverse:booth:' || me.booth))
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
-- Nobody inserts directly: the site's /api/join validates, then calls submit_join (end of this file) with the
-- server-only key. Only volunteers/admins can read them, on the organiser desk.
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
drop policy if exists "anyone can sign up" on join_requests; -- earlier versions let anyone insert; only submit_join writes now
drop policy if exists "staff read sign-ups" on join_requests;
create policy "staff read sign-ups" on join_requests for select using (my_role() in ('core','admin')); -- volunteers are event-day staff and don't read these
revoke insert on join_requests from anon, authenticated;

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
create policy "staff read broadcasts" on broadcasts for select using (my_role() in ('core','admin')); -- volunteers are event-day staff and don't read these
drop policy if exists "admins log broadcasts" on broadcasts;
create policy "admins log broadcasts" on broadcasts for insert with check (my_role() = 'admin' and sent_by = auth.uid());

-- ============================================================
-- "Get involved" messages: core-team applications, sponsors, speakers, questions.
-- Written only by submit_message (end of this file), which the site calls after validating and rate-limiting; only staff can read them.
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
drop policy if exists "staff read messages" on messages;
create policy "staff read messages" on messages for select using (my_role() in ('core','admin')); -- volunteers are event-day staff and don't read these
revoke insert on messages from anon, authenticated;

-- ============================================================
-- Event feedback: anonymous, one row per submission. Written only by submit_feedback (end of this file); only staff can read.
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
drop policy if exists "staff read feedback" on event_feedback;
create policy "staff read feedback" on event_feedback for select using (my_role() in ('core','admin')); -- volunteers are event-day staff and don't read these
revoke insert on event_feedback from anon, authenticated;

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
  using (my_role() in ('volunteer','core','admin')) with check (my_role() in ('volunteer','core','admin'));
grant select, insert, update, delete on attendance to authenticated;

create or replace function certificate(p_id uuid)
returns table (name text, event text, handle text, issued timestamptz)
language sql security definer set search_path = public, pg_temp stable as
$$ select name, event, handle, coalesce(emailed_at, created_at) from attendance where id = p_id $$;
grant execute on function certificate(uuid) to anon, authenticated;

-- "My club" (/me): the signed-in person's own attendance, and so their certificates. Matched by the email GitHub
-- gave them or their GitHub username; nobody can read anyone else's this way.
create or replace function my_attendance()
returns table (id uuid, event text, name text)
language sql security definer set search_path = public, pg_temp stable as $$
  select a.id, a.event, a.name from attendance a join auth.users u on u.id = auth.uid()
  where a.email = lower(u.email) or (a.handle is not null and lower(a.handle) = lower(u.raw_user_meta_data->>'user_name'))
  order by a.event desc
$$;
revoke execute on function my_attendance() from public, anon;
grant execute on function my_attendance() to authenticated;

-- Access granted to a GitHub username that hasn't signed in yet. register_profile turns it into an appointment on first
-- sign-in. (Rows made before appointments existed have no end date; they stay here until an admin grants them again.)
create table if not exists pending_roles (
  handle text primary key check (handle = lower(handle)),
  role text not null check (role in ('volunteer','core','admin')),
  created_at timestamptz not null default now()
);
alter table pending_roles add column if not exists title text check (title is null or length(title) <= 60);
alter table pending_roles add column if not exists ends_on date;
do $$ begin
  alter table pending_roles drop constraint if exists pending_roles_role_check;
  alter table pending_roles add constraint pending_roles_role_check check (role in ('volunteer','core','admin'));
  alter table profiles drop constraint if exists profiles_role_check;
  alter table profiles add constraint profiles_role_check check (role in ('attendee','volunteer','core','admin'));
end $$;
alter table pending_roles enable row level security;
drop policy if exists "admins read pending roles" on pending_roles;
create policy "admins read pending roles" on pending_roles for select using (my_role() = 'admin');
grant select on pending_roles to authenticated;

-- Admins appoint people by GitHub handle, from today until a date they choose (works before or after the person's
-- first sign-in). A person holds one appointment at a time: a new one ends the old one, so this also changes a role or
-- extends a term. Never your own, and never the last admin's. Every change is written to crm_audit (and Epoch's audit_log).
create or replace function grant_appointment(p_handle text, p_role text, p_title text, p_ends_on date)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare h text := lower(ltrim(trim(coalesce(p_handle, '')), '@')); ttl text := nullif(trim(coalesce(p_title, '')), ''); t uuid; aid bigint;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can change who has access.'); end if;
  if p_role is null or p_role not in ('volunteer','core','admin') then return json_build_object('ok', false, 'error', 'Pick volunteer, core or admin.'); end if;
  if p_ends_on is null or p_ends_on < today_ist() then return json_build_object('ok', false, 'error', 'Pick an end date that is today or later.'); end if;
  if p_ends_on > today_ist() + 1100 then return json_build_object('ok', false, 'error', 'Access can run for at most 3 years at a time.'); end if;
  if ttl is not null and length(ttl) > 60 then return json_build_object('ok', false, 'error', 'Keep the title under 60 characters.'); end if;
  if h !~ '^[a-z0-9]([a-z0-9-]{0,38})$' then return json_build_object('ok', false, 'error', 'That doesn''t look like a GitHub username.'); end if;
  if exists (select 1 from profiles where id = auth.uid() and lower(handle) = h) then
    return json_build_object('ok', false, 'error', 'You can''t change your own access — ask another admin.');
  end if;
  perform pg_advisory_xact_lock(hashtext('appointments')); -- two admins changing admins at once can't both pass the last-admin check
  select id into t from profiles where lower(handle) = h;
  if t is null then
    -- not signed in yet: remember the grant; it becomes an appointment the first time they sign in
    insert into pending_roles (handle, role, title, ends_on) values (h, p_role, ttl, p_ends_on)
    on conflict (handle) do update set role = excluded.role, title = excluded.title, ends_on = excluded.ends_on, created_at = now();
    perform crm_log('appointment_pending', 'pending_role', h, jsonb_build_object('role', p_role, 'ends_on', p_ends_on));
    return json_build_object('ok', true, 'pending', true);
  end if;
  if role_of(t) = 'admin' and p_role <> 'admin' and not exists (
       select 1 from appointments a where a.user_id <> t and a.role = 'admin' and a.revoked_at is null and a.starts_on <= today_ist() and a.ends_on >= today_ist()) then
    return json_build_object('ok', false, 'error', 'That would leave no active admin. Appoint another admin first.');
  end if;
  update appointments set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'replaced by a new appointment'
   where user_id = t and revoked_at is null and ends_on >= today_ist();
  insert into appointments (user_id, role, title, ends_on, created_by) values (t, p_role, ttl, p_ends_on, auth.uid()) returning id into aid;
  perform crm_log('appointment_granted', 'appointment', aid::text, jsonb_build_object('user', t, 'role', p_role, 'ends_on', p_ends_on));
  perform log_action('role', t, null, null, p_role);
  return json_build_object('ok', true);
end $$;

create or replace function end_appointment(p_id bigint, p_reason text default '')
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare a appointments; why text := left(trim(coalesce(p_reason, '')), 200);
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can change who has access.'); end if;
  perform pg_advisory_xact_lock(hashtext('appointments'));
  select * into a from appointments where id = p_id and revoked_at is null and ends_on >= today_ist() for update;
  if not found then return json_build_object('ok', false, 'error', 'That appointment has already ended.'); end if;
  if a.user_id = auth.uid() then return json_build_object('ok', false, 'error', 'You can''t end your own access — ask another admin.'); end if;
  if a.role = 'admin' and a.starts_on <= today_ist() and not exists (
       select 1 from appointments x where x.id <> a.id and x.user_id <> a.user_id and x.role = 'admin' and x.revoked_at is null and x.starts_on <= today_ist() and x.ends_on >= today_ist()) then
    return json_build_object('ok', false, 'error', 'That would leave no active admin. Appoint another admin first.');
  end if;
  update appointments set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = nullif(why, '') where id = a.id;
  -- losing organiser access also takes them off their booth
  if role_of(a.user_id) = 'attendee' then update profiles set booth = null where id = a.user_id; end if;
  perform crm_log('appointment_ended', 'appointment', a.id::text, jsonb_build_object('user', a.user_id, 'role', a.role));
  perform log_action('role', a.user_id, null, null, 'attendee');
  return json_build_object('ok', true);
end $$;

-- The Epoch desk's "Who runs what" still gives and takes event-day access by GitHub handle. A volunteer added there
-- holds the role for 30 days (extend it under People & roles); core and admin need an end date chosen under People & roles.
create or replace function set_role(p_handle text, p_role text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare h text := lower(ltrim(trim(coalesce(p_handle, '')), '@')); t uuid; aid bigint;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can change roles.'); end if;
  if p_role = 'volunteer' then return grant_appointment(h, 'volunteer', null, today_ist() + 30); end if;
  if p_role in ('core', 'admin') then return json_build_object('ok', false, 'error', 'Core and admin access need an end date. Give it under People & roles on /admin.'); end if;
  if p_role is distinct from 'attendee' then return json_build_object('ok', false, 'error', 'Unknown role.'); end if;
  select id into t from profiles where lower(handle) = h;
  if t is null then delete from pending_roles where handle = h; return json_build_object('ok', true); end if;
  select id into aid from appointments where user_id = t and revoked_at is null and ends_on >= today_ist() order by ends_on desc limit 1;
  if aid is null then return json_build_object('ok', true); end if;
  return end_appointment(aid, 'removed from the Epoch desk');
end $$;

-- Everyone who has signed in, with their live role. Organisers see names and roles; admins also see the title, end
-- date and appointment id they need to change it.
create or replace function list_people()
returns table (id uuid, handle text, name text, role text, title text, ends_on date, appointment_id bigint, created_at timestamptz)
language plpgsql security definer stable set search_path = public, pg_temp as $$
declare er text := my_role();
begin
  if er not in ('volunteer','core','admin') then return; end if;
  return query
    select p.id, p.handle, p.name, role_of(p.id), x.title, x.ends_on, x.id, p.created_at
    from profiles p
    left join lateral (select a.id, case when er = 'admin' then a.title end as title, case when er = 'admin' then a.ends_on end as ends_on
                         from appointments a
                        where a.user_id = p.id and a.revoked_at is null and a.starts_on <= today_ist() and a.ends_on >= today_ist()
                        order by case a.role when 'admin' then 3 when 'core' then 2 else 1 end desc, a.ends_on desc limit 1) x on er = 'admin'
    order by p.created_at desc limit 1000;
end $$;

-- For the Monday digest (server key only): access that is about to end, and whether enough admins remain.
create or replace function appointment_warnings()
returns json language sql security definer stable set search_path = public, pg_temp as $$
  select json_build_object(
    'active_admins', (select count(distinct user_id) from appointments where role = 'admin' and revoked_at is null and starts_on <= today_ist() and ends_on >= today_ist()),
    'ending', coalesce((select json_agg(json_build_object('handle', p.handle, 'role', a.role, 'ends_on', a.ends_on, 'days_left', a.ends_on - today_ist()) order by a.ends_on)
                          from appointments a join profiles p on p.id = a.user_id
                         where a.revoked_at is null and a.starts_on <= today_ist() and a.ends_on between today_ist() and today_ist() + 14), '[]'::json))
$$;

-- Who gets the Monday digest when ORGANISER_EMAILS isn't set: everyone with an active admin appointment (server key only).
create or replace function admin_emails() returns table (email text)
language sql security definer stable set search_path = public, pg_temp as $$
  select distinct p.email from profiles p join appointments a on a.user_id = p.id
   where a.role = 'admin' and a.revoked_at is null and a.starts_on <= today_ist() and a.ends_on >= today_ist() and p.email is not null
$$;

-- First admin (or a replacement when none is left): run once in the Supabase SQL editor after that person has signed in
-- at /admin, e.g. select bootstrap_admin('your-handle', '2027-06-30'); — `npm run connect -- admin <handle> <until>` does the same.
create or replace function bootstrap_admin(p_handle text, p_ends_on date)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare t uuid; aid bigint;
begin
  if p_ends_on is null or p_ends_on < today_ist() or p_ends_on > today_ist() + 1100 then return json_build_object('ok', false, 'error', 'Pick an end date from today to 3 years away.'); end if;
  select id into t from profiles where lower(handle) = lower(ltrim(trim(coalesce(p_handle, '')), '@'));
  if t is null then return json_build_object('ok', false, 'error', 'Nobody with that GitHub username has signed in yet.'); end if;
  insert into appointments (user_id, role, title, ends_on) values (t, 'admin', null, p_ends_on) returning id into aid;
  perform crm_log('appointment_granted', 'appointment', aid::text, jsonb_build_object('user', t, 'role', 'admin', 'ends_on', p_ends_on, 'via', 'bootstrap'));
  return json_build_object('ok', true);
end $$;

revoke execute on function grant_appointment(text, text, text, date), end_appointment(bigint, text), set_role(text, text), list_people() from public, anon;
grant execute on function grant_appointment(text, text, text, date), end_appointment(bigint, text), set_role(text, text), list_people() to authenticated;
revoke execute on function appointment_warnings(), admin_emails(), bootstrap_admin(text, date) from public, anon, authenticated;
grant execute on function appointment_warnings(), admin_emails(), bootstrap_admin(text, date) to service_role;

-- Admins put a volunteer on a booth (or take them off it with an empty booth). What a volunteer can do follows:
-- with a booth, scan wallets and reverse recent scans there; without one, ticket check-in at the desk.
create or replace function assign_booth(p_handle text, p_booth text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare h text := lower(ltrim(trim(p_handle), '@')); b text := nullif(trim(coalesce(p_booth, '')), ''); t profiles;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can assign booths.'); end if;
  if b is not null and not exists (select 1 from booths where id = b and kind <> 'free') then return json_build_object('ok', false, 'error', 'That isn''t a coin booth.'); end if;
  select * into t from profiles where lower(handle) = h for update;
  if not found then return json_build_object('ok', false, 'error', 'Nobody with that GitHub username has signed in yet.'); end if;
  if role_of(t.id) = 'attendee' then return json_build_object('ok', false, 'error', '@' || t.handle || ' isn''t a volunteer yet. Give them the volunteer role first.'); end if;
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
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
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
-- Server-only: with the public key anyone could write endless counter rows, or fill the table.
revoke execute on function rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function rate_hit(text, int, int) to service_role;

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
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
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
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare s int; m int; f int; e int; ap int; mb int; au int;
begin
  delete from join_requests where created_at < now() - interval '18 months'; get diagnostics s = row_count;
  delete from messages where created_at < now() - interval '12 months'; get diagnostics m = row_count;
  delete from event_feedback where created_at < now() - interval '12 months'; get diagnostics f = row_count;
  delete from client_errors where created_at < now() - interval '30 days'; get diagnostics e = row_count;
  delete from rate_hits where window_start < now() - interval '1 day';
  -- applications that ended in rejection or withdrawal: 6 months after their campaign closed (reviews and decisions go with them)
  delete from applications a using recruitment_campaigns c where c.id = a.campaign_id and a.status in ('rejected','withdrawn') and c.closes_on < (now() - interval '6 months')::date; get diagnostics ap = row_count;
  -- members who became inactive: 24 months later. Active members and alumni are kept.
  delete from members where status = 'inactive' and status_since < (now() - interval '24 months')::date; get diagnostics mb = row_count;
  -- the club's audit log: 36 months (the only place a crm_audit row can be deleted)
  perform set_config('club.pruning', 'on', true);
  delete from crm_audit where at < now() - interval '36 months'; get diagnostics au = row_count;
  perform set_config('club.pruning', 'off', true);
  return json_build_object('signups', s, 'messages', m, 'feedback', f, 'errors', e, 'applications', ap, 'members', mb, 'audit', au);
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
create or replace function epoch_interest_join(p_email text) returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare e text := lower(trim(p_email));
begin
  if e is null or length(e) > 254 or e !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'invalid email'; end if;
  insert into epoch_interest (email) values (e) on conflict ((lower(email))) do nothing;
  if found then return 'created'; end if;
  return case when exists (select 1 from epoch_interest where lower(email) = e and unsubscribed) then 'unsubscribed' else 'exists' end;
end $$;
-- Server-only (the site checks the address and the rate limit first); with the public key anyone could stuff the list.
revoke execute on function epoch_interest_join(text) from public, anon, authenticated;
grant execute on function epoch_interest_join(text) to service_role;

-- Anyone with a valid signed link can unsubscribe (the site checks the signature before calling this).
-- One link, every list: club sign-ups and the Epoch interest list.
create or replace function unsubscribe_join(p_email text) returns void language sql security definer set search_path = public, pg_temp as $$
  update join_requests set unsubscribed = true where lower(email) = lower(p_email);
  update epoch_interest set unsubscribed = true where lower(email) = lower(p_email);
$$;
-- Server-only: the signed link is checked by the site, so calling this with the public key must not unsubscribe anyone.
revoke execute on function unsubscribe_join(text) from public, anon, authenticated;
grant execute on function unsubscribe_join(text) to service_role;

-- Live quizzes (/quiz/host): each finished quiz's final table and per-question counts, so organisers can look back.
-- Playing needs nothing here (it runs over Realtime broadcast); only the record of a finished quiz is kept.
create table if not exists quiz_runs (
  id text primary key check (length(id) <= 64),
  title text not null check (length(title) <= 200),
  code text not null,
  players int not null default 0,
  result jsonb not null,
  hosted_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table quiz_runs enable row level security;
drop policy if exists "staff read quiz runs" on quiz_runs;
create policy "staff read quiz runs" on quiz_runs for select using (my_role() in ('volunteer','core','admin'));
drop policy if exists "staff save quiz runs" on quiz_runs;
create policy "staff save quiz runs" on quiz_runs for insert with check (my_role() in ('volunteer','core','admin'));
drop policy if exists "staff update quiz runs" on quiz_runs;
create policy "staff update quiz runs" on quiz_runs for update using (my_role() in ('volunteer','core','admin'));

-- Quizzes saved for later (/quiz/host → Save for later): the questions as written. Nobody can join one until it's hosted.
create table if not exists quiz_sets (
  id text primary key check (length(id) <= 64),
  title text not null check (length(title) <= 200),
  body text not null check (length(body) <= 100000),
  saved_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table quiz_sets enable row level security;
drop policy if exists "staff manage quiz sets" on quiz_sets;
create policy "staff manage quiz sets" on quiz_sets for all using (my_role() in ('volunteer','core','admin')) with check (my_role() in ('volunteer','core','admin'));

-- ============================================================
-- The public forms write through these. The site's server calls them with its server-only key (service_role) after the
-- honeypot, the minimum fill time and the per-visitor rate limit, so calling the database straight from a browser with
-- the public key can no longer skip those checks. Each also stops a runaway script with a limit per hour across all visitors.
-- A fork without SUPABASE_SERVICE_ROLE_KEY can let the public key call them instead (the forms then work, but anyone with
-- that key can skip the per-visitor checks): grant execute on function submit_join(text, text, text),
-- submit_message(text, text, text, text, text), submit_feedback(text, int, text, text), epoch_interest_join(text) to anon;
-- ============================================================
create or replace function submit_join(p_handle text, p_email text, p_first_event text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select count(*) from join_requests where created_at > now() - interval '1 hour') >= 300 then return 'busy'; end if;
  insert into join_requests (handle, email, first_event) values (trim(p_handle), lower(trim(p_email)), p_first_event)
  on conflict ((lower(email))) do nothing;
  return case when found then 'created' else 'exists' end; -- 'exists': that email already signed up
end $$;

create or replace function submit_message(p_kind text, p_name text, p_email text, p_handle text, p_message text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select count(*) from messages where created_at > now() - interval '1 hour') >= 200 then return 'busy'; end if;
  insert into messages (kind, name, email, handle, message) values (p_kind, trim(p_name), lower(trim(p_email)), nullif(trim(coalesce(p_handle, '')), ''), trim(p_message));
  return 'created';
end $$;

create or replace function submit_feedback(p_event text, p_rating int, p_liked text, p_improve text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select count(*) from event_feedback where created_at > now() - interval '1 hour') >= 600 then return 'busy'; end if;
  insert into event_feedback (event, rating, liked, improve) values (p_event, p_rating, nullif(trim(coalesce(p_liked, '')), ''), nullif(trim(coalesce(p_improve, '')), ''));
  return 'created';
end $$;

revoke execute on function submit_join(text, text, text), submit_message(text, text, text, text, text), submit_feedback(text, int, text, text) from public, anon, authenticated;
grant execute on function submit_join(text, text, text), submit_message(text, text, text, text, text), submit_feedback(text, int, text, text) to service_role;

-- ============================================================
-- Members and recruitment (admin → Members, Recruitment).
-- Members are the club's people. Applications come in through submit_application (server key only, like the other
-- public forms), are read only by the campaign's assigned reviewers and admins, and every step is checked here, not on
-- the page: who may review, which status can follow which, and that nobody reviews or decides their own application.
-- Nothing is written to these tables directly. Every change goes to crm_audit with ids only, never names or answers.
-- ============================================================
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  handle text check (handle is null or handle ~* '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$'),
  name text not null check (length(name) between 2 and 80),
  email text not null check (length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  user_id uuid references profiles(id) on delete set null, -- filled in when they sign in
  status text not null default 'active' check (status in ('active','alumni','inactive')),
  status_since date not null default today_ist(),
  team text check (team is null or length(team) <= 40),
  joined_on date, left_on date,
  source_application_id bigint, -- the application they came from, if any
  created_at timestamptz not null default now()
);
create unique index if not exists members_one_per_email on members (lower(email));
create unique index if not exists members_one_per_handle on members (lower(handle)) where handle is not null;
create unique index if not exists members_one_per_application on members (source_application_id) where source_application_id is not null;
alter table members enable row level security;
revoke insert, update, delete on members from anon, authenticated;
drop policy if exists "core and admins read members" on members;
create policy "core and admins read members" on members for select using (my_role() in ('core','admin'));

create table if not exists recruitment_campaigns (
  id bigint generated always as identity primary key,
  name text not null check (length(name) between 3 and 80),
  year text not null check (length(year) between 4 and 20),
  status text not null default 'draft' check (status in ('draft','open','closed','archived')),
  opens_on date not null,
  closes_on date not null,
  created_by uuid, created_at timestamptz not null default now(),
  check (closes_on >= opens_on)
);
create table if not exists campaign_reviewers (
  campaign_id bigint not null references recruitment_campaigns on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  primary key (campaign_id, user_id)
);
create table if not exists applications (
  id bigint generated always as identity primary key,
  campaign_id bigint not null references recruitment_campaigns,
  name text not null check (length(name) between 2 and 80),
  email text not null check (length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  handle text not null check (handle ~* '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$'),
  team_pref text check (team_pref is null or length(team_pref) <= 40),
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object' and length(answers::text) <= 4000),
  status text not null default 'submitted' check (status in ('submitted','screening','interview','selected','waitlisted','rejected','withdrawn','onboarded')),
  created_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now()
);
create unique index if not exists applications_one_per_email on applications (campaign_id, lower(email));
create index if not exists applications_campaign on applications (campaign_id);
create table if not exists application_reviews (
  id bigint generated always as identity primary key,
  application_id bigint not null references applications on delete cascade,
  reviewer_id uuid not null references profiles on delete cascade,
  score int not null check (score between 1 and 5),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  unique (application_id, reviewer_id)
);
create table if not exists selection_decisions (
  id bigint generated always as identity primary key,
  application_id bigint not null unique references applications on delete cascade,
  decision text not null check (decision in ('selected','waitlisted','rejected')),
  reason text check (reason is null or length(reason) <= 1000),
  decided_by uuid, created_at timestamptz not null default now()
);
alter table recruitment_campaigns enable row level security;
alter table campaign_reviewers enable row level security;
alter table applications enable row level security;
alter table application_reviews enable row level security;
alter table selection_decisions enable row level security;
revoke insert, update, delete on recruitment_campaigns, campaign_reviewers, applications, application_reviews, selection_decisions from anon, authenticated;
drop policy if exists "core and admins read campaigns" on recruitment_campaigns;
create policy "core and admins read campaigns" on recruitment_campaigns for select using (my_role() in ('core','admin'));
drop policy if exists "admins and the reviewer read assignments" on campaign_reviewers;
create policy "admins and the reviewer read assignments" on campaign_reviewers for select using (my_role() = 'admin' or user_id = auth.uid());
-- an application is read by admins and by the reviewers assigned to its campaign (who must still hold a core or admin appointment)
drop policy if exists "assigned reviewers and admins read applications" on applications;
create policy "assigned reviewers and admins read applications" on applications for select using (
  my_role() = 'admin' or (my_role() = 'core' and exists (select 1 from campaign_reviewers r where r.campaign_id = applications.campaign_id and r.user_id = auth.uid())));
drop policy if exists "reviewers read their own reviews, admins all" on application_reviews;
create policy "reviewers read their own reviews, admins all" on application_reviews for select using (my_role() = 'admin' or (reviewer_id = auth.uid() and my_role() = 'core'));
drop policy if exists "admins read decisions" on selection_decisions;
create policy "admins read decisions" on selection_decisions for select using (my_role() = 'admin');

-- Is this application from the signed-in person themselves (same email or GitHub username)? Internal.
create or replace function is_own_application(p_app bigint) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from applications a join profiles p on p.id = auth.uid()
                  where a.id = p_app and (lower(a.email) = lower(coalesce(p.email, '')) or lower(a.handle) = lower(p.handle)))
$$;
revoke execute on function is_own_application(bigint) from public, anon, authenticated;

-- Can the signed-in person act on this application as a reviewer (assigned to its campaign, or an admin)? Internal.
create or replace function can_see_application(p_app bigint) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select my_role() = 'admin' or (my_role() = 'core' and exists (
    select 1 from applications a join campaign_reviewers r on r.campaign_id = a.campaign_id where a.id = p_app and r.user_id = auth.uid()))
$$;
revoke execute on function can_see_application(bigint) from public, anon, authenticated;

-- ---- campaigns ----
create or replace function create_campaign(p_name text, p_year text, p_opens_on date, p_closes_on date)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare cid bigint;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can run recruitment.'); end if;
  if length(trim(coalesce(p_name, ''))) not between 3 and 80 then return json_build_object('ok', false, 'error', 'Give the campaign a name of 3 to 80 characters.'); end if;
  if length(trim(coalesce(p_year, ''))) not between 4 and 20 then return json_build_object('ok', false, 'error', 'Give the club year, e.g. 2026-27.'); end if;
  if p_opens_on is null or p_closes_on is null or p_closes_on < p_opens_on then return json_build_object('ok', false, 'error', 'The closing date can''t be before the opening date.'); end if;
  insert into recruitment_campaigns (name, year, opens_on, closes_on, created_by) values (trim(p_name), trim(p_year), p_opens_on, p_closes_on, auth.uid()) returning id into cid;
  perform crm_log('campaign_created', 'campaign', cid::text, jsonb_build_object('opens_on', p_opens_on, 'closes_on', p_closes_on));
  return json_build_object('ok', true, 'id', cid);
end $$;

create or replace function set_campaign_dates(p_id bigint, p_opens_on date, p_closes_on date)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can run recruitment.'); end if;
  if p_opens_on is null or p_closes_on is null or p_closes_on < p_opens_on then return json_build_object('ok', false, 'error', 'The closing date can''t be before the opening date.'); end if;
  update recruitment_campaigns set opens_on = p_opens_on, closes_on = p_closes_on where id = p_id;
  if not found then return json_build_object('ok', false, 'error', 'Campaign not found.'); end if;
  perform crm_log('campaign_dates', 'campaign', p_id::text, jsonb_build_object('opens_on', p_opens_on, 'closes_on', p_closes_on));
  return json_build_object('ok', true);
end $$;

-- draft → open | archived; open → closed; closed → open | archived. Only one campaign is open at a time.
create or replace function set_campaign_status(p_id bigint, p_status text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare c recruitment_campaigns;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can run recruitment.'); end if;
  select * into c from recruitment_campaigns where id = p_id for update;
  if not found then return json_build_object('ok', false, 'error', 'Campaign not found.'); end if;
  if not ((c.status = 'draft' and p_status in ('open','archived')) or (c.status = 'open' and p_status = 'closed') or (c.status = 'closed' and p_status in ('open','archived'))) then
    return json_build_object('ok', false, 'error', 'A ' || c.status || ' campaign can''t become ' || coalesce(p_status, 'that') || '.');
  end if;
  if p_status = 'open' then
    if c.closes_on < today_ist() then return json_build_object('ok', false, 'error', 'Its closing date has passed. Change the dates first.'); end if;
    if exists (select 1 from recruitment_campaigns where status = 'open' and id <> c.id) then return json_build_object('ok', false, 'error', 'Another campaign is already open. Close it first.'); end if;
  end if;
  update recruitment_campaigns set status = p_status where id = c.id;
  perform crm_log('campaign_status', 'campaign', c.id::text, jsonb_build_object('from', c.status, 'to', p_status));
  return json_build_object('ok', true);
end $$;

create or replace function add_reviewer(p_campaign bigint, p_handle text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare t uuid;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can run recruitment.'); end if;
  if not exists (select 1 from recruitment_campaigns where id = p_campaign) then return json_build_object('ok', false, 'error', 'Campaign not found.'); end if;
  select id into t from profiles where lower(handle) = lower(ltrim(trim(coalesce(p_handle, '')), '@'));
  if t is null or role_of(t) not in ('core','admin') then return json_build_object('ok', false, 'error', 'Reviewers must hold a core or admin appointment, and have signed in.'); end if;
  insert into campaign_reviewers (campaign_id, user_id) values (p_campaign, t) on conflict do nothing;
  perform crm_log('reviewer_added', 'campaign', p_campaign::text, jsonb_build_object('user', t));
  return json_build_object('ok', true);
end $$;

create or replace function remove_reviewer(p_campaign bigint, p_user uuid)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can run recruitment.'); end if;
  delete from campaign_reviewers where campaign_id = p_campaign and user_id = p_user;
  perform crm_log('reviewer_removed', 'campaign', p_campaign::text, jsonb_build_object('user', p_user));
  return json_build_object('ok', true);
end $$;

-- The campaign the public form is for: open, and today (India) is within its dates. Server key only (the site calls it).
create or replace function open_campaign() returns json language sql security definer stable set search_path = public, pg_temp as $$
  select json_build_object('id', id, 'name', name, 'closes_on', closes_on) from recruitment_campaigns
   where status = 'open' and opens_on <= today_ist() and closes_on >= today_ist() order by opens_on desc limit 1
$$;

-- ---- applying (public form, through the site's server) ----
create or replace function submit_application(p_campaign bigint, p_name text, p_email text, p_handle text, p_team text, p_answers jsonb)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare c recruitment_campaigns; aid bigint; k text; v jsonb;
begin
  select * into c from recruitment_campaigns where id = p_campaign;
  if not found or c.status <> 'open' or c.opens_on > today_ist() or c.closes_on < today_ist() then return 'closed'; end if;
  if (select count(*) from applications where created_at > now() - interval '1 hour') >= 200 then return 'busy'; end if;
  p_answers := coalesce(p_answers, '{}');
  if jsonb_typeof(p_answers) <> 'object' or (select count(*) from jsonb_object_keys(p_answers)) > 6 then raise exception 'bad answers'; end if;
  for k, v in select * from jsonb_each(p_answers) loop
    if jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 1000 or length(k) > 30 then raise exception 'bad answers'; end if;
  end loop;
  insert into applications (campaign_id, name, email, handle, team_pref, answers)
  values (c.id, trim(p_name), lower(trim(p_email)), trim(p_handle), nullif(trim(coalesce(p_team, '')), ''), p_answers)
  on conflict (campaign_id, lower(email)) do nothing returning id into aid;
  if aid is null then return 'exists'; end if;
  perform crm_log('application_submitted', 'application', aid::text, jsonb_build_object('campaign', c.id));
  return 'created';
end $$;

-- ---- reviewing ----
create or replace function review_application(p_app bigint, p_score int, p_notes text default '')
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare a applications; n text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if not can_see_application(p_app) then return json_build_object('ok', false, 'error', 'That application isn''t available to you.'); end if;
  if not exists (select 1 from applications a join campaign_reviewers r on r.campaign_id = a.campaign_id where a.id = p_app and r.user_id = auth.uid()) then
    return json_build_object('ok', false, 'error', 'You can review an application only if you are assigned to its campaign.');
  end if;
  if is_own_application(p_app) then return json_build_object('ok', false, 'error', 'You can''t review your own application.'); end if;
  select * into a from applications where id = p_app;
  if a.status not in ('submitted','screening','interview') then return json_build_object('ok', false, 'error', 'This application is no longer open for review.'); end if;
  if p_score is null or p_score not between 1 and 5 then return json_build_object('ok', false, 'error', 'Score from 1 to 5.'); end if;
  if n is not null and length(n) > 2000 then return json_build_object('ok', false, 'error', 'Keep notes under 2000 characters.'); end if;
  insert into application_reviews (application_id, reviewer_id, score, notes) values (p_app, auth.uid(), p_score, n)
  on conflict (application_id, reviewer_id) do update set score = excluded.score, notes = excluded.notes, created_at = now();
  perform crm_log('application_reviewed', 'application', p_app::text, jsonb_build_object('score', p_score));
  return json_build_object('ok', true);
end $$;

-- submitted → screening → interview (assigned reviewers or admins); any open state → withdrawn (admins).
create or replace function move_application(p_app bigint, p_to text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare a applications;
begin
  if not can_see_application(p_app) then return json_build_object('ok', false, 'error', 'That application isn''t available to you.'); end if;
  if is_own_application(p_app) then return json_build_object('ok', false, 'error', 'You can''t move your own application.'); end if;
  select * into a from applications where id = p_app for update;
  if not ((a.status = 'submitted' and p_to = 'screening') or (a.status = 'screening' and p_to = 'interview')
          or (a.status in ('submitted','screening','interview','waitlisted') and p_to = 'withdrawn')) then
    return json_build_object('ok', false, 'error', 'An application that is ' || a.status || ' can''t become ' || coalesce(p_to, 'that') || '.');
  end if;
  if p_to = 'withdrawn' and my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can withdraw an application.'); end if;
  update applications set status = p_to, status_changed_at = now() where id = p_app;
  perform crm_log('application_moved', 'application', p_app::text, jsonb_build_object('from', a.status, 'to', p_to));
  return json_build_object('ok', true);
end $$;

-- Only admins decide: interview → selected | waitlisted | rejected; waitlisted → selected | rejected.
create or replace function decide_application(p_app bigint, p_decision text, p_reason text default '')
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare a applications; why text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins record decisions.'); end if;
  if is_own_application(p_app) then return json_build_object('ok', false, 'error', 'You can''t decide your own application.'); end if;
  select * into a from applications where id = p_app for update;
  if not found then return json_build_object('ok', false, 'error', 'That application isn''t available to you.'); end if;
  if not ((a.status = 'interview' and p_decision in ('selected','waitlisted','rejected')) or (a.status = 'waitlisted' and p_decision in ('selected','rejected'))) then
    return json_build_object('ok', false, 'error', 'An application that is ' || a.status || ' can''t be ' || coalesce(p_decision, 'decided') || '.');
  end if;
  if why is not null and length(why) > 1000 then return json_build_object('ok', false, 'error', 'Keep the reason under 1000 characters.'); end if;
  insert into selection_decisions (application_id, decision, reason, decided_by) values (p_app, p_decision, why, auth.uid())
  on conflict (application_id) do update set decision = excluded.decision, reason = excluded.reason, decided_by = excluded.decided_by, created_at = now();
  update applications set status = p_decision, status_changed_at = now() where id = p_app;
  perform crm_log('application_decided', 'application', p_app::text, jsonb_build_object('from', a.status, 'decision', p_decision));
  return json_build_object('ok', true);
end $$;

-- selected → onboarded, and a member is made (nothing else: appointments are a separate, deliberate step).
create or replace function onboard_application(p_app bigint)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare a applications; mid uuid;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins can onboard.'); end if;
  if is_own_application(p_app) then return json_build_object('ok', false, 'error', 'You can''t onboard your own application.'); end if;
  select * into a from applications where id = p_app for update;
  if not found then return json_build_object('ok', false, 'error', 'That application isn''t available to you.'); end if;
  if a.status <> 'selected' then return json_build_object('ok', false, 'error', 'Only a selected application can be onboarded (this one is ' || a.status || ').'); end if;
  if exists (select 1 from members where lower(email) = lower(a.email) or lower(handle) = lower(a.handle)) then
    return json_build_object('ok', false, 'error', 'Someone with that email or GitHub username is already a member.');
  end if;
  insert into members (handle, name, email, team, joined_on, source_application_id, user_id)
  values (lower(a.handle), a.name, a.email, a.team_pref, today_ist(), a.id, (select id from profiles where lower(email) = lower(a.email) or lower(handle) = lower(a.handle) limit 1))
  returning id into mid;
  update applications set status = 'onboarded', status_changed_at = now() where id = a.id;
  perform crm_log('application_onboarded', 'application', a.id::text, jsonb_build_object('member', mid));
  return json_build_object('ok', true, 'member', mid);
end $$;

-- ---- members ----
create or replace function create_member(p_name text, p_email text, p_handle text, p_team text, p_joined_on date)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare mid uuid; h text := nullif(lower(ltrim(trim(coalesce(p_handle, '')), '@')), '');
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins edit members.'); end if;
  insert into members (name, email, handle, team, joined_on, user_id)
  values (trim(p_name), lower(trim(p_email)), h, nullif(trim(coalesce(p_team, '')), ''), p_joined_on,
          (select id from profiles where lower(email) = lower(trim(p_email)) or lower(handle) = h limit 1))
  returning id into mid;
  perform crm_log('member_created', 'member', mid::text, '{}');
  return json_build_object('ok', true, 'id', mid);
exception
  when unique_violation then return json_build_object('ok', false, 'error', 'Someone with that email or GitHub username is already a member.');
  when check_violation then return json_build_object('ok', false, 'error', 'Check the name (2 to 80 characters), the email and the GitHub username.');
end $$;

create or replace function update_member(p_id uuid, p_name text, p_email text, p_handle text, p_team text, p_joined_on date)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare h text := nullif(lower(ltrim(trim(coalesce(p_handle, '')), '@')), '');
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins edit members.'); end if;
  update members set name = trim(p_name), email = lower(trim(p_email)), handle = h, team = nullif(trim(coalesce(p_team, '')), ''), joined_on = p_joined_on where id = p_id;
  if not found then return json_build_object('ok', false, 'error', 'Member not found.'); end if;
  perform crm_log('member_updated', 'member', p_id::text, '{}');
  return json_build_object('ok', true);
exception
  when unique_violation then return json_build_object('ok', false, 'error', 'Someone else already has that email or GitHub username.');
  when check_violation then return json_build_object('ok', false, 'error', 'Check the name (2 to 80 characters), the email and the GitHub username.');
end $$;

create or replace function set_member_status(p_id uuid, p_status text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare m members;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins edit members.'); end if;
  if p_status is null or p_status not in ('active','alumni','inactive') then return json_build_object('ok', false, 'error', 'Pick active, alumni or inactive.'); end if;
  select * into m from members where id = p_id for update;
  if not found then return json_build_object('ok', false, 'error', 'Member not found.'); end if;
  if m.status = p_status then return json_build_object('ok', true); end if;
  update members set status = p_status, status_since = today_ist(), left_on = case when p_status = 'active' then null else coalesce(left_on, today_ist()) end where id = p_id;
  perform crm_log('member_status_changed', 'member', p_id::text, jsonb_build_object('from', m.status, 'to', p_status));
  return json_build_object('ok', true);
end $$;

-- Rows come as a JSON array of { handle, name, email, team, joined_on }. Checked all together: with any problem nothing is
-- written, and the answer lists each problem by row number. p_dry_run (the default) only checks.
create or replace function import_members(p_rows jsonb, p_dry_run boolean default true)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare r jsonb; i int := 0; errs jsonb := '[]'; ok_rows int := 0; h text; em text; nm text; jd date; seen_e text[] := '{}'; seen_h text[] := '{}';
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins edit members.'); end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then return json_build_object('ok', false, 'error', 'Expected a list of rows.'); end if;
  if jsonb_array_length(p_rows) > 500 then return json_build_object('ok', false, 'error', 'Import at most 500 rows at a time.'); end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1; nm := trim(coalesce(r->>'name', '')); em := lower(trim(coalesce(r->>'email', ''))); h := nullif(lower(ltrim(trim(coalesce(r->>'handle', '')), '@')), '');
    begin jd := nullif(trim(coalesce(r->>'joined_on', '')), '')::date; exception when others then jd := null; errs := errs || jsonb_build_array(jsonb_build_object('row', i, 'error', 'joined_on must be YYYY-MM-DD')); continue; end;
    if length(nm) not between 2 and 80 then errs := errs || jsonb_build_array(jsonb_build_object('row', i, 'error', 'name must be 2 to 80 characters'));
    elsif em !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(em) > 254 then errs := errs || jsonb_build_array(jsonb_build_object('row', i, 'error', 'email doesn''t look right'));
    elsif h is not null and h !~ '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$' then errs := errs || jsonb_build_array(jsonb_build_object('row', i, 'error', 'GitHub username doesn''t look right'));
    elsif length(coalesce(r->>'team', '')) > 40 then errs := errs || jsonb_build_array(jsonb_build_object('row', i, 'error', 'team is too long'));
    elsif em = any(seen_e) or (h is not null and h = any(seen_h)) then errs := errs || jsonb_build_array(jsonb_build_object('row', i, 'error', 'appears twice in this file'));
    elsif exists (select 1 from members where lower(email) = em or (h is not null and lower(handle) = h)) then errs := errs || jsonb_build_array(jsonb_build_object('row', i, 'error', 'is already a member'));
    else seen_e := seen_e || em; if h is not null then seen_h := seen_h || h; end if; ok_rows := ok_rows + 1; end if;
  end loop;
  if jsonb_array_length(errs) > 0 or p_dry_run then
    return json_build_object('ok', jsonb_array_length(errs) = 0, 'dry_run', p_dry_run, 'total', i, 'valid', ok_rows, 'errors', errs);
  end if;
  insert into members (handle, name, email, team, joined_on, user_id)
  select nullif(lower(ltrim(trim(coalesce(x->>'handle', '')), '@')), ''), trim(x->>'name'), lower(trim(x->>'email')), nullif(trim(coalesce(x->>'team', '')), ''), nullif(trim(coalesce(x->>'joined_on', '')), '')::date,
         (select id from profiles where lower(email) = lower(trim(x->>'email')) limit 1)
    from jsonb_array_elements(p_rows) x;
  perform crm_log('members_imported', 'member', null, jsonb_build_object('count', i));
  return json_build_object('ok', true, 'dry_run', false, 'total', i, 'valid', ok_rows, 'errors', '[]'::jsonb);
end $$;

-- Exports are functions so each one is logged (the download itself is built in the browser from what this returns).
create or replace function export_members() returns setof members
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if my_role() not in ('core','admin') then return; end if;
  perform crm_log('export', 'members', null, jsonb_build_object('count', (select count(*) from members)));
  return query select * from members order by name;
end $$;

create or replace function export_signups() returns setof join_requests
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if my_role() not in ('core','admin') then return; end if;
  perform crm_log('export', 'signups', null, jsonb_build_object('count', (select count(*) from join_requests)));
  return query select * from join_requests order by created_at desc;
end $$;

revoke execute on function create_campaign(text, text, date, date), set_campaign_dates(bigint, date, date), set_campaign_status(bigint, text),
  add_reviewer(bigint, text), remove_reviewer(bigint, uuid), review_application(bigint, int, text), move_application(bigint, text),
  decide_application(bigint, text, text), onboard_application(bigint), create_member(text, text, text, text, date),
  update_member(uuid, text, text, text, text, date), set_member_status(uuid, text), import_members(jsonb, boolean),
  export_members(), export_signups() from public, anon;
grant execute on function create_campaign(text, text, date, date), set_campaign_dates(bigint, date, date), set_campaign_status(bigint, text),
  add_reviewer(bigint, text), remove_reviewer(bigint, uuid), review_application(bigint, int, text), move_application(bigint, text),
  decide_application(bigint, text, text), onboard_application(bigint), create_member(text, text, text, text, date),
  update_member(uuid, text, text, text, text, date), set_member_status(uuid, text), import_members(jsonb, boolean),
  export_members(), export_signups() to authenticated;
revoke execute on function open_campaign(), submit_application(bigint, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function open_campaign(), submit_application(bigint, text, text, text, text, jsonb) to service_role;
