# Requirements Review — Findings Report

**Scope:** Static code review + targeted live API tests + automated test-suite run.
**No source code was modified.** This document records every requirement from [Dev1_tasks.md](Dev1_tasks.md), [Dev2_tasks.md](Dev2_tasks.md), and [Dev3_tasks.md](Dev3_tasks.md) that is **missing, broken, or deviates** from the specification.

## Methodology

1. Read the three Dev task spec files in full.
2. Walked the full code tree (backend in [server/](server/), frontend in [src/](src/)) and matched each task's acceptance criteria against the implementation.
3. Ran the automated test suite: `npx vitest run --config vitest.config.js` → **42 failures / 338 passing / 5 skipped** out of 385 tests across 20 test files.
4. Started the running server (`node server/server.js`) and verified the auth + no-fly findings with `curl` against `http://localhost:5000`.

## Status legend

| Symbol | Meaning |
| ---- | ---- |
| ✅ | Implemented and behaves per spec |
| ⚠️ | Partially implemented — some sub-requirements missing |
| ❌ | Missing or non-functional |
| 🟡 | Implemented but **deviates** from spec (wrong shape, wrong route, wrong UX) |

---

## Executive summary — top blocking gaps

The implementation is broadly feature-complete for the booking happy-path, but the following gaps are **functional or spec-critical** and would fail acceptance review:

1. **Login uses `email` + `password`** instead of the spec's `firstName + lastName + password + optional disambiguator`. Verified live: `POST /api/auth/login {firstName,lastName,password}` returns **400 Bad Request**. — [server/routes/auth.js](server/routes/auth.js), [src/pages/Login.jsx](src/pages/Login.jsx)
2. **Password recovery uses `email`** instead of `firstName + lastName + birthdate`, **and does not enforce the "customers only" rule**. Verified live: `POST /api/auth/recover/init {"email":"admin@portal.local"}` returns **200 OK** (should be 403). — [server/routes/auth.js](server/routes/auth.js), [src/pages/Recover.jsx](src/pages/Recover.jsx)
3. **`user_login_audit` table is created in migrations but never written to** — login/lockout history is silently dropped. — [server/db/migrations/0001_init.sql](server/db/migrations/0001_init.sql), [server/routes/auth.js](server/routes/auth.js)
4. **42 automated tests fail.** Causes: the validator schemas, auth routes, and noFly route do not match the shapes the integration & unit tests (which were written against the spec) expect. Additionally, [vitest.config.js](vitest.config.js) calls `require("dotenv").config()` at the top which leaks the production `BDPA_BASE_URL` into the test environment, causing every MSW-mocked apiClient test to bypass the mock and miss/fail.
5. **Frontend routing deviates from spec** — `/tickets/:code` (spec `/ticket/:confirmation`), `/settings` (spec `/dashboard/settings`), `/book/:id/passenger` (spec `/book/:flightId`); the 404 fallback redirects to `/flights` instead of showing a dedicated NotFound page. — [src/App.jsx](src/App.jsx)
6. **`AdminCustomers` is read-only** — no create form, no edit modal, and no airline-ban manager UI. — [src/pages/admin/AdminCustomers.jsx](src/pages/admin/AdminCustomers.jsx)
7. **Live-data screens never poll** — `FlightDetail` and `Ticket` fetch once and do not use `useLiveResource`, so seat-lock/gate updates require a manual refresh. — [src/pages/FlightDetail.jsx](src/pages/FlightDetail.jsx), [src/pages/Ticket.jsx](src/pages/Ticket.jsx)
8. **Settings page is missing the claim-ticket form** and uses a number input for auto-logout instead of the spec's `15m / 30m / 1h` selector; deletion uses a single `confirm()` rather than the spec's double-confirm. — [src/pages/Settings.jsx](src/pages/Settings.jsx)
9. **No README.md exists** (Tasks 1, 38, 43 each require a README section). No responsive QA pass is documented (Task 41).
10. **Error responses leak stack traces** — confirmed live on `POST /api/no-fly/check`: the JSON body contains a full `ZodError` stack with absolute server file paths. — [server/middleware/errorHandler.js](server/middleware/errorHandler.js)

