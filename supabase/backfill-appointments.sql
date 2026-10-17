-- One-off: turn the roles people already have into appointments. Run it ONCE, in the Supabase SQL editor,
-- straight after supabase/schema.sql (from the appointments update). Until it has run, nobody except a freshly
-- made first admin has organiser access, because access now follows appointments, not profiles.role.
--
-- 1. Put the end date on the first line (the end of the club year; nobody should have access with no end).
-- 2. Run STEP 1 on its own and read who would get what. Nothing is written.
-- 3. If it is right, run STEP 2 (it writes), then STEP 3 to see the result.
-- Everyone who is a volunteer or admin today gets the same role until that date, and it is logged in crm_audit.
-- Keep the editor tab open between steps: the date is remembered for the session only.

select set_config('club.ends_on', '2099-01-01', false); -- <-- CHANGE THIS DATE (YYYY-MM-DD) before anything else

-- STEP 1: preview (writes nothing)
select p.handle, p.name, p.role as role_today, nullif(current_setting('club.ends_on', true), '')::date as until
from profiles p
where p.role in ('volunteer', 'admin') and not exists (select 1 from appointments a where a.user_id = p.id)
order by p.role, p.handle;

-- STEP 2: apply. Refuses the placeholder date, a past date, or more than 3 years.
do $$
declare ends date := nullif(current_setting('club.ends_on', true), '')::date; n int;
begin
  if ends is null or ends = date '2099-01-01' then raise exception 'Set a real end date on the select set_config line first.'; end if;
  if ends < today_ist() or ends > today_ist() + 1100 then raise exception 'The end date must be from today to 3 years away.'; end if;
  with made as (
    insert into appointments (user_id, role, ends_on)
    select p.id, p.role, ends from profiles p
    where p.role in ('volunteer', 'admin') and not exists (select 1 from appointments a where a.user_id = p.id)
    returning id, user_id, role)
  select count(*) into n from (select crm_log('appointment_granted', 'appointment', id::text, jsonb_build_object('user', user_id, 'role', role, 'ends_on', ends, 'via', 'backfill')) from made) m;
  raise notice '% appointments created until %', n, ends;
end $$;

-- STEP 3: the result, and anything still waiting for a first sign-in without an end date
select p.handle, a.role, a.ends_on from appointments a join profiles p on p.id = a.user_id where a.revoked_at is null order by a.role, p.handle;
select handle, role, 'has no end date: grant it again under People & roles' as note from pending_roles where ends_on is null;
