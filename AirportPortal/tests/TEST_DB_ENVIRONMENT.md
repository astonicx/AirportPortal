# SQLite Test Environment

This project now uses a dedicated SQLite test database environment that is isolated from production data.

## What is created

- Test migrations: `tests/db/migrations/*.sql`
- Deterministic seed data: `tests/db/seeds/deterministicSeed.mjs`
- Lifecycle scripts:
  - `tests/db/scripts/setup.mjs`
  - `tests/db/scripts/reset.mjs`
  - `tests/db/scripts/teardown.mjs`
- Reusable helper utilities: `tests/helpers/backend/sqliteTestEnv.mjs`

## Separation from production data

- Test DB files are created only under `tests/.tmp/db`.
- The helper enforces a path safety check and rejects non-test DB paths.
- Backend tests set `DB_PATH` to a worker-scoped test file, not `server/data.sqlite`.

## Automated lifecycle timing

Backend test lifecycle is configured in `tests/setup/backend.setup.mjs`.

- Setup runs: once per Vitest worker in `beforeAll`
  - Creates/cleans worker test DB file
  - Runs production migrations (`server/db/migrations`)
  - Runs test migrations (`tests/db/migrations`)
- Reset runs via automated script command:
  - `npm run test:db:reset`
  - Reset behavior clears all non-migration tables and resets `sqlite_sequence`
  - Deterministic seed rows are applied after reset
- Teardown runs: once per worker in `afterAll`
  - Closes DB connection
  - Deletes test DB file and `-wal`/`-shm` artifacts

## Deterministic seed behavior

- Seed utility inserts fixed users, security questions, flight cache, ticket, and airline ban rows.
- IDs and key values are deterministic after reset.
- Seeds are **opt-in** during test runs to avoid interfering with tests that require an empty DB.

Use seeded runs with:

```bash
npm run test:backend:seeded
```

## Manual lifecycle commands

```bash
npm run test:db:setup
npm run test:db:reset
npm run test:db:teardown
```

`test:db:setup` and `test:db:reset` apply deterministic seed data.