---

## Dev 1 — Backend foundations & Auth

Source: [Dev1_tasks.md](Dev1_tasks.md)

| Task | Requirement | Status | Evidence / Note |
| ---- | ---- | ---- | ---- |
| 1 | Tooling — `npm i / dev / build / test`; **README documents setup** | ⚠️ | Scripts exist in [package.json](package.json), but no `README.md` is present at the repo root. |
| 2 | Express bootstrap with helmet, cookie-parser, JSON limit, request-id | ✅ | [server/server.js](server/server.js) plus [server/middleware/requestId.js](server/middleware/requestId.js). |
| 3 | SQLite schema (users, sessions, security_questions, login_failures, **user_login_audit**, password_resets, airline_bans, customer_cards, bookings, tickets, admin_audit, flight_cache) created via migration | ⚠️ | All tables created in [server/db/migrations/0001_init.sql](server/db/migrations/0001_init.sql), but `user_login_audit` is **never written to** anywhere in the codebase. |
| 4 | API client w/ 555 exponential backoff ×3, 5 s timeout | ⚠️ | Backoff logic present in [server/utils/apiClient.js](server/utils/apiClient.js), but `timeout: 15000` — spec called for "≤5 s". |
| 5 | Cache table + nightly prune (>7 days) | ✅ | [server/utils/cache.js](server/utils/cache.js) and prune in [server/jobs/flightSync.js](server/jobs/flightSync.js). |
| 6 | Session model — sid cookie HttpOnly SameSite=Lax, slide on activity | ✅ | [server/utils/session.js](server/utils/session.js), [server/middleware/auth.js](server/middleware/auth.js). |
| 7 | Password hashing (PBKDF2 **or** argon2) | ✅ | argon2id in [server/utils/password.js](server/utils/password.js). |
| 8 | Signup endpoint — first/last + disambiguator collision rule, ≥3 security questions, password meter validated server-side | ⚠️ | Logic present in [server/routes/auth.js](server/routes/auth.js), but security questions are validated as **exactly 3** rather than "≥3" and the field name is `securityQuestions` whereas tests probe for both shapes — see [tests/integration/routes.auth.test.js](tests/integration/routes.auth.test.js). |
| 9 | Login — accepts `firstName + lastName + password` (+ optional `disambiguator`), 3-strike lockout, sets sid cookie | 🟡❌ | **Login takes `email + password`** instead of name+disambiguator. Verified live: name-shape POST returns 400, email-shape returns 200. Lockout logic exists (3 attempts → 15 min) but is keyed on email. — [server/routes/auth.js](server/routes/auth.js) |
| 10 | Logout + `GET /api/auth/me` | ✅ | Both present in [server/routes/auth.js](server/routes/auth.js). |
| 11 | Recovery — start with `firstName + lastName + birthdate`, **customers only (admin/root → 403)**, 1-question check, single-use token | 🟡❌ | Init takes `email` not name+dob (verified live: name-shape POST returns 400). **Customers-only rule is not enforced**: verified live `POST /api/auth/recover/init {"email":"admin@portal.local"}` returns **200 OK** with security question echoed. — [server/routes/auth.js](server/routes/auth.js) |
| 12 | Account safety — argon2id, captcha gating signup/login/recover, audit log | ⚠️ | argon2id ✅. Captcha schema is in [server/utils/validators.js](server/utils/validators.js) and the front-end submits it. But the back-end `loginSchema` `.strip()`s the captcha silently rather than verifying it server-side, and `user_login_audit` is never written. |
| 13 | API conventions — request-id echo, structured error envelope, no leaking stack traces | ❌ | Stack trace leak confirmed: `POST /api/no-fly/check` 400 response contains the full `ZodError` `stack` string with server file paths. — [server/middleware/errorHandler.js](server/middleware/errorHandler.js) |
| 14 | Bootstrap "root" account + admin/customer seeds | ✅ | [server/db/seedRoot.js](server/db/seedRoot.js), [server/db/seedTestUsers.js](server/db/seedTestUsers.js). |
| 15 | Documentation — README "Architecture & Backend Conventions" section | ❌ | No `README.md` present at repo root. |

