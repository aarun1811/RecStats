# Oracle Cloud + Thick-Mode Local Dev Wiring — Research

**For:** RecViz Phase 1 (Oracle-only cutover)
**Date:** 2026-04-11
**Overall confidence:** HIGH (all key facts verified against current Oracle docs)
**Scope:** Provisioning + thick-mode local-dev wiring only. Not Oracle fundamentals, not SQL, not FastAPI.

---

## TL;DR

1. **Yes, Oracle 19c Always Free Autonomous Database is still provisionable in 2026** — you pick it explicitly at provisioning time from a "Database version" radio: `19c` or `26ai`. Pick **19c**. Confidence: HIGH.
2. **Oracle Instant Client for macOS ARM64 (Apple Silicon) has existed since June 2024** — the old "use Rosetta" guidance is stale. Download the native arm64 DMG. Confidence: HIGH.
3. **You cannot change Always Free character sets.** They are locked to `AL32UTF8` (DB) / `AL16UTF16` (national). Citi's NCS 871 is NOT reproducible on Oracle Cloud Free Tier. The parity goal has a gap here — see Section 7 for the pragmatic compromise.
4. **Inactivity policy bites:** 7 days of no connections → auto-stop (data preserved); 90 cumulative days stopped → reclaim + delete. You'll need a weekly ping in dev.
5. **Signup requires a credit card and a phone number**; card is authorized for $1 (reversed). Personal individual account is allowed.

---

## 1. Is Oracle 19c Always Free still offered? Can you pick 19c at provisioning?

**Yes to both.** Verified on the current Oracle doc pages (2026):

- The Always Free product page explicitly lists two selectable database versions at provisioning: **Oracle Database 19c** or **Oracle AI Database 26ai**. A "Database version" radio control appears in the provisioning dialog.
- Pick 19c deliberately. 19c is the long-term-support release and is what Citi runs. You cannot later upgrade an Always Free 19c instance to 26ai — you'd have to destroy it and recreate. For this project, the lock-in is a feature.
- Promotion from Always Free to a paid Autonomous Database is only supported when the Always Free version is 19c. If you ever go paid, 19c is the only upgrade path anyway.

**Regional caveat:** Always Free instances can only be created in your tenancy's **home region** (chosen once at signup, cannot be changed later). Pick a home region at signup that you know supports 19c (all major commercial regions do — Ashburn (IAD), Phoenix (PHX), Frankfurt (FRA), London (LHR) are all safe).

**Alternative if you needed more control:** Oracle Base Database Service would give you a real VM running 19c, but it is **not Always Free** — it bills on CPU hours. Don't use it for this project. Stick with Always Free Autonomous 19c.

