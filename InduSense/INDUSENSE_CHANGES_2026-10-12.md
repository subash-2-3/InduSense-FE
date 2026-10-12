# InduSense: changes made (2026-10-11 → 2026-10-12)

This covers the work done across the three repositories:

| Repository | Path | Branch |
|---|---|---|
| Backend | `D:\subash\DNA\projects\backend\InduSense-BE` | `feat/backend-v1` |
| DataLogger | `D:\subash\DNA\projects\datalog\InduSense-DataLogger` | `main` |
| Frontend | `D:\subash\DNA\projects\frontend\InduSense-FE` | `main` |

**Nothing has been committed or pushed.** All changes are in the working trees. See
[Git state](#9-git-state-and-what-you-need-to-decide).

---

## 1. Why: in one paragraph

InduSense must handle **15 companies × 10 machines × 10 tags at 1 sample per second = 1,500 values per
second** (about 130 million rows per day). I measured the system at that scale on a test database. Two
things were too slow:

1. The DataLogger could not store 1,500 values/s; it reached about 1,200.
2. Dashboards and reports over a day or more took **10 seconds to 5 minutes**, because they read every
   raw 1-second row.

The changes below fix both, and every fix was verified with measurements. Separately, I fixed the
**forgot-password bug** (HTTP 500) found earlier, and **updated the READMEs** of all three repositories.

---

## 2. The result in numbers

Everything was measured on this laptop, with MySQL 8.0 at its default 128 MB memory setting, against a
test database of about 20 million rows. Your application database was never used for tests.

**Storing data (DataLogger), 1,500 values per second for 5 minutes:**

| | Before the fixes | After |
|---|---|---|
| Values stored per second | ~1,200 (fell behind) | 1,500 (keeps up) |
| Lost / stored twice | n/a | 0 / 0 |
| 60-second database outage | not tested | 94,902 values buffered on disk and replayed in 15 s, 0 lost |

**Reading data (dashboards and reports):**

| Screen | Before | After |
|---|---|---|
| Machine dashboard, 24 h | 18.8 s | 0.08 s |
| Machines overview (whole company), 24 h | 293 s (≈ 5 min) | 0.34 s |
| Downtime report (whole company), 24 h | 101 s | 0.13 s |
| Machine dashboard, 7 days | 74 s | 0.19 s |
| Machine dashboard, 30 days | 142 s | 0.57 s |
| Raw readings table, a page deep in the list | 2.0 s | 0.009 s |

---

## 3. Backend (InduSense-BE)

### 3.1 Faster database index (migration `0011`)

- **What:** the index `idx_telemetry_tag_ts` on the `telemetry` table changed from `(tag_id, ts)` to
  `(tag_id, ts, id, value)`. The name stayed the same.
- **Why:** dashboards need the `value` of each row. Before, MySQL had to fetch every row separately
  from the table; now it reads everything from the index. That alone made dashboards about 5× faster.
- **Cost:** about 8 extra bytes per row. Storing data was not measurably slower.
- **File:** `alembic/versions/20261011_0011_telemetry_covering_index.py`, plus `app/models/telemetry.py`.

### 3.2 Pre-calculated 5-minute summaries ("rollups", migration `0012`)

- **What:** a new table `telemetry_rollup_5m` holds, for every tag and every 5-minute period, the count,
  sum, min, max, first and last value, and the counter increase. For machine run-status tags it also
  holds the exact run/stop changes.
  - Dashboards and reports over long ranges read these summaries, about 300× fewer rows than raw data.
  - The newest few minutes and short ranges are still read from raw data, so screens stay live.
- **Correctness:** the results are **identical** to reading raw data. Tests compare both ways:
  - counter resets, gaps, and Run/Idle/Stop state maps;
  - several time zones, including India +5:30;
  - late and replayed data.

  The comparison was also run on the 20-million-row MySQL test database.
- **How the summaries are kept up to date:** a background job,
  `python -m app.cli rollup run --loop`.
  - Every minute it recalculates the 5-minute periods that received new data.
  - Periods are recalculated from raw data, never added to, so data that arrives late or is resent
    after an outage is never counted twice.
  - Raw telemetry is only read, never changed.
- **Safe without the job:** if the job is not running, or the tables don't exist yet, screens simply
  read raw data as before. Same results, just slower.
- **New commands:**

  | Command | What it does |
  |---|---|
  | `python -m app.cli rollup run --loop` | keeps the summaries up to date (run it as a background service) |
  | `python -m app.cli rollup backfill --since 2026-09-01T00:00:00Z` | builds summaries for older data |
  | `python -m app.cli rollup status` | shows how far the summaries reach |
  | `python -m app.cli telemetry-storage --keep-days 30` | shows table sizes, daily growth, free disk, and what a 30-day retention *would* delete. It never deletes anything. |

- **Files (new):**
  - `alembic/versions/20261011_0012_telemetry_rollups.py`
  - `app/models/telemetry_rollup.py`
  - `app/services/rollup.py`
  - `app/repositories/rollup.py`
  - `app/services/telemetry_storage.py`
- **Files (changed):**
  - `app/services/analytics.py` (reads summaries + raw edges and merges them)
  - `app/repositories/analytics.py`
  - `app/services/dashboard.py`
  - `app/cli.py`
  - `app/core/config.py`
- **New settings** (in `.env.example`): `ROLLUP_READ_ENABLED`, `ROLLUP_SETTLE_SECONDS`,
  `ROLLUP_INTERVAL_SECONDS`, `ROLLUP_MIN_SPAN_SECONDS`.

### 3.3 Faster paging of raw data ("cursor" paging)

- **What:** the raw-data lists accept a `cursor` parameter:
  - `/telemetry`, `/devices/{id}/telemetry` and `/tags/{id}/telemetry`;
  - `/reports/energy/details`.

  Instead of "give me page 1000", the client says "continue after the last row I saw". No total count
  is calculated, and page 1000 is as fast as page 1.
- **Compatible:** the old `page=` paging still works; responses only gained two fields, `next_cursor`
  and `has_more`.
- **Files:**
  - `app/core/cursor.py` (new)
  - `app/repositories/telemetry.py`
  - `app/services/telemetry.py`
  - `app/api/v1/telemetry.py`
  - `app/services/energy.py`
  - `app/api/v1/reports.py`
  - `app/schemas/telemetry.py`
  - `app/schemas/energy.py`

### 3.4 Forgot-password fix (separate from the telemetry work)

- **The bug:** `POST /auth/forgot-password` returned **HTTP 500** whenever `DEBUG=false`. The code read
  a setting that does not exist (`settings.is_development`).
- **A security problem found on the way:** with `DEBUG=true`, the reset token came back in the
  response. Anyone could then reset anyone's password.
- **Fixed:**
  - No more 500.
  - The token is returned only when the new setting `PASSWORD_RESET_TOKEN_IN_RESPONSE=true` is set,
    for local development. It is refused in staging and production.
  - Every request now counts toward the rate limit. Before, only unknown emails did, which revealed
    which emails have accounts.
- **Still missing:** no email is sent yet. Until that exists, an administrator resets passwords from
  the Users page.
- **Files:**
  - `app/services/auth.py`
  - `app/core/config.py`
  - `app/api/v1/auth.py`
  - `app/schemas/auth.py`
  - `tests/test_security.py` (the 3 failing tests now pass)
  - `tests/test_password_reset.py` (new, 14 tests)

### 3.5 Small fixes found while testing on MySQL

- **Migrations `0003` and `0010` could not be undone on MySQL.** Their downgrade dropped an index that
  a foreign key still needed. Only the downgrade part changed; upgrades are unchanged.
- **Test `tests/test_asset_tags.py` failed only on MySQL.** It re-read a row inside an old database
  snapshot; the test now ends that snapshot first.

### 3.6 Benchmark tool and documentation

- `scripts/telemetry_benchmark.py` (new) builds the synthetic test database and times every dashboard
  and report. It refuses to run against the application database.
- `docs/TELEMETRY_SCALING.md` (new) has the full design, all measurements, storage estimates and
  retention options.
- `docs/DATABASE.md`, `README.md` and `.env.example` are updated.

---

## 4. DataLogger (InduSense-DataLogger)

### 4.1 Keeping up with 1,500 values per second

1. **"Last seen" updates were slow.** After every batch the logger sent one
   `UPDATE devices SET last_seen_at` per device: 150 separate statements, which took most of the
   batch time.
   - Now it is **one statement per batch**, and each device is updated at most every 10 seconds.
   - The time never moves backwards when old buffered data is replayed.
   - New setting: `DEVICE_LAST_SEEN_INTERVAL_SECONDS` (default 10).
   - Files: `app/database/mysql_repository.py`, `app/config.py`, `app/main.py`.
2. **Overflow to the local buffer was slow.** When the in-memory queue was full, each value was written
   to the SQLite buffer in its own transaction, which capped the logger at about 1,500/s.
   - Now values go in groups (up to 200 values or 0.5 s).
   - File: `app/ingestion/writer.py`.

### 4.2 Test scripts

- `scripts/load_test.py` (new) pushes synthetic data through the real logger pipeline into a **test**
  database. It can simulate a database outage and duplicate messages, and it reports lost and duplicate
  counts exactly.
- `scripts/profile_save_many.py` (new) times each step of one batch write.

### 4.3 Schema documents

- `sql/reference/indusense_v1_schema.sql` and `docs/DATABASE_CONTRACT.md` show the new index. The
  logger itself never changes the schema; the backend still owns it.

### 4.4 Tests and README

- **New unit tests:** the "last seen" throttling, and the grouped overflow (`tests/test_mysql_repository.py`,
  `tests/test_writer.py`, `tests/fake_mysql.py`).
- **README:** documents these changes. It also corrects an old statement, "the logger never writes to
  a PLC", which became wrong when write commands (Start/Stop, resets) were added. It now explains
  `MODBUS_WRITE_ENABLED`.

---

## 5. Frontend (InduSense-FE)

- **Energy reports → Detailed readings** now pages with **Previous / Next** (cursor paging) instead of
  page numbers. That screen lists raw samples. Counting millions of them for "page X of Y" was the slow
  part, so the backend no longer counts them.
- **Files:**
  - `features/energy/energy-reports-page.component.ts`
  - `features/energy/energy-reports.scss`
  - `core/api/api-envelope.ts`
  - `core/api/resources/energy.api.ts`
  - `core/api/resources/telemetry.api.ts`
  - `core/models/energy.ts`
  - `core/models/telemetry.ts`
- **New test:** in `features/energy/energy-pages.spec.ts`.
- **README:** brought up to date. It was very old: it still said Alarms was "coming soon" and
  described only the Device Summary dashboard. It now lists every page with its permission.

---

## 6. What was changed on your actual database (`indusense`)

Done with your approval ("yes" / "sure"):

1. **Migrations 0011 and 0012 applied.** The database went from revision `0010` to `0012` in under 2
   seconds. Your 32,195 telemetry rows are untouched.
2. **Rollups backfilled** for your existing data (27–29 Sep 2026): 1,190 summary rows.

**Also fixed after you saw the 500 errors:** `/dashboards/energy/overview`, `/trends` and
`/distribution` failed right after the code change, because the database was not migrated yet. The
backend now reads raw data when the rollup tables don't exist. That's why those screens work again,
and a test covers it.

**Not running yet:** the rollup job (`rollup run --loop`). New data is still shown correctly; it is
simply read raw until the job runs.

---

## 7. Tests run (latest results)

| Suite | Result |
|---|---|
| Backend, SQLite | 396 passed, 9 skipped (those need MySQL) |
| Backend, MySQL (test database `indusense_be_test`) | 404 passed |
| DataLogger, unit | 711 passed, 130 skipped (the opt-in integration tests) |
| DataLogger, integration (real MySQL + Mosquitto) | 128 passed |
| Frontend | 363 passed; production build OK |

---

## 8. Things to know (risks and limits)

- **Disk space on this PC:** MySQL stores its data on **C:**, which has about 25 GB free. At full scale
  (1,500 values/s) raw data grows about **26–29 GB per day**. A production server needs a bigger data
  disk, or a retention policy.
- **MySQL memory:** MySQL uses its default 128 MB of memory. A production server should get several GB.
- **Old data deletion (DataLogger):** `.env.example` sets `DATA_RETENTION_DAYS=30`. *If* the retention
  task is installed, raw data older than 30 days is deleted. It is **not installed** on this PC.
- **Database account:** the backend connects to MySQL with an account that has full admin rights.
  Production should use a limited account.
- **Not measured:**
  - a full year of data;
  - alarm history at large scale;
  - binary-log growth;
  - company-wide screens over 72 h or more *before* the changes (too slow to measure).
- **Test databases left on the MySQL server** (synthetic data only):
  - `indusense_loadtest`, about 3.7 GB on C:;
  - `indusense_be_test`, small.

---

## 9. Git state and what you need to decide

**Git:**
- **Nothing committed or pushed.**
- **DataLogger:** most changes are already **staged** (`git add`). I did not stage them, so please
  check. A few later edits are unstaged.
- **Backend and Frontend:** all changes are unstaged; new files are untracked.

**Your decisions:**

1. **Commit** the changes in each repository, and choose the commit messages and branches.
2. **Start the rollup job** permanently (Task Scheduler or a Windows service):
   `python -m app.cli rollup run --loop` in `InduSense-BE`.
3. **Retention:** how long to keep raw data. The options are in `InduSense-BE/docs/TELEMETRY_SCALING.md`.
4. **Server:** more MySQL memory, a bigger data disk, and a limited database account.
5. **Delete the test databases** `indusense_loadtest` and `indusense_be_test` to free disk space.
6. **Forgot password:** whether to add email sending, and a "forgot password" screen in the frontend.