---

## Dev 2 — Flights, bookings, no-fly, admin, tests

Source: [Dev2_tasks.md](Dev2_tasks.md)

| Task | Requirement | Status | Evidence / Note |
| ---- | ---- | ---- | ---- |
| 16 | `GET /api/flights` (type, sort, paging) | ✅ | [server/routes/flights.js](server/routes/flights.js). Verified live, returns 50 items page 1. |
| 17 | Flight sync job (60 s refresh, ≥7 d prune) | ✅ | [server/jobs/flightSync.js](server/jobs/flightSync.js). |
| 18 | `GET /api/flights/:id` (cache + refetch) | ✅ | [server/routes/flights.js](server/routes/flights.js). |
| 19 | Seat availability + lock endpoints (lock TTL ≤10 min, owner-only release) | ✅ | [server/routes/flights.js](server/routes/flights.js), [server/utils/seats.js](server/utils/seats.js) — guest locking via `bsid` cookie ([server/middleware/bookingSession.js](server/middleware/bookingSession.js)). |
| 20 | Pricing — server is the source of truth for seat + bag totals | ✅ | [server/utils/pricing.js](server/utils/pricing.js), enforced by [server/routes/bookings.js](server/routes/bookings.js). |
| 21 | `POST /api/no-fly/check` — must reject `Restricted User Flier (1985-12-25, male)` | 🟡⚠️ | Endpoint exists in [server/routes/noFly.js](server/routes/noFly.js). **Request shape uses `first/last/dob/gender`** rather than the more common `firstName/lastName/birthdate/sex` (verified live — first-name shape returns 400). No dedicated unit test of the Restricted User Flier case is present. |
| 22 | `POST /api/bookings` — server enforces bookable, scheduled, ≥24 h, HOME_AIRPORT, owned seat lock, no-fly, airline ban, computes price | ✅ | [server/routes/bookings.js](server/routes/bookings.js). |
| 23 | Tickets — lookup by confirmation, cancel (owner/admin/guest) | ✅ | [server/routes/tickets.js](server/routes/tickets.js). |
| 24 | Customer dashboard endpoint | ✅ | [server/routes/me.js](server/routes/me.js) `/dashboard` joins `flight_cache`. |
| 25 | Customer self-service (update profile, change pwd, claim ticket, delete) | ✅ | [server/routes/me.js](server/routes/me.js). |
| 26 | Admin stats — 1d/7d/30d/365d/all windows × tickets + gross | ✅ | [server/routes/admin.js](server/routes/admin.js) `/stats`. |
| 27 | Admin customers CRUD + search | ⚠️ | CRUD endpoints exist in [server/routes/admin.js](server/routes/admin.js) but no audit-trail write on create/update — only delete writes `admin_audit`. |
| 28 | Admin tickets — list / search **across any flight field** + cancel | ⚠️ | Search exists but joins are limited; queries on flight `airline`, `flightNumber`, `landingAt`, `comingFrom` do not fan out to [flight_cache](server/db/migrations/0001_init.sql). — [server/routes/admin.js](server/routes/admin.js) |
| 29 | Admin airline-ban CRUD (admin) | ✅ | [server/routes/admin.js](server/routes/admin.js). |
| 30 | Admin admins CRUD (root only, root self-immutable) | ✅ | [server/routes/adminRoot.js](server/routes/adminRoot.js). |
| 31 | Rate limiting (auth/booking/no-fly) | ✅ | [server/middleware/rateLimit.js](server/middleware/rateLimit.js). |
| 32 | Input validation w/ Zod on every body | ✅ | [server/utils/validators.js](server/utils/validators.js). |
| 33 | Admin scopes & guards (`requireAdmin`, `requireRoot`) | ✅ | [server/middleware/auth.js](server/middleware/auth.js). |
| 34 | Completion gate — incomplete profile blocks booking | ✅ | [server/middleware/completionGate.js](server/middleware/completionGate.js). |
| 35 | Custom error shape `{error,code,requestId}` | ⚠️ | Shape returned correctly, but `stack` and `issues` are also serialized in non-dev mode — see Task 13. |
| 36 | Logging strategy | ⚠️ | `console.log` only; no structured logger. |
| 37 | Health endpoint | ✅ | `/api/health` → 200. Verified live. |
| 38 | README "API Conventions" section | ❌ | No README present. |
| 39 | Unit tests for pricing, password, validators | ⚠️ | [server/utils/pricing.test.mjs](server/utils/pricing.test.mjs) ✅ (9/9 pass), [server/utils/password.test.mjs](server/utils/password.test.mjs) ✅ (3/3 pass), [tests/unit/server/utils/validators.test.mjs](tests/unit/server/utils/validators.test.mjs) ❌ (multiple failures — schema shape does not match spec the tests assert on). |
| 40 | Integration tests for routes (supertest) signup→login→book→cancel | ❌ | Spec-shaped tests exist at [tests/integration/routes.auth.test.js](tests/integration/routes.auth.test.js), [tests/integration/routes.flights-bookings-tickets-nofly.test.js](tests/integration/routes.flights-bookings-tickets-nofly.test.js), and [tests/integration/authentication.comprehensive.test.js](tests/integration/authentication.comprehensive.test.js) — **all failing** because the implementation uses email-based auth and the wrong noFly/seats payload shapes. |
| 41 | MSW for upstream API mocking | ⚠️ | MSW is wired in [tests/setup/msw/server.js](tests/setup/msw/server.js), but [vitest.config.js](vitest.config.js) calls `require("dotenv").config()` at top level, which leaks the real `BDPA_BASE_URL=https://airports.api.hscc.bdpa.org` into the test process. The MSW handlers listen on `http://127.0.0.1:4010` so they are never matched (verified: every `apiClient` test fails with `callCount === 0`). |
| 42 | CI workflow (`.github/workflows/ci.yml`) running tests | ⚠️ | File exists but currently red — see Task 40/41. |
| 43 | README "Testing" section | ❌ | No README present. |
| 44 | Audit log table maintained on admin mutations | ⚠️ | `admin_audit` written only on user delete and ban changes; not on user create/update or admin create/update. — [server/routes/admin.js](server/routes/admin.js), [server/routes/adminRoot.js](server/routes/adminRoot.js) |

