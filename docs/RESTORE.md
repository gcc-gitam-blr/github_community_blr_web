# Restoring the club's data from a backup

Every Sunday `.github/workflows/backup.yml` saves the `public` tables as an encrypted file (`club-data-YYYY-MM-DD.sql.gz.gpg`), kept 30 days under **Actions → Backup → the run → Artifacts**. It is data only: the tables come from `supabase/schema.sql`, the rows from the backup.

**Rehearse this once a year, and after any change of admin, into a scratch project. Never into the live one for practice.** A backup nobody has restored is a guess.

You need: `psql` and `gpg` (Windows: install PostgreSQL's command-line tools and [Gpg4win](https://www.gpg4win.org); macOS: `brew install libpq gnupg`), the `BACKUP_PASSPHRASE` from the GitHub secrets (or wherever the club keeps it), and the repo checked out.

## 1. Get and unlock the file

1. Download the artifact (GitHub → Actions → Backup → latest green run → `club-data-backup`) and unzip it.
2. Decrypt it. gpg asks for the passphrase:
   ```bash
   gpg --output club-data.sql.gz --decrypt club-data-2026-10-18.sql.gz.gpg
   ```
3. Look inside before restoring anything:
   ```bash
   gunzip -c club-data.sql.gz | head -40
   ```
   You should see `COPY public.…` blocks. If you see gpg noise or an empty file, the passphrase or the download is wrong. Stop here.
4. Count the rows the backup holds per table, to compare afterwards:
   ```bash
   gunzip -c club-data.sql.gz | awk '/^COPY public\./{t=$2; n=0; inb=1; next} /^\\\.$/{print t, n; inb=0} inb{n++}'
   ```
   Keep the file somewhere private. It holds names and emails. Delete it when you are done.

## 2. Make somewhere safe to restore into

**Preferred: a scratch Supabase project** (free). Create a new project, note its connection string (Connect → Session pooler, with the password filled in) and use it as `$SCRATCH` below. It has the `auth` schema that `profiles` needs.

**Or a local Postgres 17** (needs Docker). It has no `auth` schema, so create a stand-in first:
```bash
docker run --rm -d --name scratch -e POSTGRES_PASSWORD=scratch -p 5433:5432 postgres:17
export SCRATCH="postgresql://postgres:scratch@localhost:5433/postgres"
psql "$SCRATCH" -c "
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as \$\$ select null::uuid \$\$;
  create publication supabase_realtime;"
```
This is the same stand-in `tests/schema.test.ts` uses.

## 3. Restore

1. Tables first, from the repo:
   ```bash
   psql "$SCRATCH" -f supabase/schema.sql
   ```
2. Then the rows:
   ```bash
   gunzip -c club-data.sql.gz | psql "$SCRATCH"
   ```
3. Expected noise: `profiles` and `txs` (Epoch accounts) belong to Supabase sign-ins, which are not in the backup. Rows that point at a sign-in that does not exist in the scratch project fail, and so do the rows that depend on them. Everything else (sign-ups, messages, feedback, attendance, broadcasts, booths, rewards, quiz runs) should load with no errors.

## 4. Check it

Compare with the counts from step 1.4:
```bash
psql "$SCRATCH" -c "select 'join_requests' t, count(*) from join_requests union all select 'messages', count(*) from messages union all select 'event_feedback', count(*) from event_feedback union all select 'attendance', count(*) from attendance union all select 'broadcasts', count(*) from broadcasts;"
```
Open a few rows by eye (`select handle, created_at from join_requests order by created_at desc limit 5;`) and check the newest date is the Sunday of the backup. Write the date of the rehearsal and who did it at the bottom of this file.

Clean up: `docker stop scratch` (the container removes itself), delete the decrypted `club-data.sql.gz`, and pause or delete the scratch Supabase project.

## Restoring for real

Use this only after a real loss, and read it twice first.

- **A whole new project** (the old one is gone): do steps 1 to 3 against the new project's connection string, then follow `docs/ROLLOVER.md` to point Vercel at it (new URL, keys, GitHub sign-in settings). People sign in again; their Epoch accounts start empty.
- **One table damaged in the live project** (a bad delete): restore only that table, for example `join_requests`. Empty it, then replay just its block:
  ```bash
  psql "$LIVE" -c "truncate join_requests;"
  gunzip -c club-data.sql.gz | sed -n '/^COPY public.join_requests /,/^\\\.$/p' | psql "$LIVE"
  ```
  Do not replay the whole file over a working database: it would wind the id counters back and duplicate rows.
- Anything that arrived after the backup (up to a week) is not in it. Say so to the club.

## Rehearsal log

| Date | Who | Backup used | Result |
| --- | --- | --- | --- |
| | | | |
