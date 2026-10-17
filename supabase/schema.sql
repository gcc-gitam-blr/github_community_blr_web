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
declare s int; m int; f int; e int; ap int; mb int; au int; it int;
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
  -- interest-survey answers: kept while the person is a member or on the core team; gone with their member record
  delete from member_interests i where not exists (select 1 from members m where m.user_id = i.user_id) and role_of(i.user_id) not in ('core','admin'); get diagnostics it = row_count;
  -- the club's audit log: 36 months (the only place a crm_audit row can be deleted)
  perform set_config('club.pruning', 'on', true);
  delete from crm_audit where at < now() - interval '36 months'; get diagnostics au = row_count;
  perform set_config('club.pruning', 'off', true);
  return json_build_object('signups', s, 'messages', m, 'feedback', f, 'errors', e, 'applications', ap, 'members', mb, 'audit', au, 'interests', it);
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
declare ap applications; n text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if not can_see_application(p_app) then return json_build_object('ok', false, 'error', 'That application isn''t available to you.'); end if;
  if not exists (select 1 from applications a join campaign_reviewers r on r.campaign_id = a.campaign_id where a.id = p_app and r.user_id = auth.uid()) then
    return json_build_object('ok', false, 'error', 'You can review an application only if you are assigned to its campaign.');
  end if;
  if is_own_application(p_app) then return json_build_object('ok', false, 'error', 'You can''t review your own application.'); end if;
  select * into ap from applications where id = p_app;
  if ap.status not in ('submitted','screening','interview') then return json_build_object('ok', false, 'error', 'This application is no longer open for review.'); end if;
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

-- ============================================================
-- Event proposals and the approval step (admin → Event proposals).
-- A core member proposes an event and works through a short checklist; an admin, who is never the proposer, approves,
-- returns or rejects it. Approval is refused while a required checklist item is still open. After the event the
-- proposer records what happened. Public event pages are written in the content editor (a git commit), so the database
-- can't stop one being published early: this records the approval and shows it, and branch protection backs it up.
-- Nothing is written directly: every change is one of the functions below, and each is logged in crm_audit (ids and
-- states only, never the text people wrote).
-- ============================================================
create table if not exists event_proposals (
  id bigint generated always as identity primary key,
  title text not null check (length(trim(title)) between 3 and 120),
  kind text not null default 'workshop' check (kind in ('workshop','talk','hackathon','meetup','fest','other')),
  proposed_by uuid references profiles(id) on delete set null,
  proposed_date date not null,
  venue text not null check (length(trim(venue)) between 2 and 120),
  objective text not null check (length(trim(objective)) between 10 and 1500),
  expected_attendance int check (expected_attendance is null or expected_attendance between 1 and 5000),
  budget_inr int check (budget_inr is null or budget_inr between 0 and 10000000), -- optional
  status text not null default 'draft' check (status in ('draft','submitted','returned','approved','rejected','cancelled','completed')),
  event_slug text check (event_slug is null or (event_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(event_slug) <= 120)), -- the public page, once it exists
  decided_by uuid, decided_at timestamptz, decision_note text check (decision_note is null or length(decision_note) <= 1000),
  outcome_note text check (outcome_note is null or length(outcome_note) <= 2000),
  attendance_event text, -- the date of the event in the attendance table, if attendance was recorded there
  attendance_note text check (attendance_note is null or length(attendance_note) <= 500),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists event_proposals_status on event_proposals (status, proposed_date);
create table if not exists proposal_checklist_items (
  id bigint generated always as identity primary key,
  proposal_id bigint not null references event_proposals on delete cascade,
  label text not null check (length(label) between 3 and 140),
  required boolean not null default true,
  state text not null default 'open' check (state in ('open','done','na')),
  note text check (note is null or length(note) <= 300),
  sort int not null default 0,
  updated_by uuid, updated_at timestamptz not null default now()
);
create index if not exists proposal_items_proposal on proposal_checklist_items (proposal_id, sort);
alter table event_proposals enable row level security;
alter table proposal_checklist_items enable row level security;
revoke insert, update, delete on event_proposals, proposal_checklist_items from anon, authenticated;
drop policy if exists "core and admins read proposals" on event_proposals;
create policy "core and admins read proposals" on event_proposals for select using (my_role() in ('core','admin'));
drop policy if exists "core and admins read proposal items" on proposal_checklist_items;
create policy "core and admins read proposal items" on proposal_checklist_items for select using (my_role() in ('core','admin'));

-- The checklist every proposal starts with. Edit this list to change it for new proposals (existing ones keep theirs).
-- "Required" items must be done, or marked not needed with a reason, before an admin can approve.
create or replace function default_checklist() returns table (label text, required boolean, sort int)
language sql immutable set search_path = pg_catalog as $$
  values ('Venue or room confirmed', true, 1),
         ('University or faculty permission (mark "not needed", with a reason, if none is required)', true, 2),
         ('Budget source confirmed (or no budget needed)', true, 3),
         ('Volunteers assigned', true, 4),
         ('Attendance plan: how we will record who came', true, 5),
         ('Registration page ready (Luma or similar)', false, 6),
         ('Announcement drafted', false, 7),
         ('Post-event recap assigned to someone', false, 8)
$$;

-- Does the signed-in person own this proposal, or hold the admin role? Internal.
create or replace function can_edit_proposal(p_id bigint) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from event_proposals e where e.id = p_id and (my_role() = 'admin' or (e.proposed_by = auth.uid() and my_role() in ('core','admin'))))
$$;
revoke execute on function can_edit_proposal(bigint) from public, anon, authenticated;

create or replace function create_proposal(p_title text, p_kind text, p_date date, p_venue text, p_objective text, p_expected int, p_budget int)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare pid bigint;
begin
  if my_role() not in ('core','admin') then return json_build_object('ok', false, 'error', 'Only the core team can propose events.'); end if;
  if p_date is null or p_date < today_ist() then return json_build_object('ok', false, 'error', 'Pick a date that is today or later.'); end if;
  insert into event_proposals (title, kind, proposed_by, proposed_date, venue, objective, expected_attendance, budget_inr)
  values (trim(p_title), coalesce(p_kind, 'workshop'), auth.uid(), p_date, trim(p_venue), trim(p_objective), p_expected, p_budget) returning id into pid;
  insert into proposal_checklist_items (proposal_id, label, required, sort) select pid, d.label, d.required, d.sort from default_checklist() d;
  perform crm_log('proposal_created', 'proposal', pid::text, '{}');
  return json_build_object('ok', true, 'id', pid);
exception when check_violation then return json_build_object('ok', false, 'error', 'Check the title (3+ characters), venue, a goal of at least 10 characters, and the numbers.');
end $$;

create or replace function update_proposal(p_id bigint, p_title text, p_kind text, p_date date, p_venue text, p_objective text, p_expected int, p_budget int)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare e event_proposals;
begin
  select * into e from event_proposals where id = p_id for update;
  if not found or not can_edit_proposal(p_id) or e.proposed_by is distinct from auth.uid() then return json_build_object('ok', false, 'error', 'Only the person who proposed it can edit it.'); end if;
  if e.status not in ('draft','returned') then return json_build_object('ok', false, 'error', 'A proposal can be edited while it is a draft or after it was returned.'); end if;
  if p_date is null or p_date < today_ist() then return json_build_object('ok', false, 'error', 'Pick a date that is today or later.'); end if;
  update event_proposals set title = trim(p_title), kind = coalesce(p_kind, kind), proposed_date = p_date, venue = trim(p_venue), objective = trim(p_objective),
         expected_attendance = p_expected, budget_inr = p_budget, updated_at = now() where id = p_id;
  perform crm_log('proposal_updated', 'proposal', p_id::text, '{}');
  return json_build_object('ok', true);
exception when check_violation then return json_build_object('ok', false, 'error', 'Check the title (3+ characters), venue, a goal of at least 10 characters, and the numbers.');
end $$;

create or replace function submit_proposal(p_id bigint) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare e event_proposals;
begin
  select * into e from event_proposals where id = p_id for update;
  if not found or e.proposed_by is distinct from auth.uid() or my_role() not in ('core','admin') then return json_build_object('ok', false, 'error', 'Only the person who proposed it can submit it.'); end if;
  if e.status not in ('draft','returned') then return json_build_object('ok', false, 'error', 'A ' || e.status || ' proposal can''t be submitted.'); end if;
  if e.proposed_date < today_ist() then return json_build_object('ok', false, 'error', 'The date has passed. Edit the proposal first.'); end if;
  update event_proposals set status = 'submitted', updated_at = now() where id = p_id;
  perform crm_log('proposal_submitted', 'proposal', p_id::text, jsonb_build_object('from', e.status));
  return json_build_object('ok', true);
end $$;

-- Admin only, and never the proposer. submitted → approved | returned | rejected. Returning or rejecting needs a reason;
-- approving is refused while any required checklist item is still open.
create or replace function decide_proposal(p_id bigint, p_decision text, p_note text default '') returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare e event_proposals; why text := nullif(trim(coalesce(p_note, '')), ''); open_items int;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins approve events.'); end if;
  select * into e from event_proposals where id = p_id for update;
  if not found then return json_build_object('ok', false, 'error', 'Proposal not found.'); end if;
  if e.proposed_by is not distinct from auth.uid() then return json_build_object('ok', false, 'error', 'You can''t decide your own proposal. Ask another admin.'); end if;
  if e.status <> 'submitted' then return json_build_object('ok', false, 'error', 'Only a submitted proposal can be decided (this one is ' || e.status || ').'); end if;
  if p_decision is null or p_decision not in ('approved','returned','rejected') then return json_build_object('ok', false, 'error', 'Pick approve, return or reject.'); end if;
  if p_decision in ('returned','rejected') and (why is null or length(why) < 3) then return json_build_object('ok', false, 'error', 'Say why, so the proposer knows what to do next.'); end if;
  if why is not null and length(why) > 1000 then return json_build_object('ok', false, 'error', 'Keep the note under 1000 characters.'); end if;
  if p_decision = 'approved' then
    select count(*) into open_items from proposal_checklist_items where proposal_id = p_id and required and state = 'open';
    if open_items > 0 then return json_build_object('ok', false, 'error', open_items || ' required checklist ' || case when open_items = 1 then 'item is' else 'items are' end || ' still open. Each must be done, or marked not needed with a reason.'); end if;
  end if;
  update event_proposals set status = p_decision, decided_by = auth.uid(), decided_at = now(), decision_note = why, updated_at = now() where id = p_id;
  perform crm_log('proposal_' || p_decision, 'proposal', p_id::text, '{}');
  return json_build_object('ok', true);
end $$;