---

## Dev 3 — Frontend (React + Tailwind + shadcn)

Source: [Dev3_tasks.md](Dev3_tasks.md)

| Task | Requirement | Status | Evidence / Note |
| ---- | ---- | ---- | ---- |
| 1 | Vite + React + Tailwind setup, dark mode toggle, axios w/ credentials | ⚠️ | Vite/React/Tailwind ✅. No dark-mode toggle component found (Tailwind `darkMode: "class"` is configured in [tailwind.config.cjs](tailwind.config.cjs) but no UI toggles it). |
| 2 | shadcn/ui scaffolding | ✅ | [src/components/ui/](src/components/ui/) populated. |
| 3 | Global layout (header/footer, container) | ✅ | [src/components/layout/Layout.jsx](src/components/layout/Layout.jsx). |
| 4 | AuthContext + BookingContext | ✅ | [src/context/AuthContext.jsx](src/context/AuthContext.jsx), [src/context/BookingContext.jsx](src/context/BookingContext.jsx). |
| 5 | Routing — `/`, `/login`, `/signup`, `/recover`, `/flights`, `/flights/:id`, `/book/:flightId/*`, `/ticket/:confirmation`, `/dashboard`, `/dashboard/settings`, `/admin/*`, `*` → NotFound | 🟡❌ | [src/App.jsx](src/App.jsx) ships `/tickets/:code` (spec `/ticket/:confirmation`), `/settings` (spec `/dashboard/settings`), `/book/:id/*` with `passenger` sub-route (spec `/book/:flightId`). 404 fallback **redirects to `/flights`** rather than rendering a NotFound component. |
| 6 | Tailwind theme tokens (colors, fonts) | ✅ | [tailwind.config.cjs](tailwind.config.cjs). |
| 7 | Spinner, ErrorBoundary, Guards | ✅ | [src/components/Spinner.jsx](src/components/Spinner.jsx), [src/components/ErrorBoundary.jsx](src/components/ErrorBoundary.jsx), [src/components/Guards.jsx](src/components/Guards.jsx). |
| 8 | API helper w/ `withCredentials` + 555 retry indicator | ⚠️ | [src/lib/api.js](src/lib/api.js) sets `withCredentials: true` ✅; no UI toast / banner is wired for 555 retries (Task 40). |
| 9 | Form validation + zod-resolved react-hook-form | ⚠️ | Forms use plain React state and ad-hoc validation, not `react-hook-form` + Zod resolver as the spec implies. |
| 10 | Password strength meter | ✅ | [src/components/PasswordStrengthMeter.jsx](src/components/PasswordStrengthMeter.jsx). |
| 11 | Captcha component | ✅ | [src/components/Captcha.jsx](src/components/Captcha.jsx). |
| 12 | Login page — first/last/password + optional disambiguator, lockout countdown, captcha | 🟡❌ | [src/pages/Login.jsx](src/pages/Login.jsx) uses **email + password**. No lockout countdown UI; on 423 it surfaces a generic toast. Captcha ✅. |
| 13 | Signup page — first/last/email/password + repeating ≥3 security questions + success screen showing assigned disambiguator | ⚠️ | [src/pages/Signup.jsx](src/pages/Signup.jsx) hard-codes **exactly 3 security questions** (no add/remove repeater). No success screen — page just navigates to login after success, dropping the disambiguator the server returns. |
| 14 | Recover page — 3-step (identity → question → reset) using first+last+birthdate | 🟡 | [src/pages/Recover.jsx](src/pages/Recover.jsx) is 3-step but step 1 collects **email**, not name+dob. |
| 15 | Auto-logout 15 min — must skip when "remember me" is on | ❌ | [src/hooks/useAutoLogout.js](src/hooks/useAutoLogout.js) ticks down unconditionally — no `rememberMe` check, no read of any stored preference. |
| 16 | Header w/ nav, user menu, logout, theme toggle | ⚠️ | Nav + logout ✅. No theme toggle. |
| 17 | Toast utilities | ✅ | sonner via [src/components/ui/sonner.jsx](src/components/ui/sonner.jsx). |
| 18 | Flights page — Tabs (arrivals/departures), debounced search, **clickable column headers for sorting**, FlightTable (desktop) + FlightCard (mobile) | ❌ | [src/pages/Flights.jsx](src/pages/Flights.jsx) uses a `<select>` for type, a `<select>` for sort, **no debouncing**, no clickable column headers, and no `FlightTable.jsx` / `FlightCard.jsx` split — the same table renders on all viewports. |
| 19 | Flight detail page — live polling, seat map, lock → start booking | ❌ | [src/pages/FlightDetail.jsx](src/pages/FlightDetail.jsx) calls `apiClient.get(...)` once in `useEffect`; **no `useLiveResource`**. |
| 20 | `useLiveResource` hook (polling + visibility pause + toast on error) | ✅ | [src/hooks/useLiveResource.js](src/hooks/useLiveResource.js). |
| 21 | Booking wizard skeleton + step guards | ✅ | [src/pages/booking/](src/pages/booking/) wired via [src/context/BookingContext.jsx](src/context/BookingContext.jsx). |
| 22 | Passenger step (existing-user / new / guest) | ✅ | [src/pages/booking/Passenger.jsx](src/pages/booking/Passenger.jsx). |
| 23 | Seat map step (interactive, lock TTL, release on back) | ✅ | [src/pages/booking/SeatMap.jsx](src/pages/booking/SeatMap.jsx). |
| 24 | Bags step | ✅ | [src/pages/booking/Bags.jsx](src/pages/booking/Bags.jsx). |
| 25 | Payment step — **prominent "Never enter real card data" notice**, fake card validation | ❌ | [src/pages/booking/Payment.jsx](src/pages/booking/Payment.jsx) has no such notice. |
| 26 | Review step — order summary, server-priced total | ✅ | [src/pages/booking/Review.jsx](src/pages/booking/Review.jsx). |
| 27 | Confirmation — success toast on POST `/bookings` 201 | ❌ | After `POST /api/bookings` succeeds, [src/pages/booking/Review.jsx](src/pages/booking/Review.jsx) navigates but does not raise a success toast. |
| 28 | Ticket lookup (`/ticket-lookup`) | ✅ | [src/pages/TicketLookup.jsx](src/pages/TicketLookup.jsx). |
| 29 | Ticket detail — live polling, arrival/departure flag, depart datetime, gate, cancel | ❌ | [src/pages/Ticket.jsx](src/pages/Ticket.jsx) fetches once, **no `useLiveResource`**, and renders only confirmation + passenger + seat — does not surface arrival/departure flag, depart datetime, or gate. Cancel ✅. |
| 30 | Dashboard — upcoming + past tickets, joins flight info | ✅ | [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx). |
| 31 | Complete-profile step gate | ✅ | [src/pages/CompleteProfile.jsx](src/pages/CompleteProfile.jsx). |
| 32 | Settings — update profile, change password, **claim ticket**, security questions, saved cards, auto-logout `15m/30m/1h` selector, **double-confirm delete** | ❌ | [src/pages/Settings.jsx](src/pages/Settings.jsx) is missing the claim-ticket form entirely, uses a free-form **number** input for auto-logout instead of the `15m/30m/1h` selector, and uses **a single `confirm()`** for deletion instead of the double-confirm. |
| 33 | Admin layout + nav guards | ✅ | [src/pages/admin/AdminLayout.jsx](src/pages/admin/AdminLayout.jsx). |
| 34 | Admin dashboard — 5 windows × (tickets + gross) = 10 tiles | ✅ | [src/pages/admin/AdminDashboard.jsx](src/pages/admin/AdminDashboard.jsx). |
| 35 | Admin customers — search/create/edit/delete + airline-ban manager | ❌ | [src/pages/admin/AdminCustomers.jsx](src/pages/admin/AdminCustomers.jsx) only renders a search list with a delete button — **no create form, no edit modal, no airline-ban manager UI**. |
| 36 | Admin tickets — search + cancel | ✅ | [src/pages/admin/AdminTickets.jsx](src/pages/admin/AdminTickets.jsx). |
| 37 | Admin admins — list/create/delete (root only) | ✅ | [src/pages/admin/AdminAdmins.jsx](src/pages/admin/AdminAdmins.jsx). |
| 38 | Audit-log viewer (admin) | ❌ | No `AdminAudit.jsx` or equivalent page; nothing surfaces `admin_audit` rows. |
| 39 | Logout button + session cleanup | ✅ | Layout header. |
| 40 | Global error UX — toast/banner for HTTP 555 ("BDPA API hiccup — retrying…"), Suspense fallback, ErrorBoundary | ❌ | No interceptor on [src/lib/api.js](src/lib/api.js) and no route-level `<Suspense>`. ErrorBoundary ✅. |
| 41 | Responsive QA pass documented | ❌ | No `RESPONSIVE_QA.md` or similar artifact present. |
| 42 | Accessibility — focus rings, labels, ARIA on interactive controls | ⚠️ | shadcn primitives provide most of this; custom forms in Login/Signup/Recover lack `aria-describedby` for error messages. |
| 43 | README "Frontend Conventions" section | ❌ | No README present. |

