"""Turns the SUPABASE_DB_URL secret into PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE for pg_dump (.github/workflows/backup.yml).

Why not hand pg_dump the URL: a password with %, @, + or / in it has to be percent-encoded inside a URL, people paste it
as Supabase shows it, and pg_dump's error for that case prints part of the URL, password included, into a public log.
Here the password is taken exactly as written (or decoded, if it was encoded properly) and never printed; the workflow masks it.

Prints `export NAME='value'` lines for `eval`; on any problem prints a message that never contains the URL, and exits 1.
"""
import os
import re
import shlex
import sys
from urllib.parse import parse_qs, unquote


def fail(msg: str) -> None:
    print(f"::error::{msg}", file=sys.stderr)
    sys.exit(1)


def decode(part: str) -> str:
    # decode only a properly encoded value; a raw password like "ab%c+1" stays exactly as typed
    return unquote(part) if re.fullmatch(r"(?:[^%]|%[0-9A-Fa-f]{2})*", part) else part


def parse(url: str) -> dict:
    m = re.fullmatch(r"postgres(?:ql)?://(.*)", url.strip())
    if not m:
        raise ValueError("SUPABASE_DB_URL should start with postgresql:// (Supabase → Connect → Session pooler).")
    rest = m.group(1)
    rest, _, query = rest.partition("?")
    # the host part is after the LAST @, so an @ inside the password is fine
    userinfo, at, hostpart = rest.rpartition("@")
    if not at:
        raise ValueError("SUPABASE_DB_URL has no user and password in it (expected postgresql://USER:PASSWORD@HOST:PORT/postgres).")
    user, colon, password = userinfo.partition(":")
    if not colon or not password:
        raise ValueError("SUPABASE_DB_URL has no password in it: put the database password after the user name and a colon.")
    hostport, _, database = hostpart.partition("/")
    host, _, port = hostport.partition(":")
    if not host:
        raise ValueError("SUPABASE_DB_URL has no host in it.")
    if port and not port.isdigit():
        raise ValueError("SUPABASE_DB_URL's port isn't a number.")
    env = {"PGHOST": host, "PGPORT": port or "5432", "PGUSER": decode(user), "PGPASSWORD": decode(password),
           "PGDATABASE": decode(database) or "postgres"}
    sslmode = parse_qs(query).get("sslmode")
    env["PGSSLMODE"] = sslmode[0] if sslmode else "require"
    return env


if __name__ == "__main__":
    url = os.environ.get("SUPABASE_DB_URL", "")
    if not url:
        fail("No SUPABASE_DB_URL secret.")
    try:
        env = parse(url)
    except ValueError as e:
        fail(str(e))
    for k, v in env.items():
        print(f"export {k}={shlex.quote(v)}")