-- Withdraw a proposal: the proposer or an admin. draft | submitted | returned | approved → cancelled.
create or replace function cancel_proposal(p_id bigint, p_reason text default '') returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare e event_proposals;
begin
  select * into e from event_proposals where id = p_id for update;
  if not found or not can_edit_proposal(p_id) then return json_build_object('ok', false, 'error', 'Only the proposer or an admin can cancel it.'); end if;
  if e.status not in ('draft','submitted','returned','approved') then return json_build_object('ok', false, 'error', 'A ' || e.status || ' proposal can''t be cancelled.'); end if;
  update event_proposals set status = 'cancelled', decision_note = coalesce(nullif(left(trim(coalesce(p_reason, '')), 1000), ''), decision_note), updated_at = now() where id = p_id;
  perform crm_log('proposal_cancelled', 'proposal', p_id::text, jsonb_build_object('from', e.status));
  return json_build_object('ok', true);
end $$;

-- After the event: what happened, and where attendance was recorded (the date of the event in the attendance table) or why not.
create or replace function complete_proposal(p_id bigint, p_outcome text, p_attendance_event text default null, p_attendance_note text default '') returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare e event_proposals; out text := trim(coalesce(p_outcome, '')); att text := nullif(trim(coalesce(p_attendance_event, '')), ''); an text := nullif(trim(coalesce(p_attendance_note, '')), '');
begin
  select * into e from event_proposals where id = p_id for update;
  if not found or not can_edit_proposal(p_id) then return json_build_object('ok', false, 'error', 'Only the proposer or an admin can complete it.'); end if;
  if e.status <> 'approved' then return json_build_object('ok', false, 'error', 'Only an approved event can be completed (this one is ' || e.status || ').'); end if;
  if length(out) < 20 then return json_build_object('ok', false, 'error', 'Write a short outcome: what happened, in at least a sentence.'); end if;
  if length(out) > 2000 then return json_build_object('ok', false, 'error', 'Keep the outcome under 2000 characters.'); end if;
  if att is not null then
    if not exists (select 1 from attendance where event = att) then return json_build_object('ok', false, 'error', 'No attendance has been recorded for that event yet. Add it under Attendance, or explain why there is none.'); end if;
  elsif an is null or length(an) < 10 then
    return json_build_object('ok', false, 'error', 'Link the attendance you recorded, or say in a sentence why there is none.');
  end if;
  update event_proposals set status = 'completed', outcome_note = out, attendance_event = att, attendance_note = left(an, 500), updated_at = now() where id = p_id;
  perform crm_log('proposal_completed', 'proposal', p_id::text, '{}');
  return json_build_object('ok', true);
end $$;

-- Tick a checklist item: open | done | na (not needed: needs a reason). The proposer or an admin, until it is closed.
create or replace function set_checklist_item(p_item bigint, p_state text, p_note text default '') returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare i proposal_checklist_items; e event_proposals; n text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into i from proposal_checklist_items where id = p_item for update;
  if not found or not can_edit_proposal(i.proposal_id) then return json_build_object('ok', false, 'error', 'Only the proposer or an admin can change the checklist.'); end if;
  select * into e from event_proposals where id = i.proposal_id;
  if e.status not in ('draft','submitted','returned','approved') then return json_build_object('ok', false, 'error', 'This proposal is closed.'); end if;
  if p_state is null or p_state not in ('open','done','na') then return json_build_object('ok', false, 'error', 'Pick open, done or not needed.'); end if;
  if p_state = 'na' and (n is null or length(n) < 3) then return json_build_object('ok', false, 'error', 'Say why it isn''t needed.'); end if;
  if n is not null and length(n) > 300 then return json_build_object('ok', false, 'error', 'Keep the note under 300 characters.'); end if;
  update proposal_checklist_items set state = p_state, note = n, updated_by = auth.uid(), updated_at = now() where id = p_item;
  update event_proposals set updated_at = now() where id = i.proposal_id;
  perform crm_log('checklist_changed', 'proposal', i.proposal_id::text, jsonb_build_object('item', p_item, 'state', p_state));
  return json_build_object('ok', true);
end $$;

