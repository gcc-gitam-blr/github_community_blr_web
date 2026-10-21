/* The part of Supabase's auth schema that supabase/schema.sql reads, for the tests that run it in PGlite.
   GitHub sign-in (lib/auth/github-login.ts) writes the username twice: user_metadata.user_name, which the app shows and
   the user can edit, and app_metadata.github_login, which only the server can set; the database trusts only the second
   (github_login() in schema.sql). Tests add GitHub users the short way, with a user_name in user_metadata, and the trigger
   fills app_metadata as the server's sign-in would. It runs on insert only: a test can then edit user_metadata the way a
   signed-in user could, and check that it changes nothing. An email-code user is one inserted without a user_name. */
export const AUTH_USERS = `
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb);
  create table auth.identities (user_id uuid, provider text, identity_data jsonb, created_at timestamptz not null default now());
  create function auth.stub_github_login() returns trigger language plpgsql as $stub$ begin
    if new.raw_app_meta_data is null and new.raw_user_meta_data ? 'user_name' then
      new.raw_app_meta_data := jsonb_build_object('github_login', new.raw_user_meta_data->>'user_name');
    end if;
    return new;
  end $stub$;
  create trigger stub_github_login before insert on auth.users for each row execute function auth.stub_github_login();
`;
