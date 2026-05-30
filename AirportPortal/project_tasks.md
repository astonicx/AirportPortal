# BDPA Airports Portal — Project Tasks

> Source problem statement: [bdpa-airports-part-1.md](https://github.com/nhscc/problem-statements/blob/main/2026/airports/bdpa-airports-part-1.md)
> Reference API: [hsccdfbb7244.docs.apiary.io](https://hsccdfbb7244.docs.apiary.io)
> Stack: React + Vite + TailwindCSS (frontend), Express + SQLite (backend)
> Env: `VITE_API_BASE_URL=http://localhost:3000`, `PORT=5000`, `CLIENT_ORIGIN=http://localhost:5000`
> Backend talks to BDPA API with `BEARER_TOKEN = "Tobedeterminelater"`

---

## A. Requirements Summary

### A.1 Functional Requirements

**User types and authentication**
- Three user types: **guest** (unauthenticated), **customer** (authenticated), **admin** (privileged); plus a single **root** admin.
- Guests can view/search/sort all flights, book bookable departing flights, view tickets via last name + confirmation code, cancel/refund pre-departure tickets, and register a customer account.
- Customers can do everything guests do (except register), plus view/edit their dashboard, delete their account, and view a paginated list of booked flights.
- Admins can access an admin dashboard, create/delete customer accounts, ban specific people from specific airlines, view/modify customer accounts (not type), but cannot create/modify/delete other admins.
- Root admin is unique, can never be deleted, and is the only user that can create/modify/delete other admins.

**Flights view (Req 2)**
- Paginated list of arrivals and departures (separately), excluding `status=="past"`.
- Public (guests see it too).
- Display: scheduled arrival/depart time, city from/to, airline name, flight number, latest status.
- Departures also show: latest gate, destination airport code.
- Search and sort by flight number, airline, airport, city, arrival/departure time, gate.
- "Book this flight" CTA for bookable flights (departures landing at our airport, more than 24 hours out, `bookable==true`, `status=="scheduled"`).

**Booking view (Req 3)**
- If entering directly, prompt for destination (city/state/country/airport) and date.
- Collect passenger identity: first/middle/last name, sex/gender, birthday, phone, email.
- Collect payment: card number, expiry, CVC, cardholder name, billing address, zip (fake data only). Logged-in customers can save the card for reuse.
- Seat selection from 90 seats (graphical seat-map preferred), single seat price from API.
- Bag selection: 0–2 carry-on (1st free, 2nd $30), 0–5 checked (1st free, 2nd $50, each additional $100).
- Review and confirm; navigate to ticket view; if logged in, attach to account.
- Enforce No Fly List check (Req 9) before confirming.

**Ticket view (Req 4)**
- Shows: arrival/departure flag, airline + flight number, destination, depart/arrive date+time, passenger name, gate, confirmation number, current status.
- Time, gate, and status update asynchronously.
- Access paths: customer dashboard link, post-booking redirect, guest lookup (last name + confirmation), admin link.

**Customer dashboard (Req 5)**
- Shows name, last_login_ip, last_login_datetime.
- Upcoming and past flights with async updates of date/time/location.
- Edit personal info, change default flight sort, manage saved cards, set auto-logout (15 min / 5 min / 1 hour), claim past guest bookings via confirmation + matching last name.

**Admin dashboard (Req 6)**
- Tickets sold (day, week, month, year, all-time).
- Gross profit (day, week, month, year, all-time).
- CRUD on customers; view any ticket by confirmation; create tickets; cancel/refund upcoming tickets (irreversible, seat released); search customers by any field; search tickets by any flight field.

**Registration (Req 7)**
- Fields per spec, with required markers, password strength meter (≤10 weak rejected, >17 strong), 3+ user-defined security questions, custom CAPTCHA.
- Admin-created customers prompted on first login to change password and complete required fields.

**Login (Req 8)**
- Login with at least first name + last name + password (must support duplicate-name users safely).
- 3 failed attempts → 1-hour lockout; show remaining attempts.
- "Remember me" persistent session; otherwise idle timeout (default 15 min, customer-configurable).
- Redirect to dashboard on success.

**No Fly List (Req 9)**
- Case-insensitive match on first/middle/last + birthdate + sex/gender against API No Fly List blocks booking.

**Password recovery (Req 10)**
- Customers only, via security questions. Admins/root excluded.

**Async updates (Req 11)** — all flight/ticket views update without page refresh.

**Pagination (Req 12)** — all large lists paginated.

**Security (Req 13)** — no XSS/SQLi; passwords hashed (salted SHA-256 or bcrypt/argon2); never store cleartext, encoded, or reversibly encrypted passwords.

**Graceful failure (Req 14)** — handle API errors (incl. HTTP 555), show spinners, never blank screens > 1s.

**Responsive UI (Req 15)** — mobile/tablet/desktop; mobile-first.

### A.2 Non-Functional Requirements
- Performance: first meaningful paint < ~1s; async updates feel real-time (polling interval ≤ 30s acceptable).
- Accessibility: keyboard navigable forms, semantic HTML, ARIA on dynamic regions, color contrast.
- Resilience: retry/backoff on API failures incl. `HTTP 555`; circuit-breaker style local cache fallback for read endpoints.
- Maintainability: modular React components, shared API client, typed (JSDoc) helpers.
- Security: bearer token only used server-side; client never sees `BEARER_TOKEN`.

### A.3 Data Requirements (local SQLite schema)
- `users` (id, type [guest/customer/admin/root], title, first_name, middle_name, last_name, suffix, dob, gender, address1, city, state, zip, country, phone, email, password_hash, password_salt, default_sort, auto_logout_minutes, must_complete_profile, must_change_password, created_at).
- `user_login_audit` (id, user_id, ip, ua, success, attempted_at).
- `user_lockouts` (user_id, locked_until, failed_count).
- `security_questions` (id, user_id, question, answer_hash, answer_salt).
- `sessions` (id, user_id, token_hash, remember_me, expires_at, created_at, last_seen_at).
- `saved_cards` (id, user_id, last4, brand, exp_month, exp_year, cardholder_name, billing_address, billing_zip, token_fake).
- `tickets` (id, confirmation_code, user_id [nullable], flight_id, passenger_first, passenger_middle, passenger_last, passenger_dob, passenger_gender, passenger_email, passenger_phone, seat, carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents, status [active/cancelled/refunded], booked_at, cancelled_at).
- `seat_locks` (flight_id, seat, ticket_id, locked_until) — releases on cancel.
- `airline_bans` (id, user_or_passenger_identity, airline) — admin-set restrictions.
- `flight_cache` (flight_id PK, payload_json, fetched_at).
- `admin_audit` (id, admin_id, action, target_type, target_id, payload_json, at).

### A.4 API Integration Requirements
All requests proxied through Express to hide `BEARER_TOKEN`. Endpoints used (per Apiary docs):
- `GET /v1/flights` — paginated flight listing (server caches in `flight_cache`).
- `GET /v1/flights/:id` — single flight detail.
- `GET /v1/airports` — airport metadata.
- `GET /v1/airlines` — airline metadata.
- `GET /v1/no-fly-list` (or `POST /v1/no-fly-list/check`) — No Fly List verification.
- `POST /v1/flights/:id/book` — book a seat (only for `bookable==true` flights).
- `DELETE /v1/tickets/:id` — refund/cancel a booked seat.
- Handle `HTTP 555` with retry-with-backoff (max 3 attempts) and surface friendly errors.

### A.5 User Flows
1. **Guest browses + books**: Home → Flights list → Flight detail → Booking form (passenger → payment → seat → bags → review) → No-Fly check → API book → Ticket view (confirmation code shown).
2. **Guest looks up ticket**: Home → "Find my ticket" → enter last name + confirmation → Ticket view.
3. **Guest registers**: Home → Sign up → form (with CAPTCHA + security questions + strength meter) → email-as-username created → redirected to login.
4. **Customer login**: Login (firstName + lastName + password [+ disambiguator if needed]) → Dashboard.
5. **Customer dashboard**: View upcoming/past flights → click → Ticket view; edit settings; claim past guest ticket; delete account.
6. **Password recovery**: Login → "Forgot password" → first/last + DOB → answer security questions → reset password.
7. **Admin login**: Login → Admin dashboard (stats, customer search, ticket search, create customer, cancel ticket).
8. **Root**: Admin dashboard + Admin management (create/edit/delete admins).

### A.6 System Constraints
- Flights generated hourly, ≤16h/day, ≤30 days in advance; some hours empty.
- `past` flights deleted from API after 7 days — local cache must preserve customer history.
- Booking only allowed if `bookable==true`, `status=="scheduled"`, `arriveAtReceiver` > now + 24h.
- 90 seats per flight, all same price.
- API returns `HTTP 555` randomly; payloads may be tampered with.
- All sensitive ops happen server-side; bearer token never exposed to browser.

---

## B. Full Task Breakdown

> Format: `## Task N — Title` / Description / Deliverables / Dependencies / Owner-fit (F=frontend, B=backend, S=shared).

### Phase 0 — Foundations

#### Task 1 — Repo & tooling baseline (S)
Description: Confirm Vite + React + Tailwind scaffold, lockfile, lint/format config, `.env.example` with `VITE_API_BASE_URL`, `PORT`, `CLIENT_ORIGIN`, `BEARER_TOKEN`. Add npm scripts: `dev:client`, `dev:server`, `dev` (concurrently), `build`, `lint`, `test`.
Deliverables: updated `package.json`, `.env.example`, `README` quickstart.
Dependencies: none.

#### Task 2 — Express server bootstrap (B)
Description: Configure Express with CORS limited to `CLIENT_ORIGIN`, JSON body parser, cookie parser, request-id middleware, centralized error handler, health route `GET /health`.
Deliverables: `server/server.js`, `server/middleware/`.
Dependencies: Task 1.

#### Task 3 — SQLite layer & migrations (B)
Description: Add `better-sqlite3`, build a `db` module, write migration runner, seed root admin from env (`ROOT_EMAIL`, `ROOT_PASSWORD`).
Deliverables: `server/db/index.js`, `server/db/migrations/0001_init.sql`, seed script.
Dependencies: Task 2.

#### Task 4 — API client + caching + 555 retry (B)
Description: Centralized fetch wrapper that injects bearer token, retries on `HTTP 555` with exponential backoff (3 tries), normalizes errors. Add `flight_cache` write-through helper.
Deliverables: `server/utils/apiClient.js` (extend existing), `server/utils/cache.js`.
Dependencies: Task 3.

#### Task 5 — Frontend app shell & routing (F)
Description: Install `react-router-dom`, define routes (`/`, `/flights`, `/flights/:id`, `/book/:flightId`, `/ticket/:confirmation`, `/ticket-lookup`, `/login`, `/signup`, `/recover`, `/dashboard`, `/dashboard/settings`, `/admin`, `/admin/customers`, `/admin/tickets`, `/admin/admins`). Add Layout (Header/Footer/Container) + 404 page.
Deliverables: updated [src/App.jsx](AirportPortal/src/App.jsx), `src/pages/*`, layout components.
Dependencies: Task 1.

#### Task 6 — Tailwind theme, responsive grid, base UI (F)
Description: Define Tailwind theme tokens, container breakpoints, dark-mode optional. Wire up existing `components/ui/*` (button, card, dialog, form, input, label, table, tabs, toast).
Deliverables: `tailwind.config.cjs` tweaks, theme tokens, base styles in [src/index.css](AirportPortal/src/index.css).
Dependencies: Task 5.

### Phase 1 — Auth core

#### Task 7 — Password hashing utilities (B)
Description: Implement salted PBKDF2 (or argon2) password hash + verify helpers. Reuse for security-question answers.
Deliverables: `server/utils/password.js` (extend existing).
Dependencies: Task 3.

#### Task 8 — Auth schema, signup endpoint (B)
Description: `POST /api/auth/signup` with full Req 7 fields, password strength enforcement (≤10 rejected, ≥18 strong), CAPTCHA echo check, security questions persistence, duplicate-name safe disambiguator (assigns unique `login_disambiguator` per first+last collision; returned to user once + emailed if present).
Deliverables: route, validators, tests.
Dependencies: Task 7.

#### Task 9 — Login + lockout endpoint (B)
Description: `POST /api/auth/login` accepts first, last, password, optional disambiguator, remember-me. Track failures in `user_lockouts`; 3 fails → 1h lock. Returns remaining attempts. Issues HttpOnly secure session cookie; sliding idle timeout per `auto_logout_minutes`; persistent if remember-me.
Deliverables: route, session middleware.
Dependencies: Task 8.

#### Task 10 — Logout + session refresh (B)
Description: `POST /api/auth/logout`, `GET /api/auth/me`, idle-timeout sliding update.
Deliverables: routes.
Dependencies: Task 9.

#### Task 11 — Password recovery via security questions (B)
Description: `POST /api/auth/recover/init` (first+last+dob → returns question prompts), `POST /api/auth/recover/answer` (verify answers), `POST /api/auth/recover/reset` (set new password). Customers only.
Deliverables: routes.
Dependencies: Task 9.

#### Task 12 — Frontend Login page (F)
Description: Form (first, last, optional disambiguator, password, remember-me), error display, attempts-left indicator, lockout state, link to signup/recover.
Deliverables: `src/pages/Login.jsx`.
Dependencies: Tasks 9, 6.

#### Task 13 — Frontend Signup page with CAPTCHA + strength meter (F)
Description: Full Req 7 form with progressive validation, password strength bar, security-questions repeater (3+), in-app arithmetic CAPTCHA component.
Deliverables: `src/pages/Signup.jsx`, `src/components/Captcha.jsx`, `src/components/PasswordStrengthMeter.jsx`.
Dependencies: Tasks 8, 6.

#### Task 14 — Frontend Recover page (F)
Description: Three-step UI matching recovery endpoints; displays user's own questions; resets password.
Deliverables: `src/pages/Recover.jsx`.
Dependencies: Tasks 11, 13.

#### Task 15 — Auth context + protected routes (F)
Description: React `AuthContext` calling `/api/auth/me`; `RequireAuth`, `RequireAdmin`, `RequireRoot` route guards; auto-logout timer hook.
Deliverables: `src/context/AuthContext.jsx`, `src/components/RequireAuth.jsx`.
Dependencies: Tasks 10, 5.

### Phase 2 — Flights & API

#### Task 16 — Backend flights proxy + cache (B)
Description: `GET /api/flights?type=arrival|departure&page&pageSize&q&sortBy&sortDir` paginating, searching, sorting locally over cached snapshot refreshed from API. `GET /api/flights/:id` reads from cache, falls back to API on miss. Strip `past` from public listing.
Deliverables: `server/routes/flights.js`.
Dependencies: Task 4.

#### Task 17 — Flight cache refresher (B)
Description: Background interval (e.g. every 60s) fetches updated flight pages from API and updates `flight_cache`; cleans `past` entries older than 7 days (but keeps any flight referenced by an active or historical ticket).
Deliverables: `server/jobs/flightSync.js`.
Dependencies: Task 16.

#### Task 18 — Frontend Flights view (F)
Description: Tabs for Arrivals/Departures, table/cards with search input, sortable column headers, pagination control, "Book this flight" CTA conditional on bookable+24h rule, status badges, gate column for departures. Mobile-friendly cards.
Deliverables: `src/pages/Flights.jsx`, `src/components/FlightTable.jsx`, `src/components/FlightCard.jsx`.
Dependencies: Tasks 16, 6.

#### Task 19 — Flight detail page (F)
Description: Shows all flight fields; if bookable shows "Book" button → `/book/:flightId`; otherwise reason hint.
Deliverables: `src/pages/FlightDetail.jsx`.
Dependencies: Task 18.

#### Task 20 — Async update hook (F)
Description: `useLiveResource(key, fetcher, intervalMs)` polling helper with visibility-pause and toast on update. Used by flights/tickets/dashboard.
Deliverables: `src/hooks/useLiveResource.js`.
Dependencies: Task 5.

### Phase 3 — Booking pipeline

#### Task 21 — No Fly List check endpoint (B)
Description: `POST /api/no-fly/check` proxies to API, normalizes case, returns boolean + reason.
Deliverables: route + unit test using documented test passenger.
Dependencies: Task 4.

#### Task 22 — Seat availability + locking (B)
Description: `GET /api/flights/:id/seats` returns 90-seat map merged with held tickets and short-lived `seat_locks`. `POST /api/flights/:id/seats/lock` reserves a seat for 10 min during checkout.
Deliverables: routes, seat-map data structure.
Dependencies: Task 16, Task 3.

#### Task 23 — Booking endpoint (B)
Description: `POST /api/bookings` validates: bookable, scheduled, >24h, seat lock owned, No Fly cleared, airline-ban cleared for passenger. Calls API book, persists `tickets` row, returns confirmation code (server-generated, cryptographically random, 8 char).
Deliverables: `server/routes/bookings.js`.
Dependencies: Tasks 21, 22, 9.

#### Task 24 — Ticket lookup + cancel endpoints (B)
Description: `GET /api/tickets/by-confirmation` (requires last name + confirmation), `POST /api/tickets/:id/cancel` (guest with last+confirmation OR owner OR admin; only if not yet departed). Releases seat lock, calls API cancel, sets `status='cancelled'`.
Deliverables: routes.
Dependencies: Task 23.

#### Task 25 — Booking UI: passenger + payment forms (F)
Description: Multi-step wizard step 1 (passenger info incl. middle, sex, DOB, phone, email) and step 2 (payment with masking, never real card warning, "save for later" if logged in).
Deliverables: `src/pages/Booking/Passenger.jsx`, `src/pages/Booking/Payment.jsx`, shared state via reducer.
Dependencies: Tasks 19, 15.

#### Task 26 — Booking UI: seat map (F)
Description: Graphical 90-seat layout (e.g., 18 rows × 5 plus aisles), shows taken/locked/selected/available, calls lock endpoint on select.
Deliverables: `src/pages/Booking/SeatMap.jsx`.
Dependencies: Tasks 22, 25.

#### Task 27 — Booking UI: bags + review + confirm (F)
Description: Bag counters (0–2 carry, 0–5 checked) with live total ($30 / $50 / $100 rules), review screen, submit → calls `/api/bookings`; on success redirect to ticket view with confirmation.
Deliverables: `src/pages/Booking/Bags.jsx`, `src/pages/Booking/Review.jsx`.
Dependencies: Tasks 23, 26.

#### Task 28 — Ticket lookup page (F)
Description: Form (last name + confirmation) → ticket view.
Deliverables: `src/pages/TicketLookup.jsx`.
Dependencies: Task 24.

#### Task 29 — Ticket view page (F)
Description: Renders all required fields; async refresh via `useLiveResource`; cancel/refund button when eligible.
Deliverables: `src/pages/Ticket.jsx`.
Dependencies: Tasks 20, 24.

### Phase 4 — Customer dashboard & settings

#### Task 30 — Dashboard endpoints (B)
Description: `GET /api/me/dashboard` (name, last_login_ip/datetime, upcoming + past flights via tickets joined with cache), `PATCH /api/me` (profile edits), `DELETE /api/me` (account deletion + ticket history retention), `POST /api/me/cards`, `DELETE /api/me/cards/:id`, `POST /api/me/claim-ticket` (last name + confirmation → attach guest ticket).
Deliverables: `server/routes/me.js`.
Dependencies: Tasks 10, 23.

#### Task 31 — Customer dashboard UI (F)
Description: Cards for personal info, upcoming flights (async-updated), past flights, settings link.
Deliverables: `src/pages/Dashboard.jsx`.
Dependencies: Tasks 30, 20.

#### Task 32 — Customer settings UI (F)
Description: Edit profile, default flight sort selector, manage saved cards, auto-logout selector (15m/5m/1h), delete account confirm, claim-ticket form.
Deliverables: `src/pages/Settings.jsx`.
Dependencies: Task 31.

### Phase 5 — Admin & Root

#### Task 33 — Admin endpoints (B)
Description: `GET /api/admin/stats` (tickets sold + gross for d/w/m/y/all), `GET/POST/PATCH/DELETE /api/admin/customers`, `GET /api/admin/tickets` (search by flight fields), `POST /api/admin/tickets/:id/cancel`, `POST /api/admin/airline-bans`, `DELETE /api/admin/airline-bans/:id`. Enforce admin scope; block admin-on-admin writes.
Deliverables: `server/routes/admin.js`.
Dependencies: Tasks 23, 30.

#### Task 34 — Root admin endpoints (B)
Description: `GET/POST/PATCH/DELETE /api/admin/admins` restricted to root. Root cannot be deleted.
Deliverables: route extensions.
Dependencies: Task 33.

#### Task 35 — Admin dashboard UI (F)
Description: Stats tiles (tickets + gross x 5 windows), customer search/edit table, ticket search by any field, create-customer form, airline-ban manager, cancel ticket action.
Deliverables: `src/pages/Admin/Dashboard.jsx`, `src/pages/Admin/Customers.jsx`, `src/pages/Admin/Tickets.jsx`.
Dependencies: Tasks 33, 6.

#### Task 36 — Root admin UI (F)
Description: Admins manager (list/create/edit/delete), visible only when current user is root.
Deliverables: `src/pages/Admin/Admins.jsx`.
Dependencies: Tasks 34, 35.

#### Task 37 — Admin-created customer first-login flow (F+B)
Description: Backend flag `must_change_password` + `must_complete_profile` returned by `/auth/me`. Frontend gate forces profile completion before accessing other routes.
Deliverables: backend flag wiring + `src/pages/CompleteProfile.jsx`.
Dependencies: Tasks 9, 15, 33.

### Phase 6 — Security, resilience, polish

#### Task 38 — Input sanitization & validation (S)
Description: Use `zod` or `joi` schemas server-side; React forms use trusted text only (no `dangerouslySetInnerHTML`); parameterized SQLite queries everywhere; CSP + Helmet on Express.
Deliverables: schemas, Helmet config, audit notes.
Dependencies: Tasks 8, 23, 33.

#### Task 39 — Rate limiting & lockouts (B)
Description: `express-rate-limit` on auth + booking; integrate with `user_lockouts`.
Deliverables: middleware.
Dependencies: Task 9.

#### Task 40 — Global error UI + spinners (F)
Description: ErrorBoundary, route-level fallbacks, Suspense-friendly spinners, toast for API errors (incl. HTTP 555 message "BDPA API hiccup — retrying…"). Never show blank screen > 1s.
Deliverables: `src/components/ErrorBoundary.jsx`, `src/components/Spinner.jsx`.
Dependencies: Task 5.

#### Task 41 — Responsive QA pass (F)
Description: Verify mobile/tablet/desktop on all pages; fix overflow, tap targets ≥ 44px, sticky headers, drawer nav on mobile.
Deliverables: CSS/layout fixes.
Dependencies: All UI tasks.

#### Task 42 — Test suite (S)
Description: Vitest unit tests (password hash, validators, bag pricing, sort), supertest integration tests (auth, booking flow, admin), React Testing Library for key pages. Mock BDPA API.
Deliverables: `tests/` folder, CI script.
Dependencies: Phases 1–5.

#### Task 43 — Deployment prep (S)
Description: Production build script, single-node serving (Express serves Vite `dist`), env templating, `Dockerfile`, README deploy section, seeded root admin instructions.
Deliverables: `Dockerfile`, updated README, build verified.
Dependencies: Task 42.

---

## C. Dependency Graph

```
1 ── 2 ── 3 ── 4 ── 16 ── 17
│         │    │     │
│         │    │     └── 18 ── 19 ── 25 ── 26 ── 27 ── 29
│         │    │                              ▲
│         │    └── 21 ─┐                      │
│         │            ├── 23 ── 24 ── 28 ────┘
│         │    22 ─────┘                ▲
│         │                             │
│         └── 7 ── 8 ── 9 ── 10 ── 11 ── 14
│                  │    │                ▲
│                  │    └── 12           │
│                  └── 13 ───────────────┘
│
└── 5 ── 6 ── 15 ── 20
                 │
                 └── 30 ── 31 ── 32
                       └── 33 ── 35 ── 36
                              └── 34 ┘
                                  37 (needs 9, 15, 33)

38 (after 8, 23, 33)
39 (after 9)
40 (after 5)
41 (after all UI)
42 (after phases 1–5)
43 (after 42)
```

Topological build order (one valid sequence):
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29 → 30 → 31 → 32 → 33 → 34 → 35 → 36 → 37 → 38 → 39 → 40 → 41 → 42 → 43.

---

## D. Developer Assignment Strategy

Three developers, roughly balanced (~14 tasks each), aligned to natural verticals so they can work in parallel after Phase 0:

- **Dev 1 — Backend & Auth lead**: Phase 0 backend, auth backend, security, recovery, server infra, deployment.
- **Dev 2 — Flights, Booking & API integration**: flight cache/sync, booking pipeline, seat map, ticket lifecycle, No Fly checks.
- **Dev 3 — Frontend, Dashboards & UX**: app shell, Tailwind theme, customer + admin dashboards, async UI, responsive QA, testing harness.

Detailed assignments in [Dev1_tasks.md](Dev1_tasks.md), [Dev2_tasks.md](Dev2_tasks.md), [Dev3_tasks.md](Dev3_tasks.md).