-- Once the public page exists, record its address (the part after /events/) so the proposal and the page point at each other.
create or replace function link_proposal_event(p_id bigint, p_slug text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare e event_proposals; s text := nullif(lower(trim(coalesce(p_slug, ''))), '');
begin
  select * into e from event_proposals where id = p_id for update;
  if not found or not can_edit_proposal(p_id) then return json_build_object('ok', false, 'error', 'Only the proposer or an admin can do that.'); end if;
  if e.status not in ('approved','completed') then return json_build_object('ok', false, 'error', 'Link the page once the proposal is approved.'); end if;
  if s is not null and (s !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(s) > 120) then return json_build_object('ok', false, 'error', 'Use the page address only, like git-merge-26.'); end if;
  update event_proposals set event_slug = s, updated_at = now() where id = p_id;
  perform crm_log('proposal_linked', 'proposal', p_id::text, '{}');
  return json_build_object('ok', true);
end $$;

revoke execute on function create_proposal(text, text, date, text, text, int, int), update_proposal(bigint, text, text, date, text, text, int, int), submit_proposal(bigint),
  decide_proposal(bigint, text, text), cancel_proposal(bigint, text), complete_proposal(bigint, text, text, text), set_checklist_item(bigint, text, text), link_proposal_event(bigint, text) from public, anon;
grant execute on function create_proposal(text, text, date, text, text, int, int), update_proposal(bigint, text, text, date, text, text, int, int), submit_proposal(bigint),
  decide_proposal(bigint, text, text), cancel_proposal(bigint, text), complete_proposal(bigint, text, text, text), set_checklist_item(bigint, text, text), link_proposal_event(bigint, text) to authenticated;

-- ============================================================
-- Tasks, meetings, minutes and the decisions register (admin → Tasks, Meetings & decisions).
-- A task has one owner and a due date from the moment it exists. A meeting has an agenda, attendees and minutes; once the
-- minutes are finalised they never change (a correction is a new note beside them). Decisions are only ever added: to
-- change one, an admin records a new decision that supersedes it, and both stay on the record. Action items from a
-- meeting are ordinary tasks that point at the meeting. Nothing is written directly; every change is a function below
-- and is logged in crm_audit (ids and states only).
-- ============================================================
create table if not exists meetings (
  id bigint generated always as identity primary key,
  title text not null check (length(trim(title)) between 3 and 120),
  held_on date not null,
  kind text not null default 'core' check (kind in ('core','general','planning','review','other')),
  agenda text check (agenda is null or length(agenda) <= 3000),
  minutes text check (minutes is null or length(minutes) <= 10000),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  minutes_finalised_at timestamptz
);
create table if not exists meeting_attendees (
  meeting_id bigint not null references meetings on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  primary key (meeting_id, user_id)
);
create table if not exists meeting_notes ( -- corrections and additions to finalised minutes
  id bigint generated always as identity primary key,
  meeting_id bigint not null references meetings on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  note text not null check (length(trim(note)) between 3 and 2000),
  created_at timestamptz not null default now()
);
create table if not exists decisions (
  id bigint generated always as identity primary key,
  meeting_id bigint references meetings on delete set null,
  title text not null check (length(trim(title)) between 3 and 140),
  decision text not null check (length(trim(decision)) between 3 and 2000),
  rationale text check (rationale is null or length(rationale) <= 2000),
  decided_on date not null,
  recorded_by uuid references profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active','superseded')),
  supersedes_id bigint references decisions,
  created_at timestamptz not null default now()
);
create unique index if not exists decisions_one_successor on decisions (supersedes_id) where supersedes_id is not null;
create table if not exists tasks (
  id bigint generated always as identity primary key,
  title text not null check (length(trim(title)) between 3 and 140),
  details text check (details is null or length(details) <= 2000),
  owner_id uuid not null references profiles(id),
  creator_id uuid not null references profiles(id),
  due_on date not null,
  status text not null default 'todo' check (status in ('todo','doing','blocked','done','dropped')),
  proposal_id bigint references event_proposals on delete set null,
  meeting_id bigint references meetings on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists tasks_owner on tasks (owner_id, status, due_on);
alter table meetings enable row level security;
alter table meeting_attendees enable row level security;
alter table meeting_notes enable row level security;
alter table decisions enable row level security;
alter table tasks enable row level security;
revoke insert, update, delete on meetings, meeting_attendees, meeting_notes, decisions, tasks from anon, authenticated;
drop policy if exists "core and admins read meetings" on meetings;
create policy "core and admins read meetings" on meetings for select using (my_role() in ('core','admin'));
drop policy if exists "core and admins read attendees" on meeting_attendees;
create policy "core and admins read attendees" on meeting_attendees for select using (my_role() in ('core','admin'));
drop policy if exists "core and admins read meeting notes" on meeting_notes;
create policy "core and admins read meeting notes" on meeting_notes for select using (my_role() in ('core','admin'));
drop policy if exists "core and admins read decisions" on decisions;
create policy "core and admins read decisions" on decisions for select using (my_role() in ('core','admin'));
drop policy if exists "core and admins read tasks" on tasks;
create policy "core and admins read tasks" on tasks for select using (my_role() in ('core','admin'));

-- A decision's words never change, and none is ever deleted. The only edit is the one supersede_decision makes: active → superseded.
create or replace function decisions_guard() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and current_setting('club.superseding', true) = 'on' and old.status = 'active' and new.status = 'superseded'
     and (new.id, new.title, new.decision, new.rationale, new.decided_on, new.meeting_id, new.recorded_by, new.supersedes_id) is not distinct from (old.id, old.title, old.decision, old.rationale, old.decided_on, old.meeting_id, old.recorded_by, old.supersedes_id) then
    return new;
  end if;
  raise exception 'decisions are never changed or deleted; record a new one that supersedes it';
end $$;
drop trigger if exists decisions_guard on decisions;
create trigger decisions_guard before update or delete on decisions for each row execute function decisions_guard();

-- Finalised minutes never change.
create or replace function meetings_guard() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then raise exception 'meetings are kept'; end if;
  if old.minutes_finalised_at is not null and (new.minutes is distinct from old.minutes or new.minutes_finalised_at is distinct from old.minutes_finalised_at or new.held_on is distinct from old.held_on) then
    raise exception 'finalised minutes can''t be changed; add a note instead';
  end if;
  return new;
end $$;
drop trigger if exists meetings_guard on meetings;
create trigger meetings_guard before update or delete on meetings for each row execute function meetings_guard();

-- Can this person own tasks? They must hold an active core or admin appointment today. Internal.
create or replace function can_own_tasks(p_uid uuid) returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select role_of(p_uid) in ('core','admin')
$$;
revoke execute on function can_own_tasks(uuid) from public, anon, authenticated;

-- ---- tasks ----
create or replace function create_task(p_title text, p_details text, p_owner_handle text, p_due_on date, p_proposal bigint default null, p_meeting bigint default null)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare o uuid; tid bigint;
begin
  if my_role() not in ('core','admin') then return json_build_object('ok', false, 'error', 'Only the core team can create tasks.'); end if;
  if p_due_on is null or p_due_on < today_ist() then return json_build_object('ok', false, 'error', 'Pick a due date that is today or later.'); end if;
  select id into o from profiles where lower(handle) = lower(ltrim(trim(coalesce(p_owner_handle, '')), '@'));
  if o is null or not can_own_tasks(o) then return json_build_object('ok', false, 'error', 'The owner must hold a core or admin appointment, and have signed in.'); end if;
  if p_proposal is not null and not exists (select 1 from event_proposals where id = p_proposal) then return json_build_object('ok', false, 'error', 'That event proposal doesn''t exist.'); end if;
  if p_meeting is not null and not exists (select 1 from meetings where id = p_meeting) then return json_build_object('ok', false, 'error', 'That meeting doesn''t exist.'); end if;
  insert into tasks (title, details, owner_id, creator_id, due_on, proposal_id, meeting_id)
  values (trim(p_title), nullif(trim(coalesce(p_details, '')), ''), o, auth.uid(), p_due_on, p_proposal, p_meeting) returning id into tid;
  perform crm_log('task_created', 'task', tid::text, jsonb_build_object('owner', o, 'due_on', p_due_on));
  return json_build_object('ok', true, 'id', tid);
exception when check_violation then return json_build_object('ok', false, 'error', 'Give the task a title of 3 to 140 characters.');
end $$;

-- The owner, the creator or an admin moves a task along. todo | doing | blocked | done | dropped.
create or replace function set_task_status(p_id bigint, p_status text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare t tasks;
begin
  select * into t from tasks where id = p_id for update;
  if not found or my_role() not in ('core','admin') or not (t.owner_id = auth.uid() or t.creator_id = auth.uid() or my_role() = 'admin') then
    return json_build_object('ok', false, 'error', 'Only the owner, the creator or an admin can change this task.');
  end if;
  if p_status is null or p_status not in ('todo','doing','blocked','done','dropped') then return json_build_object('ok', false, 'error', 'Pick todo, doing, blocked, done or dropped.'); end if;
  update tasks set status = p_status, updated_at = now(), completed_at = case when p_status = 'done' then coalesce(completed_at, now()) else null end where id = p_id;
  perform crm_log('task_status', 'task', p_id::text, jsonb_build_object('from', t.status, 'to', p_status));
  return json_build_object('ok', true);
end $$;

-- The creator or an admin changes the owner or the due date.
create or replace function reassign_task(p_id bigint, p_owner_handle text default null, p_due_on date default null) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare t tasks; o uuid;
begin
  select * into t from tasks where id = p_id for update;
  if not found or my_role() not in ('core','admin') or not (t.creator_id = auth.uid() or my_role() = 'admin') then
    return json_build_object('ok', false, 'error', 'Only the creator or an admin can reassign this task or change its date.');
  end if;
  if p_owner_handle is not null then
    select id into o from profiles where lower(handle) = lower(ltrim(trim(p_owner_handle), '@'));
    if o is null or not can_own_tasks(o) then return json_build_object('ok', false, 'error', 'The owner must hold a core or admin appointment, and have signed in.'); end if;
  end if;
  if p_due_on is not null and p_due_on < today_ist() then return json_build_object('ok', false, 'error', 'Pick a due date that is today or later.'); end if;
  update tasks set owner_id = coalesce(o, owner_id), due_on = coalesce(p_due_on, due_on), updated_at = now() where id = p_id;
  perform crm_log('task_reassigned', 'task', p_id::text, jsonb_build_object('owner', coalesce(o, t.owner_id), 'due_on', coalesce(p_due_on, t.due_on)));
  return json_build_object('ok', true);
end $$;

-- For the Monday digest (server key only): open tasks that are overdue, and open tasks whose owner no longer has access.
create or replace function task_warnings() returns json language sql security definer stable set search_path = public, pg_temp as $$
  select json_build_object(
    'overdue', coalesce((select json_agg(json_build_object('id', t.id, 'title', t.title, 'owner', p.handle, 'days', today_ist() - t.due_on) order by t.due_on)
                           from tasks t join profiles p on p.id = t.owner_id where t.status in ('todo','doing','blocked') and t.due_on < today_ist()), '[]'::json),
    'orphaned', coalesce((select json_agg(json_build_object('id', t.id, 'title', t.title, 'owner', p.handle) order by t.due_on)
                           from tasks t join profiles p on p.id = t.owner_id where t.status in ('todo','doing','blocked') and not can_own_tasks(t.owner_id)), '[]'::json))
$$;

-- ---- meetings ----
create or replace function create_meeting(p_title text, p_held_on date, p_kind text, p_agenda text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare mid bigint;
begin
  if my_role() not in ('core','admin') then return json_build_object('ok', false, 'error', 'Only the core team can create meetings.'); end if;
  if p_held_on is null then return json_build_object('ok', false, 'error', 'Pick the date of the meeting.'); end if;
  insert into meetings (title, held_on, kind, agenda, created_by) values (trim(p_title), p_held_on, coalesce(p_kind, 'core'), nullif(trim(coalesce(p_agenda, '')), ''), auth.uid()) returning id into mid;
  perform crm_log('meeting_created', 'meeting', mid::text, '{}');
  return json_build_object('ok', true, 'id', mid);
exception when check_violation then return json_build_object('ok', false, 'error', 'Give the meeting a title of 3 to 120 characters, and keep the agenda under 3000.');
end $$;

-- The creator or an admin edits the agenda and minutes until the minutes are finalised.
create or replace function update_meeting(p_id bigint, p_title text, p_agenda text, p_minutes text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare m meetings;
begin
  select * into m from meetings where id = p_id for update;
  if not found or my_role() not in ('core','admin') or not (m.created_by = auth.uid() or my_role() = 'admin') then return json_build_object('ok', false, 'error', 'Only the person who created the meeting or an admin can edit it.'); end if;
  if m.minutes_finalised_at is not null then return json_build_object('ok', false, 'error', 'The minutes are final. Add a note instead.'); end if;
  update meetings set title = trim(p_title), agenda = nullif(trim(coalesce(p_agenda, '')), ''), minutes = nullif(trim(coalesce(p_minutes, '')), '') where id = p_id;
  perform crm_log('meeting_updated', 'meeting', p_id::text, '{}');
  return json_build_object('ok', true);
exception when check_violation then return json_build_object('ok', false, 'error', 'Give the meeting a title of 3 to 120 characters; agenda up to 3000 and minutes up to 10000.');
end $$;

create or replace function set_attendees(p_id bigint, p_handles text[]) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare m meetings; ids uuid[];
begin
  select * into m from meetings where id = p_id for update;
  if not found or my_role() not in ('core','admin') or not (m.created_by = auth.uid() or my_role() = 'admin') then return json_build_object('ok', false, 'error', 'Only the person who created the meeting or an admin can change who attended.'); end if;
  if m.minutes_finalised_at is not null then return json_build_object('ok', false, 'error', 'The minutes are final. Add a note instead.'); end if;
  if coalesce(array_length(p_handles, 1), 0) > 60 then return json_build_object('ok', false, 'error', 'That is more than 60 people.'); end if;
  select coalesce(array_agg(id), '{}') into ids from profiles where lower(handle) in (select lower(ltrim(trim(h), '@')) from unnest(coalesce(p_handles, '{}')) h);
  delete from meeting_attendees where meeting_id = p_id;
  insert into meeting_attendees (meeting_id, user_id) select p_id, u from unnest(ids) u;
  perform crm_log('attendees_set', 'meeting', p_id::text, jsonb_build_object('count', coalesce(array_length(ids, 1), 0)));
  return json_build_object('ok', true, 'count', coalesce(array_length(ids, 1), 0));
end $$;

create or replace function finalise_minutes(p_id bigint) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare m meetings;
begin
  select * into m from meetings where id = p_id for update;
  if not found or my_role() not in ('core','admin') or not (m.created_by = auth.uid() or my_role() = 'admin') then return json_build_object('ok', false, 'error', 'Only the person who created the meeting or an admin can finalise the minutes.'); end if;
  if m.minutes_finalised_at is not null then return json_build_object('ok', false, 'error', 'The minutes are already final.'); end if;
  if m.minutes is null or length(trim(m.minutes)) < 10 then return json_build_object('ok', false, 'error', 'Write the minutes first.'); end if;
  update meetings set minutes_finalised_at = now() where id = p_id;
  perform crm_log('minutes_finalised', 'meeting', p_id::text, '{}');
  return json_build_object('ok', true);
end $$;

-- A correction or addition beside final minutes. Anyone on the core team or an admin can add one; nobody can edit or remove it.
create or replace function add_minutes_note(p_id bigint, p_note text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare nid bigint;
begin
  if my_role() not in ('core','admin') then return json_build_object('ok', false, 'error', 'Only the core team can add notes.'); end if;
  if not exists (select 1 from meetings where id = p_id and minutes_finalised_at is not null) then return json_build_object('ok', false, 'error', 'Notes are for meetings whose minutes are final.'); end if;
  insert into meeting_notes (meeting_id, author_id, note) values (p_id, auth.uid(), trim(p_note)) returning id into nid;
  perform crm_log('minutes_note', 'meeting', p_id::text, jsonb_build_object('note', nid));
  return json_build_object('ok', true);
exception when check_violation then return json_build_object('ok', false, 'error', 'A note needs 3 to 2000 characters.');
end $$;

-- ---- decisions: only ever added ----
-- An admin records a decision, with or without a meeting; the person who created a meeting can record decisions made at it.
create or replace function record_decision(p_meeting bigint, p_title text, p_decision text, p_rationale text, p_decided_on date) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare did bigint; m meetings;
begin
  if my_role() not in ('core','admin') then return json_build_object('ok', false, 'error', 'Only the core team and admins record decisions.'); end if;
  if p_meeting is not null then
    select * into m from meetings where id = p_meeting;
    if not found then return json_build_object('ok', false, 'error', 'That meeting doesn''t exist.'); end if;
  end if;
  if my_role() <> 'admin' and (p_meeting is null or m.created_by is distinct from auth.uid()) then
    return json_build_object('ok', false, 'error', 'Admins record decisions; the person who created a meeting can record the ones made at it.');
  end if;
  if p_decided_on is null or p_decided_on > today_ist() then return json_build_object('ok', false, 'error', 'A decision is dated today or earlier.'); end if;
  insert into decisions (meeting_id, title, decision, rationale, decided_on, recorded_by) values (p_meeting, trim(p_title), trim(p_decision), nullif(trim(coalesce(p_rationale, '')), ''), p_decided_on, auth.uid()) returning id into did;
  perform crm_log('decision_recorded', 'decision', did::text, jsonb_build_object('meeting', p_meeting));
  return json_build_object('ok', true, 'id', did);
exception when check_violation then return json_build_object('ok', false, 'error', 'Give the decision a title (3+ characters) and the decision itself.');
end $$;

-- Replace a decision with a new one. Both stay on the record: the old is marked superseded and linked to its successor. Admins only.
create or replace function supersede_decision(p_old bigint, p_title text, p_decision text, p_rationale text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare o decisions; did bigint;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins supersede a decision.'); end if;
  select * into o from decisions where id = p_old for update;
  if not found then return json_build_object('ok', false, 'error', 'That decision doesn''t exist.'); end if;
  if o.status <> 'active' then return json_build_object('ok', false, 'error', 'That decision has already been superseded. Supersede the current one.'); end if;
  insert into decisions (meeting_id, title, decision, rationale, decided_on, recorded_by, supersedes_id) values (o.meeting_id, trim(p_title), trim(p_decision), nullif(trim(coalesce(p_rationale, '')), ''), today_ist(), auth.uid(), o.id) returning id into did;
  perform set_config('club.superseding', 'on', true);
  update decisions set status = 'superseded' where id = o.id;
  perform set_config('club.superseding', 'off', true);
  perform crm_log('decision_superseded', 'decision', o.id::text, jsonb_build_object('by', did));
  return json_build_object('ok', true, 'id', did);
exception when check_violation then return json_build_object('ok', false, 'error', 'Give the new decision a title (3+ characters) and the decision itself.');
end $$;

revoke execute on function create_task(text, text, text, date, bigint, bigint), set_task_status(bigint, text), reassign_task(bigint, text, date), create_meeting(text, date, text, text),
  update_meeting(bigint, text, text, text), set_attendees(bigint, text[]), finalise_minutes(bigint), add_minutes_note(bigint, text), record_decision(bigint, text, text, text, date), supersede_decision(bigint, text, text, text) from public, anon;
grant execute on function create_task(text, text, text, date, bigint, bigint), set_task_status(bigint, text), reassign_task(bigint, text, date), create_meeting(text, date, text, text),
  update_meeting(bigint, text, text, text), set_attendees(bigint, text[]), finalise_minutes(bigint), add_minutes_note(bigint, text), record_decision(bigint, text, text, text, date), supersede_decision(bigint, text, text, text) to authenticated;
revoke execute on function task_warnings() from public, anon, authenticated;
grant execute on function task_warnings() to service_role;

-- ============================================================
-- Digital assets and the handover checklist (admin → Assets & handover).
-- The registry says where each of the club's accounts and services lives and WHO owns it, with a second person as backup;
-- the handover checklist is the new-team checklist from docs/ROLLOVER.md, ticked in the app. A club's real risk is a
-- leaving person who took the only key with them, so the dashboard warns about assets with no owner or backup, owners whose
-- access has ended or is ending, and reviews that are overdue. NEVER put a password, token or key here: a safety net below
-- refuses text that looks like one (it is a net, not a guarantee, so don't try it). Nothing is written directly; every
-- change is a function below and is logged in crm_audit (ids and states only).
-- ============================================================
create table if not exists digital_assets (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) between 2 and 80),
  kind text not null check (kind in ('domain','hosting','repository','database','email','social','design','event_platform','other')),
  location_url text check (location_url is null or (length(location_url) <= 300 and location_url ~* '^https://[^\s@]+$')),
  owner_id uuid references profiles(id) on delete set null, -- who is answerable for it; empty = nobody yet (flagged)
  backup_owner_id uuid references profiles(id) on delete set null,
  notes text check (notes is null or length(notes) <= 1000),
  review_due_on date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists digital_assets_name on digital_assets (lower(name));
create table if not exists handover_checklists (
  id bigint generated always as identity primary key,
  term_label text not null check (length(trim(term_label)) between 4 and 30),
  status text not null default 'open' check (status in ('open','complete')),
  created_by uuid, completed_by uuid, completed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists handover_one_open on handover_checklists ((status)) where status = 'open';
create table if not exists handover_items (
  id bigint generated always as identity primary key,
  checklist_id bigint not null references handover_checklists on delete cascade,
  category text not null, label text not null check (length(label) between 3 and 200),
  state text not null default 'open' check (state in ('open','done','waived')),
  note text check (note is null or length(note) <= 300),
  sort int not null default 0, updated_by uuid, updated_at timestamptz not null default now()
);
create index if not exists handover_items_list on handover_items (checklist_id, sort);
alter table digital_assets enable row level security;
alter table handover_checklists enable row level security;
alter table handover_items enable row level security;
revoke insert, update, delete on digital_assets, handover_checklists, handover_items from anon, authenticated;
drop policy if exists "core and admins read assets" on digital_assets;
create policy "core and admins read assets" on digital_assets for select using (my_role() in ('core','admin'));
drop policy if exists "core and admins read handovers" on handover_checklists;
create policy "core and admins read handovers" on handover_checklists for select using (my_role() in ('core','admin'));
drop policy if exists "core and admins read handover items" on handover_items;
create policy "core and admins read handover items" on handover_items for select using (my_role() in ('core','admin'));

-- Does this text look like a secret? Known token prefixes, private keys, JWTs, passwords in a URL or ?key=… query, and (for free
-- text) any 32+ character run of letters and digits with no spaces. A safety net only.
create or replace function looks_like_secret(p_text text, p_strict boolean default true) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select coalesce(p_text ~* '(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|sk-[a-z0-9]|sk_live_|sk_test_|sb_secret_|xox[abprs]-|AKIA[0-9A-Z]{8}|AIza[0-9A-Za-z_-]{20}|-----BEGIN|eyJ[A-Za-z0-9_-]{10,}\.)'
    or p_text ~* '://[^/\s:@]+:[^/\s@]+@'
    or p_text ~* '[?&;](key|token|secret|password|passwd|pwd|apikey|api_key|access_token|auth)=[^&\s]{6,}'
    or (p_strict and p_text ~ '(^|[^A-Za-z0-9+/=_-])[A-Za-z0-9+/=_-]{32,}($|[^A-Za-z0-9+/=_-])'), false)
$$;

-- Everything that goes into the registry or the checklist is checked: a name, a note, a link.
create or replace function assets_text_ok(p_name text, p_url text, p_notes text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select not (looks_like_secret(p_name) or looks_like_secret(p_url, false) or looks_like_secret(p_notes))
$$;

-- The usual places the club keeps things. Names and kinds only: an admin fills in the links and chooses who owns each.
insert into digital_assets (name, kind) values
  ('Website domain', 'domain'), ('Vercel project', 'hosting'), ('Supabase project', 'database'), ('GitHub organisation', 'repository'), ('Website repository', 'repository'),
  ('Club Gmail', 'email'), ('GitHub sign-in app (OAuth)', 'other'), ('Content editor GitHub app (Keystatic)', 'other'), ('Luma calendar', 'event_platform'),
  ('WhatsApp community', 'social'), ('Instagram', 'social')
on conflict do nothing;

-- Create or change an asset. Admins only. The owner and the backup must hold a core or admin appointment, and be different people.
create or replace function save_asset(p_id bigint, p_name text, p_kind text, p_url text, p_owner text, p_backup text, p_notes text, p_review_due date) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare o uuid; b uuid; aid bigint; u text := nullif(trim(coalesce(p_url, '')), ''); n text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins edit the asset registry.'); end if;
  if not assets_text_ok(p_name, u, n) then return json_build_object('ok', false, 'error', 'That looks like a password, key or token. Never store those here: say where it is kept instead (for example "in the club password manager").'); end if;
  if nullif(trim(coalesce(p_owner, '')), '') is not null then
    select id into o from profiles where lower(handle) = lower(ltrim(trim(p_owner), '@'));
    if o is null or role_of(o) not in ('core','admin') then return json_build_object('ok', false, 'error', 'The owner must hold a core or admin appointment, and have signed in.'); end if;
  end if;
  if nullif(trim(coalesce(p_backup, '')), '') is not null then
    select id into b from profiles where lower(handle) = lower(ltrim(trim(p_backup), '@'));
    if b is null or role_of(b) not in ('core','admin') then return json_build_object('ok', false, 'error', 'The backup owner must hold a core or admin appointment, and have signed in.'); end if;
    if b is not distinct from o then return json_build_object('ok', false, 'error', 'The backup has to be a different person from the owner.'); end if;
  end if;
  if p_id is null then
    insert into digital_assets (name, kind, location_url, owner_id, backup_owner_id, notes, review_due_on) values (trim(p_name), p_kind, u, o, b, n, p_review_due) returning id into aid;
    perform crm_log('asset_created', 'asset', aid::text, '{}');
  else
    update digital_assets set name = trim(p_name), kind = p_kind, location_url = u, notes = n, review_due_on = p_review_due, updated_at = now(),
           owner_id = o, backup_owner_id = b where id = p_id returning id into aid;
    if aid is null then return json_build_object('ok', false, 'error', 'Asset not found.'); end if;
    perform crm_log('asset_updated', 'asset', aid::text, jsonb_build_object('owner', o, 'backup', b));
  end if;
  return json_build_object('ok', true, 'id', aid);
exception
  when unique_violation then return json_build_object('ok', false, 'error', 'There is already an asset with that name.');
  when check_violation then return json_build_object('ok', false, 'error', 'Check the name, the kind, and that the link starts with https://.');
end $$;

-- The owner of an asset may update its notes (where it is kept, how to get in); an admin may too.
create or replace function set_asset_notes(p_id bigint, p_notes text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare a digital_assets; n text := nullif(trim(coalesce(p_notes, '')), '');
begin
  select * into a from digital_assets where id = p_id for update;
  if not found or my_role() not in ('core','admin') or not (my_role() = 'admin' or a.owner_id = auth.uid()) then return json_build_object('ok', false, 'error', 'Only an admin or the asset''s owner can change its notes.'); end if;
  if not assets_text_ok(null, null, n) then return json_build_object('ok', false, 'error', 'That looks like a password, key or token. Never store those here: say where it is kept instead.'); end if;
  update digital_assets set notes = n, updated_at = now() where id = p_id;
  perform crm_log('asset_notes', 'asset', p_id::text, '{}');
  return json_build_object('ok', true);
exception when check_violation then return json_build_object('ok', false, 'error', 'Keep the notes under 1000 characters.');
end $$;

-- Problems with the registry: who owns what, and whether they still can. Shared by the dashboard and the Monday digest.
create or replace function asset_problems() returns json language sql security definer stable set search_path = public, pg_temp as $$
  select coalesce(json_agg(json_build_object('id', a.id, 'name', a.name, 'problem', x.problem, 'days', x.days) order by a.name, x.problem), '[]'::json)
  from digital_assets a
  cross join lateral (
    select 'no_owner' as problem, null::int as days where a.owner_id is null
    union all select 'no_backup', null where a.owner_id is not null and a.backup_owner_id is null
    union all select 'owner_access_ended', null where a.owner_id is not null and role_of(a.owner_id) not in ('core','admin')
    union all select 'owner_access_ends', (e.ends_on - today_ist()) from (
        select max(ap.ends_on) as ends_on from appointments ap where ap.user_id = a.owner_id and ap.role in ('core','admin') and ap.revoked_at is null and ap.starts_on <= today_ist() and ap.ends_on >= today_ist()) e
      where a.owner_id is not null and role_of(a.owner_id) in ('core','admin') and e.ends_on <= today_ist() + 30
    union all select 'review_overdue', (today_ist() - a.review_due_on) where a.review_due_on is not null and a.review_due_on < today_ist()
  ) x
$$;
create or replace function asset_warnings() returns json language sql security definer stable set search_path = public, pg_temp as $$
  select case when my_role() in ('core','admin') then asset_problems() else '[]'::json end
$$;
revoke execute on function asset_problems() from public, anon, authenticated;

-- ---- the handover checklist (from docs/ROLLOVER.md) ----
create or replace function default_handover() returns table (category text, label text, sort int) language sql immutable set search_path = pg_catalog as $$
  values
  ('1. Keys', 'New leads are maintainers of the GitHub organisation and the website repository', 10),
  ('1. Keys', 'New leads are members of the Vercel project and the Supabase project', 11),
  ('1. Keys', 'New leads can use the club Gmail (or Resend), Luma, WhatsApp and Instagram', 12),
  ('1. Keys', 'New admins are appointed under People & roles, before the old terms end', 13),
  ('1. Keys', 'At least two people can act as admin, and two people hold the keys to the domain, Vercel, Supabase, GitHub and the club Gmail', 14),
  ('2. The club year', 'Club year changed in the content editor; join link, club email, Luma calendars and social links still work', 20),
  ('3. The team', 'People leaving are moved to Mentors (with a "Before" line) or to Contributors', 30),
  ('3. The team', 'New leads and members added to the Team, only with their agreement', 31),
  ('4. Events', 'Last year''s events and recaps kept; the new year''s events proposed and added', 40),
  ('4. Events', 'Home page numbers are real; old announcements removed; a welcome update posted', 41),
  ('5. Epoch', 'Epoch month, dates, venue, start and end times, ticket price and link, sponsors and schedule updated', 50),
  ('5. Epoch', 'Last year''s Epoch data cleared (the SQL in docs/ROLLOVER.md)', 51),
  ('6. Memories', 'The year''s photos prepared and its chapter added to Memories', 60),
  ('7. Secrets', 'Changed: Gmail app password, CRON_SECRET, RATE_LIMIT_SALT, GitHub client secret, database password, backup passphrase, Supabase service key; then redeployed', 70),
  ('7. Secrets', 'People who left removed from GitHub, Vercel, Supabase and the club Gmail, and their access ended under People & roles', 71),
  ('8. Check it', 'Home page, an event page, /epoch and /privacy checked on a phone; GitHub Actions are green', 80),
  ('8. Check it', 'Every asset in the registry has an owner and a backup who still have access', 81),
  ('8. Check it', 'A backup was restored into a scratch project this year (docs/RESTORE.md)', 82),
  ('8. Check it', 'Privacy page date updated if anything about what we collect changed', 83)
$$;

create or replace function start_handover(p_term text) returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare cid bigint; t text := trim(coalesce(p_term, ''));
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins run the handover.'); end if;
  if length(t) not between 4 and 30 then return json_build_object('ok', false, 'error', 'Name the term the team is handing over to, like 2027-28.'); end if;
  if exists (select 1 from handover_checklists where status = 'open') then return json_build_object('ok', false, 'error', 'A handover is already in progress. Finish it first.'); end if;
  insert into handover_checklists (term_label, created_by) values (t, auth.uid()) returning id into cid;
  insert into handover_items (checklist_id, category, label, sort) select cid, d.category, d.label, d.sort from default_handover() d;
  perform crm_log('handover_started', 'handover', cid::text, '{}');
  return json_build_object('ok', true, 'id', cid);
end $$;

create or replace function set_handover_item(p_item bigint, p_state text, p_note text default '') returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare i handover_items; n text := nullif(trim(coalesce(p_note, '')), '');
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins run the handover.'); end if;
  select * into i from handover_items where id = p_item for update;
  if not found then return json_build_object('ok', false, 'error', 'Item not found.'); end if;
  if (select status from handover_checklists where id = i.checklist_id) <> 'open' then return json_build_object('ok', false, 'error', 'This handover is complete.'); end if;
  if p_state is null or p_state not in ('open','done','waived') then return json_build_object('ok', false, 'error', 'Pick open, done or waived.'); end if;
  if p_state = 'waived' and (n is null or length(n) < 3) then return json_build_object('ok', false, 'error', 'Say why it is waived.'); end if;
  if not assets_text_ok(null, null, n) then return json_build_object('ok', false, 'error', 'That looks like a password, key or token. Never store those here.'); end if;
  update handover_items set state = p_state, note = n, updated_by = auth.uid(), updated_at = now() where id = p_item;
  perform crm_log('handover_item', 'handover', i.checklist_id::text, jsonb_build_object('item', p_item, 'state', p_state));
  return json_build_object('ok', true);
exception when check_violation then return json_build_object('ok', false, 'error', 'Keep the note under 300 characters.');
end $$;

create or replace function complete_handover(p_id bigint) returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare open_items int;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins complete the handover.'); end if;
  perform 1 from handover_checklists where id = p_id and status = 'open' for update;
  if not found then return json_build_object('ok', false, 'error', 'That handover isn''t in progress.'); end if;
  select count(*) into open_items from handover_items where checklist_id = p_id and state = 'open';
  if open_items > 0 then return json_build_object('ok', false, 'error', open_items || ' ' || case when open_items = 1 then 'item is' else 'items are' end || ' still open. Each must be done, or waived with a reason.'); end if;
  update handover_checklists set status = 'complete', completed_by = auth.uid(), completed_at = now() where id = p_id;
  perform crm_log('handover_completed', 'handover', p_id::text, '{}');
  return json_build_object('ok', true);
end $$;

-- Digest: the same problems, for the server key.
create or replace function asset_problems_for_digest() returns json language sql security definer stable set search_path = public, pg_temp as $$ select asset_problems() $$;

revoke execute on function save_asset(bigint, text, text, text, text, text, text, date), set_asset_notes(bigint, text), asset_warnings(), start_handover(text), set_handover_item(bigint, text, text), complete_handover(bigint) from public, anon;
grant execute on function save_asset(bigint, text, text, text, text, text, text, date), set_asset_notes(bigint, text), asset_warnings(), start_handover(text), set_handover_item(bigint, text, text), complete_handover(bigint) to authenticated;
revoke execute on function asset_problems_for_digest() from public, anon, authenticated;
grant execute on function asset_problems_for_digest() to service_role;

-- ============================================================
-- Policies: the club's own rules (charter, code of conduct, how decisions are made...) as a small registry, not an engine.
-- A policy is a name with an owner; its words live in versions. A version is written as a draft, and only published when
-- a SECOND admin (never the person who wrote the draft) approves it. A published version is never edited or deleted:
-- a change is a new version, and the old ones stay. Policies are internal and live only here; to make one public, publish it
-- deliberately as site content. Nothing is written directly; every change is a function below, logged in crm_audit.
-- The club writes the policies; nothing is seeded.
-- ============================================================
create table if not exists policies (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  title text not null check (length(trim(title)) between 3 and 120),
  owner_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists policy_versions (
  id bigint generated always as identity primary key,
  policy_id bigint not null references policies,
  version int not null check (version >= 1),
  body_md text not null check (length(trim(body_md)) between 10 and 50000),
  author_id uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  approved_on date not null default today_ist(),
  effective_on date not null,
  review_due_on date not null,
  unique (policy_id, version),
  check (review_due_on > effective_on)
);
create table if not exists policy_drafts ( -- the words being written; one per policy, replaced by each save
  policy_id bigint primary key references policies on delete cascade,
  body_md text not null check (length(trim(body_md)) between 10 and 50000),
  author_id uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table policies enable row level security;
alter table policy_versions enable row level security;
alter table policy_drafts enable row level security;
revoke insert, update, delete on policies, policy_versions, policy_drafts from anon, authenticated;
drop policy if exists "core and admins read policies" on policies;
create policy "core and admins read policies" on policies for select using (my_role() in ('core','admin'));
drop policy if exists "core and admins read policy versions" on policy_versions;
create policy "core and admins read policy versions" on policy_versions for select using (my_role() in ('core','admin'));
drop policy if exists "admins read policy drafts" on policy_drafts;
create policy "admins read policy drafts" on policy_drafts for select using (my_role() = 'admin');

-- A published version is never changed or removed, even by the database owner.
create or replace function policy_versions_guard() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'a published policy version is never changed or deleted; publish a new version'; end $$;
drop trigger if exists policy_versions_guard on policy_versions;
create trigger policy_versions_guard before update or delete on policy_versions for each row execute function policy_versions_guard();

create or replace function create_policy(p_slug text, p_title text, p_owner text default null) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare o uuid; pid bigint;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins manage policies.'); end if;
  if nullif(trim(coalesce(p_owner, '')), '') is not null then
    select id into o from profiles where lower(handle) = lower(ltrim(trim(p_owner), '@'));
    if o is null or role_of(o) not in ('core','admin') then return json_build_object('ok', false, 'error', 'The owner must hold a core or admin appointment, and have signed in.'); end if;
  end if;
  insert into policies (slug, title, owner_id) values (lower(trim(p_slug)), trim(p_title), o) returning id into pid;
  perform crm_log('policy_created', 'policy', pid::text, '{}');
  return json_build_object('ok', true, 'id', pid);
exception
  when unique_violation then return json_build_object('ok', false, 'error', 'There is already a policy with that short name.');
  when check_violation then return json_build_object('ok', false, 'error', 'Use a short name of lower-case letters, numbers and dashes (like code-of-conduct) and a title of 3 to 120 characters.');
end $$;

create or replace function set_policy_owner(p_id bigint, p_owner text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare o uuid;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins manage policies.'); end if;
  select id into o from profiles where lower(handle) = lower(ltrim(trim(coalesce(p_owner, '')), '@'));
  if o is null or role_of(o) not in ('core','admin') then return json_build_object('ok', false, 'error', 'The owner must hold a core or admin appointment, and have signed in.'); end if;
  update policies set owner_id = o where id = p_id;
  if not found then return json_build_object('ok', false, 'error', 'Policy not found.'); end if;
  perform crm_log('policy_owner', 'policy', p_id::text, jsonb_build_object('owner', o));
  return json_build_object('ok', true);
end $$;

-- Write or replace the draft of the next version. Any admin; the draft remembers who wrote it last.
create or replace function save_policy_draft(p_id bigint, p_body text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins write policies.'); end if;
  if not exists (select 1 from policies where id = p_id) then return json_build_object('ok', false, 'error', 'Policy not found.'); end if;
  insert into policy_drafts (policy_id, body_md, author_id) values (p_id, trim(p_body), auth.uid())
  on conflict (policy_id) do update set body_md = excluded.body_md, author_id = excluded.author_id, updated_at = now();
  perform crm_log('policy_draft', 'policy', p_id::text, '{}');
  return json_build_object('ok', true);
exception when check_violation then return json_build_object('ok', false, 'error', 'A policy needs at least a sentence, and at most 50000 characters.');
end $$;

create or replace function discard_policy_draft(p_id bigint) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins write policies.'); end if;
  delete from policy_drafts where policy_id = p_id;
  perform crm_log('policy_draft_discarded', 'policy', p_id::text, '{}');
  return json_build_object('ok', true);
end $$;

-- Publish the draft as the next version. The approver (the person pressing the button) must be a different admin from the
-- person who last edited the draft. Then it is final.
create or replace function publish_policy_version(p_id bigint, p_effective_on date, p_review_due_on date) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare d policy_drafts; v int;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins publish policies.'); end if;
  perform 1 from policies where id = p_id for update;
  if not found then return json_build_object('ok', false, 'error', 'Policy not found.'); end if;
  select * into d from policy_drafts where policy_id = p_id for update;
  if not found then return json_build_object('ok', false, 'error', 'There is no draft to publish.'); end if;
  if d.author_id is not distinct from auth.uid() then return json_build_object('ok', false, 'error', 'You wrote this draft, so another admin has to approve and publish it.'); end if;
  if p_effective_on is null or p_effective_on < today_ist() then return json_build_object('ok', false, 'error', 'The policy takes effect today or later.'); end if;
  if p_review_due_on is null or p_review_due_on <= p_effective_on or p_review_due_on > p_effective_on + 1100 then return json_build_object('ok', false, 'error', 'Set a review date after it takes effect, within 3 years.'); end if;
  select coalesce(max(version), 0) + 1 into v from policy_versions where policy_id = p_id;
  insert into policy_versions (policy_id, version, body_md, author_id, approved_by, effective_on, review_due_on) values (p_id, v, d.body_md, d.author_id, auth.uid(), p_effective_on, p_review_due_on);
  delete from policy_drafts where policy_id = p_id;
  perform crm_log('policy_published', 'policy', p_id::text, jsonb_build_object('version', v));
  return json_build_object('ok', true, 'version', v);
end $$;

-- For the Monday digest (server key only): policies whose latest version is past its review date.
create or replace function policy_reviews_due() returns json language sql security definer stable set search_path = public, pg_temp as $$
  select coalesce(json_agg(json_build_object('id', p.id, 'title', p.title, 'days', today_ist() - v.review_due_on) order by v.review_due_on), '[]'::json)
  from policies p join lateral (select review_due_on from policy_versions where policy_id = p.id order by version desc limit 1) v on true
  where v.review_due_on < today_ist()
$$;

revoke execute on function create_policy(text, text, text), set_policy_owner(bigint, text), save_policy_draft(bigint, text), discard_policy_draft(bigint), publish_policy_version(bigint, date, date) from public, anon;
grant execute on function create_policy(text, text, text), set_policy_owner(bigint, text), save_policy_draft(bigint, text), discard_policy_draft(bigint), publish_policy_version(bigint, date, date) to authenticated;
revoke execute on function policy_reviews_due() from public, anon, authenticated;
grant execute on function policy_reviews_due() to service_role;

-- ============================================================
-- Project hub (the /hub page for members, Admin → Projects for the core team, and /projects for everyone).
-- 1. Interest survey: every active member can say which areas they like, their skills, and what they'd like to build.
--    Their answers are private: the core team and admins see them to plan projects; other members only see counts, plus the
--    people who ticked "let teammates find me".
-- 2. Project ideas: members post ideas, others ask to join, the owner accepts. The core team can post club projects that
--    everyone can join, based on what the survey shows.
-- 3. The website: a team asks to be featured; a core or admin who is NOT the owner reviews it. Only then does it appear on
--    /projects, with GitHub names only for the members who agreed. Editing a featured project sends it back for review.
-- Who takes part: active members (see Members) and the core team. Nothing is written directly; every change is a function
-- below, logged in crm_audit (ids and states only).
-- ============================================================
create or replace function domain_list() returns text[] language sql immutable set search_path = pg_catalog as $$
  select array['web','mobile','ai-ml','data','cloud-devops','security','game-dev','design-ux','open-source','hardware-iot','other']
$$;

-- Tidy a list of tags (skills): lower-case, trimmed, no repeats, 2 to 24 characters of letters, digits and + # . - space.
create or replace function clean_tags(p_in text[], p_max int) returns text[] language plpgsql immutable set search_path = pg_catalog as $$
declare t text; out text[] := '{}';
begin
  foreach t in array coalesce(p_in, '{}') loop
    t := lower(btrim(t));
    if t = '' then continue; end if;
    if t !~ '^[a-z0-9][a-z0-9+#. -]{1,23}$' then raise exception 'bad tag'; end if;
    if not (t = any(out)) then out := out || t; end if;
  end loop;
  if cardinality(out) > p_max then raise exception 'too many tags'; end if;
  return out;
end $$;

create or replace function clean_domains(p_in text[], p_min int, p_max int) returns text[] language plpgsql immutable set search_path = pg_catalog, public as $$
declare d text; out text[] := '{}';
begin
  foreach d in array coalesce(p_in, '{}') loop
    if not (d = any(domain_list())) then raise exception 'bad domain'; end if;
    if not (d = any(out)) then out := out || d; end if;
  end loop;
  if cardinality(out) < p_min or cardinality(out) > p_max then raise exception 'bad domain count'; end if;
  return out;
end $$;

-- Members and the core team take part. Used by the policies below (signed-in users only).
create or replace function can_take_part() returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select my_role() in ('core','admin') or exists (select 1 from members m where m.user_id = auth.uid() and m.status = 'active')
$$;

create table if not exists member_interests (
  user_id uuid primary key references profiles(id) on delete cascade,
  domains text[] not null check (cardinality(domains) between 1 and 5),
  skills text[] not null default '{}' check (cardinality(skills) <= 8),
  wants text check (wants is null or length(wants) <= 280),
  hours text check (hours is null or hours in ('1-2','3-5','6+')),
  discoverable boolean not null default false, -- true = other members may find them by skill
  updated_at timestamptz not null default now()
);
create table if not exists project_ideas (
  id bigint generated always as identity primary key,
  title text not null check (length(trim(title)) between 3 and 100),
  summary text not null check (length(trim(summary)) between 10 and 600),
  domains text[] not null check (cardinality(domains) between 1 and 3),
  skills_wanted text[] not null default '{}' check (cardinality(skills_wanted) <= 8),
  team_size int check (team_size is null or team_size between 2 and 12), -- null = open to everyone (club projects)
  repo_url text check (repo_url is null or repo_url ~* '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$'),
  status text not null default 'idea' check (status in ('idea','forming','building','shipped','archived')),
  origin text not null default 'member' check (origin in ('member','club')),
  owner_id uuid references profiles(id) on delete set null,
  publish_state text not null default 'private' check (publish_state in ('private','requested','published')),
  publish_note text check (publish_note is null or length(publish_note) <= 300),
  published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists project_ideas_status on project_ideas (status, created_at desc);
create table if not exists project_members (
  project_id bigint not null references project_ideas on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  shows_publicly boolean not null default false, -- their GitHub name may appear on /projects
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create table if not exists project_requests (
  id bigint generated always as identity primary key,
  project_id bigint not null references project_ideas on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  message text check (message is null or length(message) <= 300),
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(), decided_at timestamptz,
  unique (project_id, user_id)
);
alter table member_interests enable row level security;
alter table project_ideas enable row level security;
alter table project_members enable row level security;
alter table project_requests enable row level security;
revoke insert, update, delete on member_interests, project_ideas, project_members, project_requests from anon, authenticated;
drop policy if exists "read own interests, core and admins read all" on member_interests;
create policy "read own interests, core and admins read all" on member_interests for select to authenticated using (user_id = auth.uid() or my_role() in ('core','admin'));
drop policy if exists "members read project ideas" on project_ideas;
create policy "members read project ideas" on project_ideas for select to authenticated using (can_take_part());
drop policy if exists "members read project teams" on project_members;
create policy "members read project teams" on project_members for select to authenticated using (can_take_part());
drop policy if exists "owners, requesters and the core team read requests" on project_requests;
create policy "owners, requesters and the core team read requests" on project_requests for select to authenticated using (
  user_id = auth.uid() or my_role() in ('core','admin') or exists (select 1 from project_ideas p where p.id = project_requests.project_id and p.owner_id = auth.uid()));

-- ---- the interest survey ----
create or replace function save_interests(p_domains text[], p_skills text[], p_wants text, p_hours text, p_discoverable boolean) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare d text[]; s text[]; w text := nullif(trim(coalesce(p_wants, '')), '');
begin
  if not can_take_part() then return json_build_object('ok', false, 'error', 'The project hub is for active members of the club.'); end if;
  begin d := clean_domains(p_domains, 1, 5); exception when others then return json_build_object('ok', false, 'error', 'Pick between 1 and 5 areas from the list.'); end;
  begin s := clean_tags(p_skills, 8); exception when others then return json_build_object('ok', false, 'error', 'Add up to 8 skills, each 2 to 24 characters (letters, numbers, + # . -).'); end;
  if w is not null and (length(w) > 280 or looks_like_secret(w)) then return json_build_object('ok', false, 'error', 'Keep "what I''d like to build" under 280 characters, and no passwords or keys.'); end if;
  if p_hours is not null and p_hours not in ('1-2','3-5','6+') then return json_build_object('ok', false, 'error', 'Pick how many hours a week.'); end if;
  insert into member_interests (user_id, domains, skills, wants, hours, discoverable) values (auth.uid(), d, s, w, p_hours, coalesce(p_discoverable, false))
  on conflict (user_id) do update set domains = excluded.domains, skills = excluded.skills, wants = excluded.wants, hours = excluded.hours, discoverable = excluded.discoverable, updated_at = now();
  perform crm_log('interests_saved', 'interests', null, jsonb_build_object('discoverable', coalesce(p_discoverable, false)));
  return json_build_object('ok', true);
end $$;

create or replace function delete_interests() returns json language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from member_interests where user_id = auth.uid();
  perform crm_log('interests_deleted', 'interests', null, '{}');
  return json_build_object('ok', true);
end $$;

-- What the club is into. The core team and admins see exact counts; members see a count only when at least 3 people share it,
-- so a small number can't point at one person.
create or replace function survey_summary() returns json language plpgsql security definer stable set search_path = public, pg_temp as $$
declare staff boolean := my_role() in ('core','admin'); res json;
begin
  if not can_take_part() then return json_build_object('allowed', false); end if;
  select json_build_object('allowed', true, 'responses', (select count(*) from member_interests),
    'members', case when staff then (select count(*) from members where status = 'active') end,
    'domains', coalesce((select json_agg(json_build_object('domain', d.domain, 'count', case when staff or d.n >= 3 then d.n end) order by d.n desc, d.domain)
        from (select x as domain, count(*)::int n from member_interests, unnest(domains) x group by x) d), '[]'::json),
    'skills', coalesce((select json_agg(json_build_object('skill', k.skill, 'count', k.n) order by k.n desc, k.skill)
        from (select x as skill, count(*)::int n from member_interests, unnest(skills) x group by x having staff or count(*) >= 3 order by count(*) desc, x limit 12) k), '[]'::json),
    'hours', coalesce((select json_object_agg(h.hours, case when staff or h.n >= 3 then h.n end) from (select hours, count(*)::int n from member_interests where hours is not null group by hours) h), '{}'::json)) into res;
  return res;
end $$;

-- Members who ticked "let teammates find me", filtered by area and/or skill. Never anyone who didn't opt in.
create or replace function find_teammates(p_domain text default null, p_skill text default null)
returns table (handle text, name text, domains text[], skills text[], wants text, hours text)
language plpgsql security definer stable set search_path = public, pg_temp as $$
declare sk text := nullif(lower(btrim(coalesce(p_skill, ''))), '');
begin
  if not can_take_part() then return; end if;
  return query
    select p.handle, p.name, i.domains, i.skills, i.wants, i.hours
      from member_interests i join profiles p on p.id = i.user_id
     where i.discoverable and i.user_id <> auth.uid()
       and (role_of(i.user_id) in ('core','admin') or exists (select 1 from members m where m.user_id = i.user_id and m.status = 'active'))
       and (p_domain is null or p_domain = any(i.domains))
       and (sk is null or exists (select 1 from unnest(i.skills) s where s = sk or s like sk || '%'))
     order by p.name limit 40;
end $$;

-- ---- ideas and teams ----
create or replace function post_idea(p_title text, p_summary text, p_domains text[], p_skills text[], p_team_size int, p_repo_url text, p_club boolean default false) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare d text[]; s text[]; pid bigint; r text := nullif(trim(coalesce(p_repo_url, '')), ''); sm text := trim(coalesce(p_summary, ''));
begin
  if not can_take_part() then return json_build_object('ok', false, 'error', 'The project hub is for active members of the club.'); end if;
  if coalesce(p_club, false) and my_role() not in ('core','admin') then return json_build_object('ok', false, 'error', 'Only the core team posts club projects.'); end if;
  begin d := clean_domains(p_domains, 1, 3); exception when others then return json_build_object('ok', false, 'error', 'Pick between 1 and 3 areas from the list.'); end;
  begin s := clean_tags(p_skills, 8); exception when others then return json_build_object('ok', false, 'error', 'Add up to 8 skills, each 2 to 24 characters (letters, numbers, + # . -).'); end;
  if p_team_size is not null and p_team_size not between 2 and 12 then return json_build_object('ok', false, 'error', 'A team is 2 to 12 people.'); end if;
  if p_team_size is null and not coalesce(p_club, false) then return json_build_object('ok', false, 'error', 'Say how many people you need (2 to 12).'); end if;
  if looks_like_secret(sm) or looks_like_secret(p_title) then return json_build_object('ok', false, 'error', 'That looks like a password, key or token. Never post those.'); end if;
  if (select count(*) from project_ideas where owner_id = auth.uid() and status in ('idea','forming','building')) >= 5 then return json_build_object('ok', false, 'error', 'You already have 5 active projects. Finish or archive one first.'); end if;
  insert into project_ideas (title, summary, domains, skills_wanted, team_size, repo_url, origin, owner_id) values (trim(p_title), sm, d, s, p_team_size, r, case when coalesce(p_club, false) then 'club' else 'member' end, auth.uid()) returning id into pid;
  insert into project_members (project_id, user_id, role) values (pid, auth.uid(), 'owner');
  perform crm_log('idea_posted', 'project', pid::text, jsonb_build_object('club', coalesce(p_club, false)));
  return json_build_object('ok', true, 'id', pid);
exception when check_violation then return json_build_object('ok', false, 'error', 'Check the title (3 to 100 characters), the summary (10 to 600) and that the repository link is a github.com/owner/repo address.');
end $$;

-- The owner edits their idea. Changing what the public sees (title, summary, areas, skills or the repository) on a featured
-- project sends it back to the core team for a fresh look, so the public page is never edited around the review.
create or replace function update_idea(p_id bigint, p_title text, p_summary text, p_domains text[], p_skills text[], p_team_size int, p_repo_url text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare p project_ideas; d text[]; s text[]; r text := nullif(trim(coalesce(p_repo_url, '')), ''); sm text := trim(coalesce(p_summary, '')); changed boolean;
begin
  select * into p from project_ideas where id = p_id for update;
  if not found or not can_take_part() or p.owner_id is distinct from auth.uid() then return json_build_object('ok', false, 'error', 'Only the owner can edit a project.'); end if;
  if p.status = 'archived' then return json_build_object('ok', false, 'error', 'An archived project can''t be edited.'); end if;
  begin d := clean_domains(p_domains, 1, 3); exception when others then return json_build_object('ok', false, 'error', 'Pick between 1 and 3 areas from the list.'); end;
  begin s := clean_tags(p_skills, 8); exception when others then return json_build_object('ok', false, 'error', 'Add up to 8 skills, each 2 to 24 characters (letters, numbers, + # . -).'); end;
  if p_team_size is not null and p_team_size not between 2 and 12 then return json_build_object('ok', false, 'error', 'A team is 2 to 12 people.'); end if;
  if p_team_size is null and p.origin = 'member' then return json_build_object('ok', false, 'error', 'Say how many people you need (2 to 12).'); end if;
  if p_team_size is not null and p_team_size < (select count(*) from project_members where project_id = p_id) then return json_build_object('ok', false, 'error', 'The team already has more people than that.'); end if;
  if looks_like_secret(sm) or looks_like_secret(p_title) then return json_build_object('ok', false, 'error', 'That looks like a password, key or token. Never post those.'); end if;
  changed := trim(p_title) is distinct from p.title or sm is distinct from p.summary or d is distinct from p.domains or s is distinct from p.skills_wanted or r is distinct from p.repo_url;
  update project_ideas set title = trim(p_title), summary = sm, domains = d, skills_wanted = s, team_size = p_team_size, repo_url = r, updated_at = now(),
         publish_state = case when p.publish_state = 'published' and changed then 'requested' else publish_state end,
         published_at = case when p.publish_state = 'published' and changed then null else published_at end where id = p_id;
  perform crm_log('idea_updated', 'project', p_id::text, jsonb_build_object('back_to_review', p.publish_state = 'published' and changed));
  return json_build_object('ok', true, 'back_to_review', p.publish_state = 'published' and changed);
exception when check_violation then return json_build_object('ok', false, 'error', 'Check the title (3 to 100 characters), the summary (10 to 600) and that the repository link is a github.com/owner/repo address.');
end $$;

-- idea → forming | building | archived; forming → idea | building | archived; building → forming | shipped | archived;
-- shipped → building | archived. The owner or an admin; only an admin brings an archived project back (as an idea).
create or replace function set_idea_status(p_id bigint, p_status text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare p project_ideas;
begin
  select * into p from project_ideas where id = p_id for update;
  if not found or not can_take_part() or not (p.owner_id = auth.uid() or my_role() = 'admin') then return json_build_object('ok', false, 'error', 'Only the owner or an admin can change a project''s status.'); end if;
  if not ((p.status = 'idea' and p_status in ('forming','building','archived')) or (p.status = 'forming' and p_status in ('idea','building','archived'))
          or (p.status = 'building' and p_status in ('forming','shipped','archived')) or (p.status = 'shipped' and p_status in ('building','archived'))
          or (p.status = 'archived' and p_status = 'idea' and my_role() = 'admin')) then
    return json_build_object('ok', false, 'error', 'A ' || p.status || ' project can''t become ' || coalesce(p_status, 'that') || '.');
  end if;
  update project_ideas set status = p_status, updated_at = now(),
         publish_state = case when p_status = 'archived' then 'private' else publish_state end,
         published_at = case when p_status = 'archived' then null else published_at end where id = p_id;
  if p_status = 'archived' then update project_requests set status = 'withdrawn', decided_at = now() where project_id = p_id and status = 'pending'; end if;
  perform crm_log('idea_status', 'project', p_id::text, jsonb_build_object('from', p.status, 'to', p_status));
  return json_build_object('ok', true);
end $$;

create or replace function request_to_join(p_id bigint, p_message text default '') returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare p project_ideas; msg text := nullif(trim(coalesce(p_message, '')), ''); rid bigint; r project_requests;
begin
  if not can_take_part() then return json_build_object('ok', false, 'error', 'The project hub is for active members of the club.'); end if;
  select * into p from project_ideas where id = p_id;
  if not found or p.status not in ('idea','forming','building') then return json_build_object('ok', false, 'error', 'That project isn''t looking for people.'); end if;
  if exists (select 1 from project_members where project_id = p_id and user_id = auth.uid()) then return json_build_object('ok', false, 'error', 'You are already on this team.'); end if;
  if p.team_size is not null and (select count(*) from project_members where project_id = p_id) >= p.team_size then return json_build_object('ok', false, 'error', 'This team is full.'); end if;
  if msg is not null and (length(msg) > 300 or looks_like_secret(msg)) then return json_build_object('ok', false, 'error', 'Keep your message under 300 characters, and no passwords or keys.'); end if;
  select * into r from project_requests where project_id = p_id and user_id = auth.uid();
  if found and r.status in ('pending','accepted') then return json_build_object('ok', false, 'error', 'You have already asked to join this project.'); end if;
  if found and r.status = 'declined' then return json_build_object('ok', false, 'error', 'The owner has already answered your request.'); end if;
  insert into project_requests (project_id, user_id, message) values (p_id, auth.uid(), msg)
  on conflict (project_id, user_id) do update set status = 'pending', message = excluded.message, created_at = now(), decided_at = null returning id into rid;
  perform crm_log('request_sent', 'project', p_id::text, jsonb_build_object('request', rid));
  return json_build_object('ok', true);
end $$;

create or replace function withdraw_request(p_request bigint) returns json language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update project_requests set status = 'withdrawn', decided_at = now() where id = p_request and user_id = auth.uid() and status = 'pending';
  if not found then return json_build_object('ok', false, 'error', 'There is no pending request to withdraw.'); end if;
  perform crm_log('request_withdrawn', 'project', p_request::text, '{}');
  return json_build_object('ok', true);
end $$;

-- The owner (or an admin) answers a request. Accepting adds the person to the team, unless the team is full.
create or replace function decide_request(p_request bigint, p_accept boolean) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare r project_requests; p project_ideas;
begin
  select * into r from project_requests where id = p_request for update;
  if not found then return json_build_object('ok', false, 'error', 'That request isn''t available to you.'); end if;
  select * into p from project_ideas where id = r.project_id for update;
  if not can_take_part() or not (p.owner_id = auth.uid() or my_role() = 'admin') then return json_build_object('ok', false, 'error', 'That request isn''t available to you.'); end if;
  if r.status <> 'pending' then return json_build_object('ok', false, 'error', 'That request has already been answered.'); end if;
  if coalesce(p_accept, false) then
    if p.status not in ('idea','forming','building') then return json_build_object('ok', false, 'error', 'This project isn''t looking for people.'); end if;
    if p.team_size is not null and (select count(*) from project_members where project_id = p.id) >= p.team_size then return json_build_object('ok', false, 'error', 'The team is full.'); end if;
    if role_of(r.user_id) = 'none' or not exists (select 1 from members m where m.user_id = r.user_id and m.status = 'active') and role_of(r.user_id) not in ('core','admin') then
      return json_build_object('ok', false, 'error', 'That person is no longer an active member.');
    end if;
    insert into project_members (project_id, user_id) values (p.id, r.user_id) on conflict do nothing;
    update project_ideas set status = case when status = 'idea' then 'forming' else status end, updated_at = now() where id = p.id;
  end if;
  update project_requests set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end, decided_at = now() where id = p_request;
  perform crm_log('request_decided', 'project', p.id::text, jsonb_build_object('accepted', coalesce(p_accept, false)));
  return json_build_object('ok', true);
end $$;

create or replace function leave_project(p_id bigint) returns json language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from project_members where project_id = p_id and user_id = auth.uid() and role <> 'owner';
  if not found then return json_build_object('ok', false, 'error', 'The owner can''t leave: hand the project to someone else, or archive it.'); end if;
  update project_requests set status = 'withdrawn', decided_at = now() where project_id = p_id and user_id = auth.uid();
  perform crm_log('member_left_project', 'project', p_id::text, '{}');
  return json_build_object('ok', true);
end $$;

create or replace function remove_project_member(p_id bigint, p_user uuid) returns json language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from project_ideas where id = p_id and (owner_id = auth.uid() or my_role() = 'admin')) or not can_take_part() then return json_build_object('ok', false, 'error', 'Only the owner or an admin can remove someone.'); end if;
  delete from project_members where project_id = p_id and user_id = p_user and role <> 'owner';
  if not found then return json_build_object('ok', false, 'error', 'That person is not a member of this team, or is its owner.'); end if;
  update project_requests set status = 'withdrawn', decided_at = now() where project_id = p_id and user_id = p_user;
  perform crm_log('project_member_removed', 'project', p_id::text, jsonb_build_object('user', p_user));
  return json_build_object('ok', true);
end $$;

-- An admin hands a project to another member of its team (the owner has left the club, say).
create or replace function set_project_owner(p_id bigint, p_handle text) returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare o uuid;
begin
  if my_role() <> 'admin' then return json_build_object('ok', false, 'error', 'Only admins hand a project to someone else.'); end if;
  select id into o from profiles where lower(handle) = lower(ltrim(trim(coalesce(p_handle, '')), '@'));
  if o is null or not exists (select 1 from project_members where project_id = p_id and user_id = o) then return json_build_object('ok', false, 'error', 'The new owner has to be on the project''s team already.'); end if;
  update project_members set role = 'member' where project_id = p_id and role = 'owner';
  update project_members set role = 'owner' where project_id = p_id and user_id = o;
  update project_ideas set owner_id = o, updated_at = now() where id = p_id;
  perform crm_log('project_owner', 'project', p_id::text, jsonb_build_object('owner', o));
  return json_build_object('ok', true);
end $$;

-- Each person decides whether their GitHub name appears on the public page for a featured project.
create or replace function set_public_credit(p_id bigint, p_show boolean) returns json language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update project_members set shows_publicly = coalesce(p_show, false) where project_id = p_id and user_id = auth.uid();
  if not found then return json_build_object('ok', false, 'error', 'You are not on this team.'); end if;
  perform crm_log('public_credit', 'project', p_id::text, jsonb_build_object('show', coalesce(p_show, false)));
  return json_build_object('ok', true);
end $$;

-- ---- the website ----
create or replace function request_publishing(p_id bigint) returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare p project_ideas;
begin
  select * into p from project_ideas where id = p_id for update;
  if not found or not can_take_part() or p.owner_id is distinct from auth.uid() then return json_build_object('ok', false, 'error', 'Only the owner can ask for a project to be featured.'); end if;
  if p.status not in ('building','shipped') then return json_build_object('ok', false, 'error', 'A project can be featured once it is being built.'); end if;
  if length(p.summary) < 40 then return json_build_object('ok', false, 'error', 'Write a summary of at least a couple of sentences first.'); end if;
  if p.publish_state <> 'private' then return json_build_object('ok', false, 'error', 'It is already ' || case p.publish_state when 'requested' then 'waiting for a review' else 'featured' end || '.'); end if;
  update project_ideas set publish_state = 'requested', publish_note = null, updated_at = now() where id = p_id;
  perform crm_log('publish_requested', 'project', p_id::text, '{}');
  return json_build_object('ok', true);
end $$;

-- The core team or an admin, who must not be the project's owner, features it on the website or sends it back with a reason.
create or replace function decide_publishing(p_id bigint, p_approve boolean, p_note text default '') returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare p project_ideas; n text := nullif(trim(coalesce(p_note, '')), '');
begin
  if my_role() not in ('core','admin') then return json_build_object('ok', false, 'error', 'Only the core team and admins feature projects.'); end if;
  select * into p from project_ideas where id = p_id for update;
  if not found then return json_build_object('ok', false, 'error', 'Project not found.'); end if;
  if p.owner_id is not distinct from auth.uid() or exists (select 1 from project_members where project_id = p_id and user_id = auth.uid() and role = 'owner') then return json_build_object('ok', false, 'error', 'You can''t review your own project. Ask someone else on the core team.'); end if;
  if p.publish_state <> 'requested' then return json_build_object('ok', false, 'error', 'This project isn''t waiting for a review.'); end if;
  if not coalesce(p_approve, false) and (n is null or length(n) < 3) then return json_build_object('ok', false, 'error', 'Say what to change, so the team knows what to do next.'); end if;
  if n is not null and (length(n) > 300 or looks_like_secret(n)) then return json_build_object('ok', false, 'error', 'Keep the note under 300 characters.'); end if;
  update project_ideas set publish_state = case when coalesce(p_approve, false) then 'published' else 'private' end, publish_note = n,
         published_at = case when coalesce(p_approve, false) then now() else null end, updated_at = now() where id = p_id;
  perform crm_log('publish_decided', 'project', p_id::text, jsonb_build_object('approved', coalesce(p_approve, false)));
  return json_build_object('ok', true);
end $$;

create or replace function unpublish_project(p_id bigint) returns json language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from project_ideas where id = p_id and (owner_id = auth.uid() or my_role() in ('core','admin'))) then return json_build_object('ok', false, 'error', 'Only the owner or the core team can take a project off the website.'); end if;
  update project_ideas set publish_state = 'private', published_at = null, updated_at = now() where id = p_id and publish_state <> 'private';
  if not found then return json_build_object('ok', false, 'error', 'It isn''t on the website.'); end if;
  perform crm_log('project_unpublished', 'project', p_id::text, '{}');
  return json_build_object('ok', true);
end $$;

-- What /projects shows (server key only): featured projects, with GitHub names only for members who agreed.
create or replace function public_projects() returns json language sql security definer stable set search_path = public, pg_temp as $$
  select coalesce(json_agg(json_build_object('id', p.id, 'title', p.title, 'summary', p.summary, 'domains', p.domains, 'skills', p.skills_wanted, 'status', p.status,
      'repo_url', p.repo_url, 'club', p.origin = 'club', 'team_count', (select count(*) from project_members m where m.project_id = p.id),
      'people', coalesce((select json_agg(pr.handle order by pr.handle) from project_members m join profiles pr on pr.id = m.user_id where m.project_id = p.id and m.shows_publicly), '[]'::json))
      order by p.published_at desc), '[]'::json)
  from project_ideas p where p.publish_state = 'published' and p.status <> 'archived'
$$;

revoke execute on function can_take_part(), save_interests(text[], text[], text, text, boolean), delete_interests(), survey_summary(), find_teammates(text, text),
  post_idea(text, text, text[], text[], int, text, boolean), update_idea(bigint, text, text, text[], text[], int, text), set_idea_status(bigint, text), request_to_join(bigint, text),
  withdraw_request(bigint), decide_request(bigint, boolean), leave_project(bigint), remove_project_member(bigint, uuid), set_project_owner(bigint, text), set_public_credit(bigint, boolean),
  request_publishing(bigint), decide_publishing(bigint, boolean, text), unpublish_project(bigint) from public, anon;
grant execute on function can_take_part(), save_interests(text[], text[], text, text, boolean), delete_interests(), survey_summary(), find_teammates(text, text),
  post_idea(text, text, text[], text[], int, text, boolean), update_idea(bigint, text, text, text[], text[], int, text), set_idea_status(bigint, text), request_to_join(bigint, text),
  withdraw_request(bigint), decide_request(bigint, boolean), leave_project(bigint), remove_project_member(bigint, uuid), set_project_owner(bigint, text), set_public_credit(bigint, boolean),
  request_publishing(bigint), decide_publishing(bigint, boolean, text), unpublish_project(bigint) to authenticated;
revoke execute on function public_projects() from public, anon, authenticated;
grant execute on function public_projects() to service_role;

-- ============================================================
-- The contribution board (/board) follows the GitHub usernames on the team and contributors lists, plus any active member
-- who opts in from My club. Opting in shows their name and GitHub username on the public board; it is off by default.
-- ============================================================
alter table members add column if not exists on_board boolean not null default false;

create or replace function my_board_status() returns json language sql security definer stable set search_path = public, pg_temp as $$
  select coalesce((select json_build_object('member', true, 'on_board', m.on_board, 'handle', coalesce(m.handle, p.handle))
                     from members m left join profiles p on p.id = m.user_id
                    where m.user_id = auth.uid() and m.status = 'active' limit 1), json_build_object('member', false, 'on_board', false))
$$;

create or replace function set_board_opt_in(p_on boolean) returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare m members;
begin
  select * into m from members where user_id = auth.uid() and status = 'active' for update;
  if not found then return json_build_object('ok', false, 'error', 'The board opt-in is for active members of the club.'); end if;
  if coalesce(p_on, false) and m.handle is null and not exists (select 1 from profiles where id = auth.uid() and handle is not null) then
    return json_build_object('ok', false, 'error', 'Add your GitHub username to your member record first (ask a lead).');
  end if;
  update members set on_board = coalesce(p_on, false) where id = m.id;
  perform crm_log('board_opt_in', 'member', m.id::text, jsonb_build_object('on', coalesce(p_on, false)));
  return json_build_object('ok', true);
end $$;

-- For the board page (server key only): active members who opted in, with the GitHub username to search for.
create or replace function board_members() returns json language sql security definer stable set search_path = public, pg_temp as $$
  select coalesce(json_agg(json_build_object('name', m.name, 'handle', coalesce(m.handle, p.handle)) order by m.name), '[]'::json)
  from members m left join profiles p on p.id = m.user_id
  where m.status = 'active' and m.on_board and coalesce(m.handle, p.handle) is not null
$$;

revoke execute on function my_board_status(), set_board_opt_in(boolean) from public, anon;
grant execute on function my_board_status(), set_board_opt_in(boolean) to authenticated;
revoke execute on function board_members() from public, anon, authenticated;
grant execute on function board_members() to service_role;