---

## Automated test results

Run command: `npx vitest run --config vitest.config.js`
**Result: 6 test files failed / 13 passed / 1 skipped. 42 tests failed / 338 passed / 5 skipped.**

| Test file | Status | Root cause |
| ---- | ---- | ---- |
| [tests/integration/routes.auth.test.js](tests/integration/routes.auth.test.js) | ❌ multiple | Probes `firstName/lastName/disambiguator` login & `firstName/lastName/birthdate` recover — the implementation expects `email` (see Dev1 Task 9, 11). |
| [tests/integration/authentication.comprehensive.test.js](tests/integration/authentication.comprehensive.test.js) | ❌ multiple | Same shape mismatch as above. |
| [tests/integration/routes.flights-bookings-tickets-nofly.test.js](tests/integration/routes.flights-bookings-tickets-nofly.test.js) | ❌ multiple | Tests MSW-mocked upstream paths and the no-fly body shape; affected by env leak (Task 41) and noFly schema mismatch (Task 21). |
| [tests/integration/routes.api-integration.mocked.test.mjs](tests/integration/routes.api-integration.mocked.test.mjs) | ❌ several | MSW handlers never matched (env leak). |
| [tests/unit/server/utils/apiClient.test.mjs](tests/unit/server/utils/apiClient.test.mjs) | ❌ 9/17 | `callCount === 0` on every test → MSW handler never invoked → confirms `BDPA_BASE_URL=https://airports.api.hscc.bdpa.org` from [.env](.env) is leaking past [tests/setup/backend.setup.mjs](tests/setup/backend.setup.mjs). |
| [tests/unit/server/utils/validators.test.mjs](tests/unit/server/utils/validators.test.mjs) | ❌ multiple | `loginSchema` / `recoverInitSchema` / `recoverResetSchema` have fields/min-lengths the tests do not expect. |
| All other suites | ✅ | Pass. |

