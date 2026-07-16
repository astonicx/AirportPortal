# Airport Portal

A full-stack flight booking portal built for the BDPA practice scenario. Customers
browse live arrivals/departures, book seats, and manage tickets; admins manage
customers, tickets, and airline bans. The backend proxies and caches the upstream
BDPA flight API.

## Setup

Prerequisites: Node.js 18+.

```bash
npm install
```

Environment (create a `.env` in the repo root):

```
BDPA_BASE_URL=https://<bdpa-upstream>      # upstream flight API base
BDPA_API_KEY=<your-key>                     # if required by upstream
SESSION_SECRET=<random-string>
PORT=5000                                    # backend port (default 5000)
```

Run the backend (Express + SQLite):

```bash
node server/server.js
```

Run the frontend dev server (Vite, port 3000, proxies `/api` → backend):

```bash
npm run dev
```

### Shared Dev Backend (team uses one customer list)

If multiple teammates need to see the same admin customers/logins, run one shared backend
instance and point all frontends at it.

On the machine hosting the shared backend (`.env`):

```
PORT=5000
DB_PATH=/absolute/path/to/shared.sqlite
CLIENT_ORIGINS=http://localhost:3000,https://<teammate-frontend-origin>
SESSION_COOKIE_SAME_SITE=none
SESSION_COOKIE_SECURE=true
```

Then each teammate sets their frontend env:

```
VITE_API_BASE_URL=https://<shared-backend-host>
```

Run helpers:
- `npm run check:shared-env` validates required shared backend env values.
- `npm run dev:server:shared` validates shared env values, then starts backend.
- `npm run dev:shared` starts frontend + shared-config backend together.

Notes:
- SQLite is file-based, so data is local to the machine where the backend process runs.
- `SameSite=None` + `Secure=true` is required for cross-origin auth cookies in browsers.

Build the frontend for production:

```bash
npx vite build      # outputs to dist/
```

### Seeded accounts

| Role     | Email                     | Password               |
| -------- | ------------------------- | ---------------------- |
| Root     | root@portal.local         | ChangeMeImmediately!   |
| Admin    | admin@portal.local        | AdminPassword123!      |
| Customer | customer@portal.local     | CustomerPassword123!   |

## Architecture & Backend Conventions

- **Stack:** Express 4, better-sqlite3 (WAL mode), argon2id password hashing, zod
  request validation.
- **Layout:**
  - `server/routes/` — one router per resource (`auth`, `me`, `flights`,
    `bookings`, `tickets`, `admin`, …).
  - `server/middleware/` — auth/session guards and the central `errorHandler`.
  - `server/utils/` — `apiClient` (upstream proxy), `cache`, `password`,
    `validators` (shared zod schemas).
- **Validation:** every request body is parsed with a zod schema from
  `server/utils/validators.js`. Validation failures flow to `errorHandler`, which
  returns `{ error, issues }`. Stack traces are **never** included in responses.
- **Auth:** login accepts either an `email` (email-based form) **or**
  `firstName`/`lastName` (+ optional `disambiguator` for name collisions, which
  returns `409 { needsDisambiguator: true }`). Failed logins are written to
  `user_login_audit`; 3 failures lock the account for 1 hour (`423`).
- **Account recovery:** customers-only. `/recover/init` looks up by
  `firstName`/`lastName`/`dob` and returns security questions; non-customers get
  `403`.
- **Auditing:** admin mutations (customer create/update/delete) write to
  `admin_audit`.
- **Caching:** upstream flight payloads are cached in `flight_cache` and joined
  into ticket/admin views so searches can match flight fields.

## API Conventions

- All app routes are under `/api`. JSON in, JSON out.
- Errors use `{ error: string }` (plus `issues` for validation errors).
- Upstream BDPA endpoints used: `/v1/flights/search?type=arrival|departure&sort=desc`,
  `/v1/info/no-fly-list`, `/v1/flights/:id/book`.
- Seat locks require an authenticated session/booking id; lock/unlock return
  `401` for guests and `409` when a lock is not owned by the caller.
- An upstream `555` status is surfaced to the user as a non-fatal "retrying" toast.

## Frontend Conventions

- **Stack:** React 18, Vite 5, Tailwind 3, react-router-dom 6, sonner (toasts).
- **Alias:** `@/` → `src/`.
- **Live data:** pages poll with the `useLiveResource(path, { intervalMs })` hook,
  which re-fetches on an interval (only while the tab is visible) and emits a
  `toast` event when data changes.
- **Toasts:** components dispatch `window` `CustomEvent("toast", { detail })`;
  `components/layout/Layout.jsx` bridges these to sonner.
- **Responsive lists:** flight lists render a sortable `FlightTable` (desktop) and
  `FlightCard` list (mobile) from the same data.
- **Routing:** spec paths `ticket/:code`, `dashboard/settings`, `book/:id` are
  supported (with backward-compatible aliases). Unknown routes render `NotFound`.
- **Payment page** shows a prominent "demo only — never enter real card data"
  notice. Account deletion requires a double confirmation.

## Testing

Backend tests (Vitest + MSW intercepting the upstream API):

```bash
npx vitest run --config vitest.config.js
```

MSW intercepts the upstream at `http://127.0.0.1:4010` so tests never hit the real
BDPA API. The frontend is validated via `npx vite build`.