Sources:
- [Always Free Autonomous AI Database (Oracle docs)](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/autonomous-always-free.html)
- [Always Free Autonomous Database (Oracle docs, adbsa)](https://docs.oracle.com/en/cloud/paas/autonomous-database/adbsa/autonomous-always-free.html)

---

## 2. Provisioning step-by-step (click by click)

### 2.1 Signup (assumes fresh personal Oracle account)

**URL:** https://signup.oraclecloud.com/

**What Oracle requires:**
- Valid email address (not yet associated with an Oracle Cloud tenancy)
- Personal mobile phone for SMS verification (not a VoIP number — Oracle blocks many)
- Physical credit or debit card (card-only, **no prepaid, no virtual, no PIN debit**). Card is authorized for $1 USD (the authorization is reversed immediately Oracle-side; your bank may hold it for a few days)
- Physical billing address

**Signup flow:**
1. Go to https://signup.oraclecloud.com/.
2. Enter email + country. Click **Verify my email**. Click the link in the email.
3. Set password. Set **account name** — this is the tenancy name, permanent, lowercase only. Use something like `recviz-dev`.
4. Pick **home region**. **THIS IS PERMANENT.** Pick the closest region that supports 19c. Safe picks: `US East (Ashburn)`, `US West (Phoenix)`, `UK South (London)`, `Germany Central (Frankfurt)`. Write it down.
5. Fill in name + address. Select **Individual** account type (default).
6. Enter mobile number → receive SMS → enter code.
7. Enter credit card. Oracle places a $1 authorization. Submit.
8. Wait 1–5 minutes for account creation. You'll get an email when the tenancy is ready.

### 2.2 First login

1. Go to https://cloud.oracle.com
2. Enter your tenancy name (`recviz-dev` if you used that). Click **Next**.
3. Sign in with the email + password you created. You'll land on the OCI Console home page.
4. Confirm the top-right region selector shows your **home region**. Always Free provisioning must happen there.

### 2.3 Provision the Autonomous Database

1. **Top-left hamburger menu** → **Oracle Database** → **Autonomous Database**.
2. You'll see a blue **Create Autonomous Database** button at the top. Click it.
3. You're now on the "Create Autonomous Database" form. Fill in:
   - **Compartment:** leave default (`root`).
   - **Display name:** `recviz-dev-19c`. Used in the console only.
   - **Database name:** `recvizdev`. **Alphanumeric only, no underscores, no hyphens, max 14 chars, case-insensitive.** This becomes the basis of your service names (e.g., `recvizdev_high`, `recvizdev_low`).
4. **Workload type:** Select **Transaction Processing** (radio button). This is the OLTP workload — matches Citi's recon workload. (Data Warehouse would also work but would give you parallel query as default and no `tp`/`tpurgent` service names.)
5. **Deployment type:** Leave **Serverless** (the default and the only Free Tier option).
6. **Always Free:** There is an explicit **"Always Free"** toggle on this form. **Turn it ON.** When you do, CPU/storage sliders are locked to 1 OCPU / 20 GB — this is what makes it free.
7. **Database version:** You'll see a **Database version** control with radio buttons. Pick **19c**. If your region doesn't show the 19c radio, your home region doesn't support 19c — you'll need to abandon the tenancy (cannot change home region later).
8. **Admin credentials:**
   - **Username:** fixed at `ADMIN`. Cannot be changed.
   - **Password:** 12–30 chars, 1 uppercase, 1 lowercase, 1 number, no double-quotes, no username. Pick something you can paste — this ends up in `.env`. Write it down. There is no recovery — if you lose it, you reset it from the console, but there's no "forgot" flow.
9. **Network access:** Leave **Secure access from everywhere** (default). Always Free does not support private endpoints.
10. **License type:** Leave **License Included** (default for Always Free).
11. **Contact info:** email is auto-filled. Leave it.
12. Scroll to the bottom. Click **Create Autonomous Database**.
13. You'll be redirected to the DB detail page. Status goes from `PROVISIONING` → `AVAILABLE` in 1–3 minutes. You now have a live Oracle 19c instance.

**What you walk away with at this point:**
- A DB named `recvizdev` in status `AVAILABLE`
- Admin username `ADMIN`, password you just set
- No wallet yet — that's the next step

### 2.4 Download the wallet

From the DB detail page:

1. Click **Database connection** (blue button in the "General Information" area).
2. A "Database Connection" panel opens.
3. **Wallet type:** select **Instance Wallet** (not Regional). Instance wallet scopes to this one DB; regional wallets are for multi-DB fleet setups.
4. Click **Download wallet**.
5. A dialog asks for a **wallet password**. This is NOT the ADMIN password. It encrypts the private key inside the wallet zip. Minimum 8 chars, 1 letter, 1 number, 1 special. Pick something you can paste. Write it down too — you'll need it in the SQLAlchemy `connect_args`.
6. Click **Download**. You get `Wallet_recvizdev.zip` (or similar).

The zip contains:
| File | What it is |
|---|---|
| `tnsnames.ora` | TNS aliases. Defines `recvizdev_high`, `recvizdev_medium`, `recvizdev_low`, `recvizdev_tp`, `recvizdev_tpurgent` |
| `sqlnet.ora` | SQL*Net client config; has a `WALLET_LOCATION` pointing at `?/network/admin` by default |
| `cwallet.sso` | Auto-open SSO wallet (thick mode reads this) |
| `ewallet.p12` | PKCS#12 keystore, password-protected |
| `ewallet.pem` | PEM certs |
| `keystore.jks`, `truststore.jks` | Java-only, ignore |
| `ojdbc.properties` | Java-only, ignore |
| `README` | Contains the SSL cert expiration date — check it |

**Write down the cert expiration** from `README`. When it gets within 6 weeks, Oracle emails you and you'll need to redownload.

Sources:
- [Download Autonomous DB wallet (Oracle docs)](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/connect-download-wallet.html)
- [Predefined service names (high/medium/low/tp/tpurgent)](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/predefined-database-services-names.html)

---

## 3. Wallet file handling on macOS

### 3.1 Where to put the wallet

Create a permanent directory **outside** the project (so it isn't committed or wiped):

```bash
mkdir -p ~/.oracle/wallets/recvizdev
unzip ~/Downloads/Wallet_recvizdev.zip -d ~/.oracle/wallets/recvizdev
chmod 700 ~/.oracle/wallets/recvizdev
chmod 600 ~/.oracle/wallets/recvizdev/*
```

### 3.2 Edit `sqlnet.ora`

Open `~/.oracle/wallets/recvizdev/sqlnet.ora`. Oracle ships it with:

```
WALLET_LOCATION = (SOURCE = (METHOD = file) (METHOD_DATA = (DIRECTORY="?/network/admin")))
SSL_SERVER_DN_MATCH=yes
```

That `?/network/admin` is a shorthand for `$ORACLE_HOME/network/admin`. Since we're using Instant Client with wallet files in a custom directory, **replace it** with an absolute path:

```
WALLET_LOCATION = (SOURCE = (METHOD = file) (METHOD_DATA = (DIRECTORY="/Users/aarun/.oracle/wallets/recvizdev")))
SSL_SERVER_DN_MATCH=yes
```

(Use `echo $HOME` to confirm the path — don't hardcode `aarun` if it isn't you.)

**Why:** thick mode on the cwallet.sso path resolves `WALLET_LOCATION` from `sqlnet.ora`, not from Python. If you leave the `?` form, thick mode will try to find the wallet inside the Instant Client tree and fail with a cert error.

### 3.3 Set `TNS_ADMIN`

Two options, either is fine:

**Option A — env var (recommended, matches prod):**
```bash
# in ~/.zshrc
export TNS_ADMIN="$HOME/.oracle/wallets/recvizdev"
```

**Option B — pass `config_dir` in Python:**
```python
oracledb.init_oracle_client(
    lib_dir="/Users/aarun/Downloads/instantclient_23_3",
    config_dir="/Users/aarun/.oracle/wallets/recvizdev",
)
```

Pick Option A. Prod on RHEL will want `TNS_ADMIN` set anyway, and the less Python-side pathing you have the cleaner the cutover.

Source: [Python mTLS wallet connection (Oracle docs)](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/connecting-python-mtls.html)

---

## 4. Oracle Instant Client on macOS (Apple Silicon AND Intel)

### 4.1 Apple Silicon (M1/M2/M3/M4) — NATIVE ARM64, not Rosetta

Oracle shipped a native ARM64 build of Instant Client in **June 2024**. Older blog posts that say "use Rosetta" are obsolete — **ignore them**.

**Download page:** https://www.oracle.com/database/technologies/instant-client/macos-arm64-downloads.html

Three files you want (replace version `23.3.0.23.09` with whatever is current on the page):

```bash
cd ~/Downloads
curl -O https://download.oracle.com/otn_software/mac/instantclient/233023/instantclient-basic-macos.arm64-23.3.0.23.09.dmg
curl -O https://download.oracle.com/otn_software/mac/instantclient/233023/instantclient-sqlplus-macos.arm64-23.3.0.23.09.dmg
curl -O https://download.oracle.com/otn_software/mac/instantclient/233023/instantclient-sdk-macos.arm64-23.3.0.23.09.dmg
```

- **basic** — required. Contains `libclntsh.dylib` which `oracledb` loads.
- **sqlplus** — optional but recommended; gives you the `sqlplus` CLI for smoke tests.
- **sdk** — optional. You only need this if you're compiling C extensions against OCI headers. Skip for this project.

**Verify notarization** (confirms the DMG is legitimately Apple-signed, so Gatekeeper won't block it):

```bash
xcrun stapler validate instantclient-basic-macos.arm64-23.3.0.23.09.dmg
# Expected: "The validate action worked!"
```

**Install:**

```bash
hdiutil mount instantclient-basic-macos.arm64-23.3.0.23.09.dmg
hdiutil mount instantclient-sqlplus-macos.arm64-23.3.0.23.09.dmg

# Run install_ic.sh ONCE from any mounted volume — it copies all mounted volumes' contents
sh /Volumes/instantclient-basic-macos.arm64-23.3.0.23.09/install_ic.sh

hdiutil unmount /Volumes/instantclient-basic-macos.arm64-23.3.0.23.09
hdiutil unmount /Volumes/instantclient-sqlplus-macos.arm64-23.3.0.23.09
```

After the script runs, files land at:

```
~/Downloads/instantclient_23_3/
  libclntsh.dylib -> libclntsh.dylib.23.1
  libclntsh.dylib.23.1
  libclntshcore.dylib.23.1
  libnnz.dylib
  libociei.dylib
  sqlplus
  network/admin/         (empty — this is where default TNS_ADMIN points)
  ...
```

**Move it out of `~/Downloads`** (Downloads gets wiped periodically):

```bash
mkdir -p ~/oracle
mv ~/Downloads/instantclient_23_3 ~/oracle/instantclient_23_3
```

### 4.2 Intel x86_64 Macs

If the dev machine ever ends up being an Intel Mac:

**Download page:** https://www.oracle.com/database/technologies/instant-client/macos-intel-x86-downloads.html

Install flow is identical except the DMG names are `instantclient-basic-macosx-19.8.0.0.0dbru.dmg` (note: Intel Mac client is frozen at 19.8; no 23c build). This is fine — a 19.8 client happily connects to 19c. For our use case (19c target) this is actually the most reliable combo.

### 4.3 Environment variables

For thick mode, you do **not** need to set `DYLD_LIBRARY_PATH` if you pass `lib_dir` to `init_oracle_client()`. Setting it is actually worse — macOS System Integrity Protection strips `DYLD_*` env vars when launching system binaries, so it's unreliable. **Use `lib_dir=` in Python instead.**

Only env vars needed:

```bash
# ~/.zshrc
export TNS_ADMIN="$HOME/.oracle/wallets/recvizdev"
```

### 4.4 Does `oracledb` need explicit pathing?

On macOS: **yes**. Unlike Linux where `/etc/ld.so.conf` or system library paths can be wired up, macOS doesn't have a system-wide Oracle Client location. You must pass `lib_dir=` to `init_oracle_client()`, or add the Instant Client directory to `PATH` (only works for `sqlplus`, not for the Python import).

### 4.5 Client–server version compatibility

Instant Client 23.x → Oracle 19c server: **supported** per Oracle Doc ID 207303.1 (Client/Server Interoperability Matrix). You can use a 23c client against a 19c server without issue. If you want tighter version matching with Citi, download the Intel 19.8 client (x86_64) and run Python under Rosetta — but this adds friction and is unnecessary since the 23.x ARM64 client is Oracle-supported against 19c.

Sources:
- [Instant Client macOS ARM64 downloads](https://www.oracle.com/database/technologies/instant-client/macos-arm64-downloads.html)
- [Installing Instant Client for macOS ARM64 (Oracle Dev Medium)](https://medium.com/oracledevs/installing-oracle-instant-client-for-apple-macos-arm64-m1-m2-m3-2c81f246feb9)
- [Oracle 23 Instant Client install guide](https://docs.oracle.com/en/database/oracle/oracle-database/23/mxcli/installing-and-removing-oracle-database-client.html)

---

## 5. Concrete Python connection sample (sync SQLAlchemy 2.0 + thick mode + wallet)

### 5.1 Environment variables (`backend/.env`)

```bash
# Oracle Instant Client path (macOS ARM64)
ORACLE_CLIENT_LIB_DIR=/Users/aarun/oracle/instantclient_23_3

# Wallet directory
TNS_ADMIN=/Users/aarun/.oracle/wallets/recvizdev
ORACLE_WALLET_DIR=/Users/aarun/.oracle/wallets/recvizdev
ORACLE_WALLET_PASSWORD=change_me_the_wallet_zip_password

# Connection target
ORACLE_USER=ADMIN
ORACLE_PASSWORD=change_me_the_ADMIN_password
ORACLE_DSN=recvizdev_low        # low / medium / high / tp / tpurgent

# SQLAlchemy URL form (used by alembic.ini too)
# Empty host/port — connection details come from connect_args
RECVIZ_DB_URL=oracle+oracledb://

# Required for RecViz encryption
RECVIZ_ENCRYPTION_KEY=<generate_with_Fernet.generate_key>
```

**Why `recvizdev_low`?** Autonomous TP workloads expose 5 services. `low` gives serial execution and highest concurrency — best match for a BI tool running parameterized queries. `medium` and `high` run parallel query and burn CPU quota faster. `tp`/`tpurgent` are for OLTP apps. For RecViz's aggregation queries on millions of rows, start with `low`; if you hit latency problems, switch to `medium`. Never use `tpurgent` — not meant for batch/reporting.

### 5.2 `backend/app/db/engine.py` (sync)

See `ORACLE_SQLALCHEMY.md` §3 for the full engine rewrite including the `thick_mode` dict pattern. Key rule: pass `thick_mode` as a dict of kwargs to `create_engine()`, **not** `thick_mode=True`. Do **not** call `oracledb.init_oracle_client()` yourself. Omit `lib_dir` on Linux (prod).

### 5.3 `backend/app/config.py`

```python
from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Oracle Instant Client
    oracle_client_lib_dir: str

    # Wallet + credentials
    oracle_user: str = "ADMIN"
    oracle_password: SecretStr
    oracle_dsn: str                             # e.g. "recvizdev_low"
    oracle_wallet_dir: str
    oracle_wallet_password: SecretStr

    # SQLAlchemy URL -- empty-host form for Oracle with connect_args
    recviz_db_url: str = "oracle+oracledb://"

    # Existing
    recviz_encryption_key: SecretStr

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

### 5.4 `backend/app/migrations/alembic.ini`

Alembic reads `sqlalchemy.url` as a plain string. Since the connection needs `connect_args` (wallet path, wallet password, etc.), hardcoding a URL in `alembic.ini` doesn't work for Oracle wallets. **Leave `sqlalchemy.url` empty and set it from `env.py`:**

```ini
[alembic]
script_location = %(here)s
sqlalchemy.url =
```

Then in `backend/app/migrations/env.py` (in `run_migrations_online`), replace the default engine construction with:

```python
from app.db.engine import engine  # reuses the configured engine, already thick-mode

def run_migrations_online() -> None:
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table="recviz_alembic_version",
        )
        with context.begin_transaction():
            context.run_migrations()
```

This pulls the engine + wallet wiring from `app.db.engine` so Alembic and the app share one code path. The `version_table="recviz_alembic_version"` preserves the table-name workaround that was originally added for Superset coexistence (per CLAUDE.md).

### 5.5 Verifying thick mode at startup

Add a one-time smoke check in `app.main` lifespan:

```python
from sqlalchemy import text
from app.db.engine import engine

with engine.connect() as conn:
    row = conn.execute(
        text("SELECT client_driver FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV','SID')")
    ).one()
    driver = row[0]
    logger.info("Oracle client driver: %s", driver)
    if driver and driver.startswith("python-oracledb thn"):
        raise RuntimeError("Thin mode detected; thick mode required for NCS 871 parity")
```

When thick mode is active, `client_driver` reads `python-oracledb`. When thin mode is active, it reads `python-oracledb thn`. (Confirmed in the python-oracledb 3.x+ docs — the `thn` suffix is the sentinel.)

Sources:
- [SQLAlchemy 2.0 Oracle dialect](https://docs.sqlalchemy.org/en/20/dialects/oracle.html)
- [Connecting to Autonomous DB through SQLAlchemy (Oracle blog)](https://blogs.oracle.com/opal/post/connecting-to-oracle-cloud-autonomous-database-through-sqlalchemy)
- [Python thick/thin mode differences (python-oracledb docs)](https://python-oracledb.readthedocs.io/en/latest/user_guide/appendix_b.html)

---

## 6. Pitfalls (real error messages, not abstractions)

### 6.1 `DPI-1047: Cannot locate a 64-bit Oracle Client library`

Full form on Apple Silicon:
```
DPI-1047: Cannot locate a 64-bit Oracle Client library:
"dlopen(…/libclntsh.dylib, 0x0001): tried: '…/libclntsh.dylib' (mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64'))"
```
**Cause:** You installed the Intel DMG on an Apple Silicon machine. The DMG is called `instantclient-basic-macosx-19.8.0.0.0dbru.dmg` on the Intel page and `instantclient-basic-macos.arm64-23.x.dmg` on the ARM64 page — it's easy to grab the wrong one.
**Fix:** `rm -rf ~/oracle/instantclient_*`, redownload from the [ARM64 page](https://www.oracle.com/database/technologies/instant-client/macos-arm64-downloads.html), re-run `install_ic.sh`.
**Diagnostic:** `file ~/oracle/instantclient_23_3/libclntsh.dylib` → should say `Mach-O 64-bit dynamically linked shared library arm64`.

### 6.2 `DPY-3010: connections to this database server version are not supported by python-oracledb in thin mode`

**Cause:** You didn't call `init_oracle_client()`, or you called it after a connection was already opened. The driver stayed in thin mode.
**Fix:** With the SQLAlchemy pattern from §5.2, thick mode is engaged via `create_engine(thick_mode={...})` — do not call `init_oracle_client()` yourself. Confirm via the startup assertion from §5.5.

### 6.3 `ORA-28759: Failure to open file` (during connect)

**Cause:** The wallet's `sqlnet.ora` still contains `DIRECTORY="?/network/admin"` — thick mode expanded that to `$INSTANT_CLIENT/network/admin`, which is empty.
**Fix:** Edit `sqlnet.ora` to contain the absolute wallet directory as shown in section 3.2. Or, alternatively, copy `tnsnames.ora`, `sqlnet.ora`, and `cwallet.sso` into `~/oracle/instantclient_23_3/network/admin/` so the `?` shorthand resolves. The absolute-path approach is cleaner.

### 6.4 `ORA-12506: TNS:listener rejected CONNECTION based on service ACL filtering`

**Cause:** Your Autonomous DB's network access list is restricting connections. Or, more commonly, the DB is in the `STOPPED` state after 7 days of inactivity.
**Fix:** OCI Console → your DB → click **Start** if stopped. Wait 2 minutes. Retry. If the ACL is set, change it from the Network section back to "Secure access from everywhere."

### 6.5 `ORA-12154: TNS:could not resolve the connect identifier specified`

**Cause:** The `dsn` you passed doesn't match any alias in `tnsnames.ora`. Most common mistake: passing `recvizdev` when the actual alias is `recvizdev_low`.
**Fix:** `grep = ~/.oracle/wallets/recvizdev/tnsnames.ora` to see the real aliases. Use exact case.

### 6.6 `ORA-12547: TNS:lost contact` right after a period of idleness

**Cause:** Autonomous DB drops idle connections after ~30 minutes. SQLAlchemy's pool still holds them.
**Fix:** Already mitigated by `pool_pre_ping=True` and `pool_recycle=1800` in the engine config above. If you see this anyway, lower `pool_recycle` to 900.

### 6.7 `ORA-00017: session requested to set trace event` / DB stuck in `STOPPING`

**Cause:** You hit the "session limit" (30 simultaneous sessions on Free Tier) during a runaway test.
**Fix:** Wait 5 minutes. In `app/db/engine.py`, keep `pool_size=5, max_overflow=5` — that gives you a hard ceiling of 10 connections, leaving headroom under the 30-session cap.

### 6.8 "Wallet expired" / `ORA-29024: Certificate validation failure`

**Cause:** The wallet's SSL cert has an expiration date. After ~5 years, it expires. Oracle emails you weekly for 6 weeks before expiry.
**Fix:** Redownload the wallet per section 2.4 and replace the files in `~/.oracle/wallets/recvizdev/`. The password you set when redownloading can be the same as before — no server-side impact.

### 6.9 Gatekeeper quarantine on Instant Client dylibs

Symptom: loading the dylib fails with a popup saying "cannot verify the developer." Shouldn't happen with the official Oracle download — they're notarized.
**Fix if it ever triggers:**
```bash
xattr -dr com.apple.quarantine ~/oracle/instantclient_23_3
```
The `xcrun stapler validate` step in §4.1 catches this before install.

### 6.10 Alembic tries to use `asyncpg://` URL from stale config

**Cause:** `alembic.ini` still has `sqlalchemy.url = postgresql+asyncpg://...` from the old Postgres config. You see `ModuleNotFoundError: No module named 'asyncpg'` when running `alembic upgrade head`.
**Fix:** Empty out the line (`sqlalchemy.url =`) and ensure `env.py` imports `from app.db.engine import engine` as shown in section 5.4. This is on the Phase 1 checklist.

Sources:
- [python-oracledb troubleshooting](https://python-oracledb.readthedocs.io/en/stable/user_guide/troubleshooting.html)
- [python-oracledb issue #182 (M1 Mac connect error)](https://github.com/oracle/python-oracledb/issues/182)
- [python-oracledb issue #243 (DPI-1047)](https://github.com/oracle/python-oracledb/issues/243)

---

## 7. Character set NCS 871 — honest answer

**NCS 871 is Oracle's "UTF8" national character set** — character set ID 871, which encodes NCHAR/NVARCHAR2/NCLOB values as **CESU-8**, not modern AL32UTF8. It's the legacy pre-Unicode-3.1 encoding. Citi's production 19c uses this for historical reasons; many legacy enterprise Oracle installs do.

**Can you set NCS 871 on Oracle Cloud Always Free Autonomous?**
**No.** Verified from current Oracle docs:

> "Always Free Autonomous AI Database does NOT support character set selection — you're limited to the defaults (AL32UTF8 / AL16UTF16)."

This means your local Always Free instance will use:
- Database character set: `AL32UTF8`
- National character set: `AL16UTF16`

Both are modern Unicode. Neither matches Citi's NCS 871.

**What this means for parity:**

The python-oracledb **thin mode limitation** is:
- Thin mode historically errored out immediately when connecting to a DB with national character set 871, with `DPY-3012: national character set id 871 is not supported by python-oracledb in thin mode`.
- Current thin mode (from the 2024+ releases) now defers that error — the connection succeeds, and the error only raises when you actually bind or fetch NCHAR/NVARCHAR2/NCLOB columns.
- Thick mode has **no such restriction** because it delegates everything to the Instant Client's OCI libraries.

So the production reason to use thick mode is: Citi's schema has NCHAR/NVARCHAR2 columns, thin mode will crash at the first select that touches one. Thick mode handles them transparently.

**But your local Cloud instance doesn't have 871.** You'll never hit the `DPY-3012` error locally, because `AL16UTF16` is supported in both modes. **The parity gap:** if you forget to wire thick mode locally, tests pass; then deploy to Citi, and queries over NCHAR columns blow up.

**The compromise — how to still mimic Citi closely:**

1. **Always force thick mode locally, even though you could technically use thin.** The sample `engine.py` in §5.2 does this unconditionally. This catches "did the wallet work? did the Instant Client load?" issues at dev time, not deploy time.

2. **Add the startup assertion from §5.5** that refuses to start the app if `v$session_connect_info.client_driver` reports thin mode. Refuse fallback. Fail loud.

3. **Create at least one `NVARCHAR2` column in a test `recviz_*` table** during the Phase 1 Alembic migration, and have a smoke test that reads/writes it. It'll succeed locally, but it forces the NCHAR code path to exist in the app.

4. **Document the gap loudly in CLAUDE.md.** Local Cloud = `AL32UTF8`/`AL16UTF16`, prod Citi = whatever/`UTF8 (871)`. The only way to catch an NCHAR-sensitive bug is to deploy to a Citi environment. There is no way around this without paying for Oracle Base Database Service (non-free).

5. **Known divergence to accept:** date/number formatting in `NLS_LANG` differs. Citi may have `NLS_LANG=AMERICAN_AMERICA.UTF8` while Always Free gives you `AMERICAN_AMERICA.AL32UTF8`. For RecViz, dates are formatted client-side with `date-fns` and numbers with explicit formatters — low-risk. But watch out for `TO_CHAR(date, 'format')` calls in dataset SQL where default NLS settings leak into the result.

Sources:
- [Oracle Autonomous DB character set selection](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/autonomous-character-set-selection.html)
- [python-oracledb issue #16 (DB_NCHARSET UTF8 support in thin mode)](https://github.com/oracle/python-oracledb/issues/16)
- [python-oracledb thin vs thick differences](https://python-oracledb.readthedocs.io/en/latest/user_guide/appendix_b.html)

---

## 8. Cost, quotas, inactivity policy (2026 state)

**What "Always Free" gives you per tenancy:**
- **2 Autonomous AI Databases** (the whole tenancy — not 2 per region). You only need 1 for RecViz; the second slot is your buffer if you want to test migrations against a clean DB.
- **20 GB storage per DB** (hard cap, cannot grow).
- **1 OCPU per DB** (cannot scale).
- **Max 30 simultaneous sessions per DB** (important — constrains your SQLAlchemy `pool_size + max_overflow`).
- **Max ~3–6 concurrent HTTP users on APEX/ORDS** (doesn't matter for this project — we don't use APEX).

**Billing:** $0. No credit card usage. You can even let your trial $300 credits expire — Always Free resources stay free indefinitely.

**Inactivity auto-stop (the one that will bite you):**
- After **7 days** with no successful SQL*Net or HTTPS connection, the DB auto-stops. Data is preserved.
- After **90 cumulative days stopped**, Oracle may reclaim and **permanently delete** the DB.
- A successful connection resets the 7-day idle timer.
- Oracle emails you before auto-stop and before auto-delete, *if* you subscribe to OCI alerts and notifications.

**Practical mitigation:**
- Add a weekly ping cron on your Mac:
  ```bash
  # 10am Monday
  0 10 * * 1 /Users/aarun/oracle/instantclient_23_3/sqlplus -L ADMIN/"$ADMIN_PW"@recvizdev_low @/dev/null || true
  ```
- Or easier: open the OCI Console once a week and click **Start** if stopped. Takes 30 seconds.

**What gets lost if the DB is reclaimed:**
Everything. Schema, data, connection info. You'd need to re-provision (new name allowed), re-download a new wallet, update your `.env`, re-run Alembic `upgrade head`, re-seed dev data.

**Quota constraint on your SQLAlchemy pool:**
```python
pool_size=5, max_overflow=5  # hard ceiling = 10 connections
```
Stay under 10. The 30-session limit includes APEX/ORDS background sessions you don't control, so assume your real budget is 15–20.

Sources:
- [Always Free Autonomous AI Database](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/autonomous-always-free.html)
- [Oracle Cloud Free Tier FAQ](https://www.oracle.com/cloud/free/faq/)

---

## 9. Final `.env` and `alembic.ini` samples

### `backend/.env`

```bash
# -------- Oracle Instant Client (macOS ARM64) --------
ORACLE_CLIENT_LIB_DIR=/Users/aarun/oracle/instantclient_23_3

# -------- Autonomous DB wallet + credentials --------
TNS_ADMIN=/Users/aarun/.oracle/wallets/recvizdev
ORACLE_WALLET_DIR=/Users/aarun/.oracle/wallets/recvizdev
ORACLE_WALLET_PASSWORD=Wallet_zip_password_you_set_at_download

ORACLE_USER=ADMIN
ORACLE_PASSWORD=The_ADMIN_password_you_set_at_provision
ORACLE_DSN=recvizdev_low

# -------- SQLAlchemy URL --------
# Empty host/port -- real connection params come from connect_args in engine.py
RECVIZ_DB_URL=oracle+oracledb://

# -------- RecViz encryption (existing, unchanged) --------
RECVIZ_ENCRYPTION_KEY=generate_with_cryptography.fernet.Fernet.generate_key
```

### `backend/app/migrations/alembic.ini`

```ini
[alembic]
script_location = %(here)s
# Empty -- env.py imports app.db.engine.engine which has the full wiring
sqlalchemy.url =

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

### `requirements.txt` diff (Phase 1)

```diff
 # RecViz Backend
 fastapi==0.128.6
 uvicorn==0.40.0
 pydantic==2.12.5
 pydantic-settings==2.12.0
 python-dotenv==1.2.1

-# Database
-psycopg2-binary==2.9.11
-
-# Async SQLAlchemy + Migrations
-sqlalchemy[asyncio]==2.0.49
-asyncpg==0.31.0
+# Database (Oracle 19c, thick mode, sync)
+sqlalchemy==2.0.49
 alembic==1.18.4

 # Encryption
 cryptography==44.0.3

 # Oracle driver
-# >=3.0 required for async thick mode support (prod uses thick mode for
-# Oracle DBs with unsupported national character sets, e.g. NCS 871).
+# Thick mode required -- production Oracle uses NCS 871 (CESU-8 UTF8)
+# national character set; thin mode errors on NCHAR/NVARCHAR2/NCLOB.
+# We run thick mode in BOTH dev and prod so behavior is identical.
 oracledb>=3.3.0
```

---

## 10. Phase 1 checklist (manual provisioning order)

1. **Sign up** at https://signup.oraclecloud.com/ (§2.1). Pick home region. Record tenancy name + email + password.
2. **Create DB** `recvizdev` as Transaction Processing, 19c, Always Free (§2.3). Record ADMIN password.
3. **Download wallet** (§2.4). Record wallet password.
4. **Unzip wallet** to `~/.oracle/wallets/recvizdev/` (§3.1), chmod 700/600.
5. **Edit `sqlnet.ora`** to absolute `DIRECTORY` path (§3.2).
6. **Install Instant Client** (§4.1), move out of `~/Downloads` to `~/oracle/instantclient_23_3`.
7. **Smoke-test with `sqlplus`:**
   ```bash
   export TNS_ADMIN=~/.oracle/wallets/recvizdev
   export PATH=$PATH:~/oracle/instantclient_23_3
   sqlplus ADMIN/"$ORACLE_PASSWORD"@recvizdev_low
   # SQL> SELECT sysdate FROM dual;
   # EXIT
   ```
   If this returns a row, your wallet + Instant Client are correctly wired. Everything after this is Python.
8. Code-side steps from `ORACLE_SQLALCHEMY.md` §7.

If step 7 fails, do not advance — every subsequent step depends on it.

---

## 11. Confidence assessment

| Area | Confidence | Basis |
|---|---|---|
| 19c still provisionable on Always Free | HIGH | Verified on Oracle's current `autonomous-always-free.html` doc page |
| Instant Client macOS ARM64 exists | HIGH | Verified on Oracle's official download page + Oracle Dev Medium announcement |
| sqlnet.ora `DIRECTORY` edit required for custom path | HIGH | Verified in Oracle's Python mTLS doc |
| SQLAlchemy thick-mode connect_args shape | HIGH | Cross-verified with `ORACLE_SQLALCHEMY.md` |
| NCS 871 not settable on Free Tier | HIGH | Verified in Oracle's character set selection doc |
| 7-day inactivity / 90-day reclaim | HIGH | Verified in current Oracle Always Free doc |
| Instant Client 23.x works against 19c server | HIGH | Oracle Doc ID 207303.1 interoperability matrix |

---

## 12. Open questions / things to confirm hands-on

- **Exact current Instant Client version string.** The download page may have a newer 23.x build by Phase 1 execution. Install flow is unchanged; only the filename and directory suffix vary.
- **Home region choice.** Latency is personal. North American users → Ashburn/Phoenix; European users → Frankfurt/London. All support Always Free 19c.
- **Whether any signup region is blocking 19c radio selection.** If the radio doesn't appear, abandon and re-sign with a different region (tenancy is permanent, so reuse email at your peril).

---

## Sources

- [Always Free Autonomous AI Database (Oracle docs)](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/autonomous-always-free.html)
- [Always Free Autonomous Database 19c](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/autonomous-always-free-desc.html)
- [Choose a Character Set for Autonomous Database](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/autonomous-character-set-selection.html)
- [Downloading Wallet Files for Autonomous Database](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/connect-download-wallet.html)
- [Connect Python Applications with a Wallet (mTLS)](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/connecting-python-mtls.html)
- [Database Service Names for Autonomous AI Database](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/predefined-database-services-names.html)
- [Oracle Instant Client Downloads for macOS (ARM64)](https://www.oracle.com/database/technologies/instant-client/macos-arm64-downloads.html)
- [Instant Client for macOS (Intel x86)](https://www.oracle.com/database/technologies/instant-client/macos-intel-x86-downloads.html)
- [Oracle Instant Client Installation Guide 23ai (macOS)](https://docs.oracle.com/en/database/oracle/oracle-database/23/mxcli/installing-and-removing-oracle-database-client.html)
- [python-oracledb Initializing docs](https://python-oracledb.readthedocs.io/en/stable/user_guide/initialization.html)
- [python-oracledb Thin vs Thick differences](https://python-oracledb.readthedocs.io/en/latest/user_guide/appendix_b.html)
- [python-oracledb Troubleshooting](https://python-oracledb.readthedocs.io/en/stable/user_guide/troubleshooting.html)
- [Oracle Cloud Free Tier FAQ](https://www.oracle.com/cloud/free/faq/)
- [Oracle Cloud Infrastructure Free Tier docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)
- [Client / Server Interoperability Matrix (Oracle Doc ID 207303.1)](https://support.oracle.com/knowledge/Oracle%20Database%20Products/207303_1.html)