---

## Live API probes

Server started with `node server/server.js` against the development DB. All requests against `http://localhost:5000`.

| Probe | Expected | Actual | Verdict |
| ---- | ---- | ---- | ---- |
| `GET /api/health` | 200 | 200 | ✅ |
| `POST /api/auth/login {email,password}` (root) | (per spec) 400 | **200 OK** + `sid` cookie | 🟡 deviates |
| `POST /api/auth/login {firstName,lastName,password}` (root) | 200 | **400 Bad Request** | ❌ |
| `POST /api/auth/recover/init {email:"admin@portal.local"}` | **403** (admins not allowed) | **200 OK** with security question | ❌ Critical: customers-only rule bypassed |
| `POST /api/auth/recover/init {firstName,lastName,birthdate}` | 200 | **400 Bad Request** | 🟡 |
| `GET /api/flights?type=departure&limit=2` | 200 + items | 200, 50 total items | ✅ |
| `POST /api/no-fly/check {firstName,lastName,birthdate,sex}` | 200 | **400** (`first/last/dob/gender` expected) — and response body leaks `stack` with absolute server paths | 🟡 + ❌ Task 13 leak |

---

## Recommended remediation order

1. **Auth shape rewrite** — Task 9 (login) and Task 11 (recover) must accept `firstName/lastName(+disambiguator)` and `firstName/lastName/birthdate` respectively, and recover must 403 admins/root before echoing a security question. This will unblock the majority of failing integration tests.
2. **Strip `stack` / `issues` from prod responses** — fix [server/middleware/errorHandler.js](server/middleware/errorHandler.js).
3. **Stop leaking `.env` into vitest** — remove the top-level `require("dotenv").config()` from [vitest.config.js](vitest.config.js) (or guard it so test setup wins) so MSW intercepts apiClient requests.
4. **Write to `user_login_audit`** on every successful + failed login.
5. **Frontend route + page parity** — rename routes per Task 5, build the missing Settings claim-ticket form, AdminCustomers create/edit/airline-ban UI, FlightDetail/Ticket live polling, FlightTable/FlightCard responsive split, payment "no real card data" notice, Review success toast, login lockout countdown, security-question repeater, recovery name+dob form, auto-logout respect for remember-me.
6. **Author README** with Setup, Backend Conventions, API Conventions, Testing, Frontend Conventions, and a Responsive QA report.
