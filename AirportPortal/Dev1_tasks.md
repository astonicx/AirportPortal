# Developer 1 — Backend & Auth Lead

**Focus:** Express bootstrap, SQLite, authentication, password recovery, security middleware, deployment.
**Parallelism note:** Tasks 1–4 unblock the entire team. After Task 4, Dev 2 can start flights/booking and Dev 3 can start frontend pages.

---

## Task 1 — Repo & tooling baseline
Dependencies: None
Expected Output:
- Updated `package.json` with scripts: `dev`, `dev:client`, `dev:server`, `build`, `start`, `lint`, `test`.
- `.env.example` containing `VITE_API_BASE_URL`, `PORT`, `CLIENT_ORIGIN`, `BEARER_TOKEN`, `ROOT_EMAIL`, `ROOT_PASSWORD`.
- README quickstart (install, run, env setup).

## Task 2 — Express server bootstrap
Dependencies: Task 1
Expected Output:
- [server/server.js](server/server.js) configured with CORS (origin = `CLIENT_ORIGIN`), JSON + cookie parsers, request-id middleware, `GET /health`, centralized error handler.
- `server/middleware/` folder with `requestId.js`, `errorHandler.js`.

## Task 3 — SQLite layer & migrations
Dependencies: Task 2
Expected Output:
- `server/db/index.js` exporting a singleton `better-sqlite3` instance.
- `server/db/migrations/0001_init.sql` containing all tables listed in `project_tasks.md` §A.3.
- Migration runner executed on server boot; idempotent.
- Root admin seeded from env on first boot.

## Task 4 — API client + caching + 555 retry
Dependencies: Task 3
Expected Output:
- Extended [server/utils/apiClient.js](server/utils/apiClient.js): bearer-token injection, exponential backoff retry (max 3) specifically on `HTTP 555`, structured error objects.
- `server/utils/cache.js` with `getCached(id)`, `putCached(id, payload)`, `pruneOlderThan(days)`.

## Task 7 — Password hashing utilities
Dependencies: Task 3
Expected Output:
- [server/utils/password.js](server/utils/password.js) extended with `hashPassword(plain) → {hash, salt}` and `verifyPassword(plain, hash, salt) → bool` using PBKDF2-SHA256 (≥100k iterations) or argon2.
- Same helper reused for security-question answers.
- Unit tests covering hash/verify.

## Task 8 — Signup endpoint + duplicate-name handling
Dependencies: Task 7
Expected Output:
- `POST /api/auth/signup` accepting full Req 7 payload.
- Server-side validation (zod): required fields, password length policy (≤10 → reject, ≥18 → strong flag), CAPTCHA answer check, ≥3 security questions.
- Generates a unique `login_disambiguator` when (first_name, last_name) collides; returned in success response.
- Persists hashed password + hashed answers.

## Task 9 — Login + lockout endpoint
Dependencies: Task 8
Expected Output:
- `POST /api/auth/login` accepting `firstName`, `lastName`, `password`, `disambiguator?`, `rememberMe?`.
- Tracks failures per identity; 3 fails → 1h lock in `user_lockouts`.
- Response includes `attemptsRemaining` and `lockedUntil` when applicable.
- Sets HttpOnly secure session cookie; expiration = remember-me lifetime or sliding idle window per user's `auto_logout_minutes`.
- Updates `last_login_ip`, `last_login_datetime`.

## Task 10 — Logout + session refresh
Dependencies: Task 9
Expected Output:
- `POST /api/auth/logout` invalidates session row.
- `GET /api/auth/me` returns user profile + `must_change_password`, `must_complete_profile` flags.
- Sliding idle update on each authenticated request.

## Task 11 — Password recovery via security questions
Dependencies: Task 9
Expected Output:
- `POST /api/auth/recover/init` (first+last+dob) → list of question prompts (no answers).
- `POST /api/auth/recover/answer` verifies all answers (constant-time compare).
- `POST /api/auth/recover/reset` issues a short-lived reset token then sets new password.
- Customer accounts only; admins/root rejected with 403.

## Task 38 — Input sanitization & validation
Dependencies: Tasks 8, 23, 33 (coordinate with Dev 2 and Dev 3)
Expected Output:
- zod schemas covering every POST/PATCH route.
- Helmet middleware + strict CSP (allow self + Vite dev server in dev).
- Audit: confirm every SQL call is parameterized (no string concatenation).
- README security section.

## Task 39 — Rate limiting & lockouts
Dependencies: Task 9
Expected Output:
- `express-rate-limit` on `/api/auth/*` (5 req / min / IP) and `/api/bookings` (10 req / min / IP).
- Login route integrates with `user_lockouts`.

## Task 34 — Root admin endpoints
Dependencies: Task 33 (Dev 3)
Expected Output:
- `GET/POST/PATCH/DELETE /api/admin/admins` guarded by `RequireRoot`.
- Cannot delete root account; cannot demote root.
- Audit entries in `admin_audit`.

## Task 37 (backend half) — Admin-created customer first-login flow
Dependencies: Tasks 9, 33
Expected Output:
- Admin create-customer endpoint sets `must_change_password=1`, `must_complete_profile=1`.
- `/auth/me` exposes flags; middleware blocks non-completion routes for affected users.

## Task 43 — Deployment prep
Dependencies: Task 42
Expected Output:
- Production build script that runs Vite build and copies output to `server/public`; Express serves it.
- `Dockerfile` (multi-stage: build → runtime node:20-alpine).
- README deploy section + env checklist.
- Smoke-tested local production run.

---

**Workload summary:** 13 tasks. Front-loaded with foundation work that unblocks teammates within the first sprint, ending with security + deployment.
