# BDPA Airports Portal — Complete Implementation Plan

**Status:** Consolidated from project_tasks.md, Dev1/Dev2/Dev3 task & implementation files  
**Stack:** React + Vite + TailwindCSS (frontend), Express + SQLite (backend)  
**Env:** `VITE_API_BASE_URL=http://localhost:5000`, `PORT=5000`, `CLIENT_ORIGIN=http://localhost:3000`

---

## 1. Executive Summary

This portal implements a complete flight booking system with three user roles (guest, customer, admin/root), featuring:
- **Public flights browsing** with search, sort, and pagination
- **Booking pipeline** including seat selection, bag pricing, payment, No Fly checks
- **Customer dashboard** for managing bookings and settings
- **Admin & root dashboards** for management, analytics, and user admin
- **Security-first architecture** with server-side password hashing (argon2id), session management, rate limiting, input validation
- **Resilience** with HTTP 555 retry logic, cache fallback, graceful error handling

---

## 2. Technology Stack & Dependencies

### Backend (Express + Node.js)
- **Framework:** Express.js
- **Database:** SQLite via better-sqlite3 (WAL mode, foreign keys enabled)
- **Password Hashing:** argon2 (argon2id, memory-hard, ~19 MiB)
- **Session Management:** HttpOnly secure cookies, token hashing (SHA-256)
- **Security:** helmet (CSP, X-Frame-Options, etc.), express-rate-limit, CORS (credentials: true)
- **Utilities:** uuid, axios (with retry + HTTP 555 handling), dotenv, zod (validation)

### Frontend (React + Vite)
- **Framework:** React 18+
- **Bundler:** Vite
- **Router:** react-router-dom
- **Styling:** TailwindCSS
- **UI Components:** shadcn/ui primitives (button, card, dialog, form, input, table, tabs, toast, etc.)
- **Forms:** Uncontrolled + custom validation logic (password strength meter, CAPTCHA)
- **Async:** Custom polling hook (useLiveResource) with Page Visibility API
- **Testing:** Vitest, Supertest, React Testing Library

---

## 3. Dependency-Ordered Implementation Checklist

### Phase 0 — Foundations (Unblocks all teams)

#### ✅ Task 1: Repo & tooling baseline
**Owner:** Dev 1 | **Dependencies:** None  
**Deliverables:**
- Updated `package.json` with scripts: `dev`, `dev:client`, `dev:server`, `build`, `start`, `lint`, `test`
- `.env.example` with `VITE_API_BASE_URL`, `PORT`, `CLIENT_ORIGIN`, `BEARER_TOKEN`, `ROOT_EMAIL`, `ROOT_PASSWORD`, `SESSION_COOKIE_SECRET`
- README quickstart

**Implementation:**
- Install: `npm install argon2 better-sqlite3 cookie-parser helmet express-rate-limit uuid dotenv`
- Install dev: `npm install -D vitest supertest eslint`
- Scripts enable: concurrent frontend (Vite) + backend (Node) dev, separate build + start

---

#### ✅ Task 2: Express server bootstrap
**Owner:** Dev 1 | **Dependencies:** Task 1  
**Deliverables:**
- `server/server.js` (slim, only mounts routes + middleware)
- `server/middleware/requestId.js` (UUID injection)
- `server/middleware/errorHandler.js` (centralized error response)
- `server/routes/health.js` (GET /health → JSON status)

**Implementation:**
- CORS restricted to `CLIENT_ORIGIN`, credentials: true
- JSON + cookie parsers, helmet defaults, request-id middleware
- Error handler catches all and returns JSON with request ID + stack (dev only)
- No route handlers in server.js — all in `server/routes/*`

---

#### ✅ Task 3: SQLite layer & migrations
**Owner:** Dev 1 | **Dependencies:** Task 2  
**Deliverables:**
- `server/db/index.js` (singleton better-sqlite3 instance, migration runner)
- `server/db/migrations/0001_init.sql` (all tables per spec)
- `server/db/seed.js` (root admin seeding from env)

**Implementation:**
- WAL mode enabled, foreign keys ON
- Idempotent migration runner tracks applied migrations in `_migrations` table
- Tables created: users, user_login_audit, user_lockouts, security_questions, sessions, saved_cards, tickets, seat_locks, airline_bans, flight_cache, admin_audit
- Root admin seeded on boot if `ROOT_EMAIL` + `ROOT_PASSWORD` env vars set
- Single seed per email (idempotent)

---

#### ✅ Task 4: API client + caching + 555 retry
**Owner:** Dev 1 | **Dependencies:** Task 3  
**Deliverables:**
- `server/utils/apiClient.js` (axios wrapper with bearer token, HTTP 555 retry, backoff)
- `server/utils/cache.js` (get/put/prune flight_cache operations)

**Implementation:**
- Bearer token injected server-side only (never exposed to client)
- HTTP 555 triggers exponential backoff retry (max 3 attempts)
- ApiError class with status, code, message
- Cache stores flight JSON + fetched_at; prune keeps flights referenced by tickets

---

### Phase 1 — Backend Auth Core (Dev 1)

#### ✅ Task 7: Password hashing utilities
**Owner:** Dev 1 | **Dependencies:** Task 3  
**Deliverables:**
- `server/utils/password.js` (hashPassword, verifyPassword, passwordPolicy functions)
- `server/utils/password.test.js` (unit tests)

**Implementation:**
- **argon2id** with: memory=19456 MiB, timeCost=2, parallelism=1
- Salt generated internally, embedded in PHC string (no separate salt column)
- verifyPassword uses timing-safe compare
- passwordPolicy returns {ok, level, reason} for UX feedback (≤10→weak, ≥18→strong)
- Reused for security question answers

---

#### ✅ Task 8: Signup endpoint + duplicate-name handling
**Owner:** Dev 1 | **Dependencies:** Task 7  
**Deliverables:**
- `POST /api/auth/signup` route in `server/routes/auth.js`
- Zod validation schema covering all Req 7 fields
- Duplicate-name disambiguator generation + return

**Implementation:**
- **Validates:** required fields, password length (≤10 → reject, ≥18 → strong flag), ≥3 security questions, CAPTCHA match
- **Detects collision:** query `users WHERE (first_name, last_name, login_disambiguator)` → if exists, generate random disambiguator
- **Stores:** hashed password + salt embedded, hashed answers, security questions per user
- **Response:** includes `login_disambiguator` if generated (emailed later if email present)
- **Security:** parameterized queries, no string concatenation

---

#### ✅ Task 9: Login + lockout endpoint
**Owner:** Dev 1 | **Dependencies:** Task 8  
**Deliverables:**
- `POST /api/auth/login` route in `server/routes/auth.js`
- Session management: issue, read, slide, destroy in `server/utils/session.js`
- Login audit + lockout logic in `server/middleware/auth.js`

**Implementation:**
- **Input:** firstName, lastName, password, optional disambiguator, rememberMe
- **Lockout:** 3 failed attempts → 1h lock in `user_lockouts` table
- **Session:** crypto-random token, hashed in DB, issued in HttpOnly secure cookie
- **Cookie lifetime:** remember-me → 30 days; otherwise → `auto_logout_minutes` sliding window
- **Response:** includes `attemptsRemaining`, `lockedUntil` (when applicable), user profile
- **Audit:** `user_login_audit` logs IP, UA, success flag per attempt
- **Safety:** supports multiple users with same name via disambiguator

---

#### ✅ Task 10: Logout + session refresh
**Owner:** Dev 1 | **Dependencies:** Task 9  
**Deliverables:**
- `POST /api/auth/logout` route
- `GET /api/auth/me` route (user profile)
- Middleware in `server/middleware/auth.js` to attach user + slide session

**Implementation:**
- **Logout:** deletes session row + invalidates cookie
- **Me:** returns user profile, `must_change_password`, `must_complete_profile` flags
- **Middleware:** on each request, reads cookie → validates token hash → slides idle window (unless remember-me)
- **Attachment:** sets `req.user` + `req.session` for downstream routes

---

#### ✅ Task 11: Password recovery via security questions
**Owner:** Dev 1 | **Dependencies:** Task 9  
**Deliverables:**
- `POST /api/auth/recover/init` (first + last + dob → question list)
- `POST /api/auth/recover/answer` (verify answers)
- `POST /api/auth/recover/reset` (set new password)
- Routes in `server/routes/auth.js`

**Implementation:**
- **Init:** finds user by (first, last, dob); returns question texts only (no answers)
- **Answer:** validates all answers using constant-time comparison; returns short-lived reset token (e.g., 15 min)
- **Reset:** verifies reset token, sets new password (hashed), logs audit
- **Access control:** customer accounts only; admins/root → 403
- **No leaks:** errors don't reveal whether user/answers matched (avoid user enumeration)

---

#### ✅ Task 39: Rate limiting & lockouts
**Owner:** Dev 1 | **Dependencies:** Task 9  
**Deliverables:**
- Rate-limit middleware in `server/middleware/rateLimit.js`
- Applied to auth + booking routes

**Implementation:**
- `express-rate-limit` with: 5 req/min on `/api/auth/*` (per IP), 10 req/min on `/api/bookings` (per session)
- Login route integrates with `user_lockouts` (3 fails → 1h lock)
- Graceful 429 response when limit exceeded

---

#### ✅ Task 34: Root admin endpoints
**Owner:** Dev 1 | **Dependencies:** Task 33 (Dev 2)  
**Deliverables:**
- `GET /api/admin/admins` (list)
- `POST /api/admin/admins` (create)
- `PATCH /api/admin/admins/:id` (edit)
- `DELETE /api/admin/admins/:id` (delete, but not root)
- Routes in `server/routes/admin.js` or extension

**Implementation:**
- Guarded by `requireRoot` middleware (returns 403 if not root type)
- Cannot delete root account; cannot demote root to admin
- All CRUD logged in `admin_audit`
- New admin starts with `must_change_password=1`, `must_complete_profile=1`

---

#### ✅ Task 37 (backend): Admin-created customer first-login flow
**Owner:** Dev 1 | **Dependencies:** Tasks 9, 33  
**Deliverables:**
- Admin create-customer sets `must_change_password=1`, `must_complete_profile=1`
- Middleware gates routes for affected users

**Implementation:**
- `POST /api/admin/customers` sets flags when creating new customer
- `/api/auth/me` exposes flags to client
- Middleware blocks non-completion routes when flags set (except `/api/me` for profile updates)
- Frontend redirects to `/complete-profile` page

---

#### ✅ Task 38: Input sanitization & validation
**Owner:** Dev 1 | **Dependencies:** Tasks 8, 23 (Dev 2), 33  
**Deliverables:**
- Zod schemas for every POST/PATCH route
- Helmet middleware + CSP configuration
- README security audit section

**Implementation:**
- Zod schemas validate: type, min/max length, email format, enum values
- Helmet applies: X-Frame-Options, X-Content-Type-Options, CSP (self + Vite dev in dev mode)
- All SQL queries parameterized (better-sqlite3 prepared statements)
- No `dangerouslySetInnerHTML` in React
- Audit: grep for string concatenation in SQL/queries

---

#### ✅ Task 43: Deployment prep
**Owner:** Dev 1 | **Dependencies:** Task 42  
**Deliverables:**
- Production build script (Vite → Express serves dist)
- `Dockerfile` (multi-stage Node.js)
- Updated README with deploy section + seeded root admin instructions

**Implementation:**
- Build script: `npm run build` → `vite build` → output to `server/public`
- Express static middleware serves `server/public/*` for client bundles
- Dockerfile: build stage (Node), copy built dist, expose PORT
- Environment validation on boot (check required env vars)

---

### Phase 2 — Flights & API Integration (Dev 2)

#### ✅ Task 16: Backend flights proxy + cache
**Owner:** Dev 2 | **Dependencies:** Task 4  
**Deliverables:**
- `GET /api/flights` (paginated, searchable, sortable)
- `GET /api/flights/:id` (single flight detail)
- Route in `server/routes/flights.js`

**Implementation:**
- **GET /api/flights:** query params: type (arrival|departure), page, pageSize, q (search), sortBy (flightNumber|airline|airport|city|time|gate), sortDir (asc|desc)
- **Filters:** strips `status=="past"` from public listing
- **Search:** case-insensitive matches across flightNumber, airline, airport, city, gate
- **Cache:** write-through for all returned flights
- **Response:** {page, pageSize, total, items: Flight[]}
- **GET /api/flights/:id:** reads cache first, falls back to API, writes cache on miss

---

#### ✅ Task 17: Flight cache refresher job
**Owner:** Dev 2 | **Dependencies:** Task 16  
**Deliverables:**
- `server/jobs/flightSync.js` background job
- Integrated into `server.js` boot

**Implementation:**
- Runs every 60s (configurable via `FLIGHT_SYNC_MS` env)
- Fetches both arrival + departure flights from API
- Write-through caches each flight
- Prunes `flight_cache` entries >7 days old unless referenced by active tickets
- Error logging (no crash on API failure)
- Graceful shutdown on SIGTERM

---

#### ✅ Task 21: No Fly List check endpoint
**Owner:** Dev 2 | **Dependencies:** Task 4  
**Deliverables:**
- `POST /api/no-fly/check` route in `server/routes/noFly.js`
- Unit test with documented test passenger

**Implementation:**
- **Body:** {first, middle (optional), last, dob, gender}
- **Normalization:** case-insensitive, trimmed whitespace
- **Response:** {blocked: bool, reason?: string}
- **Test:** Restricted User Flier, DOB 1985-12-25, male (should block)
- **Usage:** called during booking before confirmation

---

#### ✅ Task 22: Seat availability + locking
**Owner:** Dev 2 | **Dependencies:** Tasks 16, 3  
**Deliverables:**
- `GET /api/flights/:id/seats` (seat map)
- `POST /api/flights/:id/seats/lock` (reserve seat)
- `DELETE /api/flights/:id/seats/lock` (release)
- Routes in `server/routes/flights.js`
- `server/utils/seats.js` (90-seat layout constant)

**Implementation:**
- **90 seats:** 18 rows × A–F columns (or equivalent layout)
- **State per seat:** available, taken (active ticket), locked (temporary), mine (current session's lock)
- **Lock duration:** 10 minutes (extends if same session re-locks)
- **GET /seats:** merges active tickets + non-expired locks; marks "mine" if lock belongs to current session
- **POST /lock:** requires auth; validates seat; creates seat_lock (flight_id, seat, session_id, locked_until)
- **DELETE /lock:** releases locks owned by session
- **Background sweep:** `DELETE FROM seat_locks WHERE locked_until < now` (runs every 60s in flightSync job)

---

#### ✅ Task 23: Booking endpoint
**Owner:** Dev 2 | **Dependencies:** Tasks 21, 22, 9  
**Deliverables:**
- `POST /api/bookings` route in `server/routes/bookings.js`
- `server/utils/pricing.js` (bagFees, confirmationCode)
- `server/utils/pricing.test.js` (unit tests)

**Implementation:**
- **Validation:** bookable, scheduled status, >24h to departure, seat lock owned by session
- **No Fly check:** calls `/api/no-fly/check` → blocks if hit
- **Airline ban check:** queries `airline_bans` table (case-insensitive match on passenger name + DOB)
- **Pricing:**
  - Seat price: from flight data (cents)
  - Carry-on: 0→$0, 1→$0, 2→$30
  - Checked: 0→$0, 1→$0, 2→$50, 3+→$50 + $100×(count-2)
- **API call:** `POST /v1/flights/:id/book` with seat
- **Persistence:** INSERT `tickets` row (confirmation_code, user_id [nullable], flight_id, passenger fields, seat, bags, totals)
- **Confirmation code:** 8-char cryptographically random (alphabet: A-Z except I/O, 2-9)
- **Seat lock cleanup:** DELETE lock after booking
- **Save card:** if `payment.saveCard && req.user`, INSERT `saved_cards`
- **Response:** {ok, ticketId, confirmationCode, totalCents}

---

#### ✅ Task 24: Ticket lookup + cancel endpoints
**Owner:** Dev 2 | **Dependencies:** Task 23  
**Deliverables:**
- `GET /api/tickets/by-confirmation` (lookup)
- `POST /api/tickets/:id/cancel` (cancel/refund)
- Routes in `server/routes/tickets.js`

**Implementation:**
- **Lookup:** query params: lastName, code → matches `tickets WHERE confirmation_code=code AND passenger_last (case-insensitive) = lastName`
- **Lookup response:** {ticket, flight} (flight from cache or null)
- **Cancel access:** allowed for owner (user_id match), admin, or guest (last name + confirmation match)
- **Cancel constraints:** only if flight hasn't departed yet
- **Cancel flow:** call API to release seat (best-effort), UPDATE `tickets SET status='cancelled', cancelled_at=now`, DELETE `seat_locks`

---

#### ✅ Task 30: Dashboard + me endpoints
**Owner:** Dev 2 | **Dependencies:** Tasks 10, 23  
**Deliverables:**
- `GET /api/me/dashboard` (profile + tickets)
- `PATCH /api/me` (profile edits)
- `DELETE /api/me` (account deletion)
- `POST /api/me/cards` (save card)
- `DELETE /api/me/cards/:id` (delete card)
- `POST /api/me/claim-ticket` (attach guest ticket)
- Routes in `server/routes/me.js`

**Implementation:**
- **Dashboard:** returns {profile: {id, firstName, lastName, email, lastLoginIp, lastLoginDatetime, defaultSort, autoLogoutMinutes}, upcoming: Ticket[], past: Ticket[]}
  - Joins tickets with cached flight data (preserves past flights after API deletion)
  - Splits by flight departure time vs now
- **PATCH /me:** allows edits to firstName, lastName, dob, gender, phone, email, address fields; NOT type
- **DELETE /me:** deletes user row; retains tickets (user_id set to NULL, anonymized)
- **Cards:** CRUD on `saved_cards`
- **Claim:** {lastName, confirmation} → finds guest ticket, attaches to user (user_id = logged-in user)

---

#### ✅ Task 33: Admin endpoints
**Owner:** Dev 2 | **Dependencies:** Tasks 23, 30  
**Deliverables:**
- `GET /api/admin/stats` (analytics)
- `GET /api/admin/customers` (search + list)
- `POST /api/admin/customers` (create)
- `PATCH /api/admin/customers/:id` (edit)
- `DELETE /api/admin/customers/:id` (delete)
- `GET /api/admin/tickets` (search)
- `POST /api/admin/tickets/:id/cancel` (cancel)
- `POST /api/admin/airline-bans` (create ban)
- `DELETE /api/admin/airline-bans/:id` (delete ban)
- Routes in `server/routes/admin.js`

**Implementation:**
- **Stats:** tickets sold + gross profit for windows: 1d, 7d, 30d, 365d, all-time
  - Query `tickets WHERE status='active'` grouped by date ranges
- **Customers:** search by email, address, name, phone; list all; CRUD (create sets must_change_password + must_complete_profile flags; PATCH cannot change type; DELETE removes user)
- **Tickets:** search by flight fields (flightNumber, airline, etc.); cancel ticket if eligible
- **Airline bans:** CRUD on `airline_bans` table {user_or_passenger_identity, airline}
- **Access control:** all routes guarded by `requireAdmin` (403 if not admin/root)
- **Admin-on-admin:** prevent non-root admins from writing other admins (403)
- **Audit:** log all CRUD to `admin_audit`

---

#### ✅ Task 42: Test suite (partial for Dev 2)
**Owner:** Dev 2 (coordinated) | **Dependencies:** Phases 1–5  
**Deliverables:**
- Vitest unit tests: `pricing.test.js`, `password.test.js`, seat logic
- Supertest integration tests: signup→login→book→cancel happy path, lockout, admin CRUD, No Fly block
- Mock BDPA API using msw/node
- `npm test` script

**Implementation:**
- Mock API responses for flights, no-fly-list, ticket book/cancel
- Test user flows: signup (duplicate name), login (3 fails + lockout), book (all validations), cancel (ownership), admin CRUD
- Coverage target: >80% backend routes

---

### Phase 3 — Frontend Auth & App Shell (Dev 3)

#### ✅ Task 5: Frontend app shell & routing
**Owner:** Dev 3 | **Dependencies:** Task 1  
**Deliverables:**
- `src/App.jsx` (routes definition)
- `src/lib/api.js` (fetch wrapper, credentials: include)
- `src/components/layout/Layout.jsx` (header, footer, outlet)
- Placeholder pages for all 20+ routes

**Implementation:**
- **Routes:**
  - Public: /, /flights, /flights/:id, /login, /signup, /recover, /ticket-lookup, /ticket/:confirmation
  - Protected (customer): /dashboard, /dashboard/settings, /complete-profile
  - Protected (admin+): /admin, /admin/customers, /admin/tickets
  - Protected (root): /admin/admins
  - Booking wizard: /book/:flightId, /book/:flightId/payment, /book/:flightId/seat, /book/:flightId/bags, /book/:flightId/review
- **API wrapper:** `fetch(VITE_API_BASE_URL + path, {credentials: "include"})` → auto-parses JSON, throws on !ok
- **Layout:** header (nav, auth state, logo), footer (copyright), main outlet, sticky header on mobile

---

#### ✅ Task 6: Tailwind theme & base UI integration
**Owner:** Dev 3 | **Dependencies:** Task 5  
**Deliverables:**
- `tailwind.config.cjs` extended with brand tokens
- `src/index.css` base styles
- Verified UI primitives from `src/components/ui/*`

**Implementation:**
- **Theme:** brand color (primary), spacing scale, breakpoints (xs:320, sm:640, md:768, lg:1024, xl:1280)
- **Base:** focus rings (ring-2 ring-brand ring-offset-2), typography (h1/h2 sizing)
- **Primitives:** button, card, dialog, form, input, label, table, tabs, toast (all wired + styled)
- **Responsive:** mobile-first, drawer nav on sm, grid layout on md+

---

#### ✅ Task 15: Auth context + protected routes
**Owner:** Dev 3 | **Dependencies:** Tasks 10, 5  
**Deliverables:**
- `src/context/AuthContext.jsx` (useAuth hook)
- `src/components/Guards.jsx` (RequireAuth, RequireAdmin, RequireRoot)
- `src/hooks/useAutoLogout.js` (auto-logout timer)

**Implementation:**
- **AuthContext:** 
  - On mount: fetch `/api/auth/me` → sets user state
  - Exposes: {user, loading, login, logout, refresh}
  - login(payload) → POST /api/auth/login → sets user
  - logout() → POST /api/auth/logout → clears user
- **Guards:**
  - RequireAuth: user must exist
  - RequireAdmin: user.type in [admin, root]
  - RequireRoot: user.type == root
  - All show loading spinner while checking; redirect to /login if unauthorized
- **useAutoLogout:** activity-based timeout (mousemove, keydown, scroll, click reset timer); skipped if remember-me active

---

#### ✅ Task 12: Login page
**Owner:** Dev 3 | **Dependencies:** Tasks 9, 6  
**Deliverables:**
- `src/pages/Login.jsx`

**Implementation:**
- **Form fields:** firstName, lastName, password, optional disambiguator (shown on collision), rememberMe checkbox
- **Submission:** POST /api/auth/login → on error, parse response for: needsDisambiguator (409), locked status (423), attemptsRemaining
- **UX:**
  - Shows disambiguator input if collision detected
  - Displays attempts remaining + lockout countdown when locked
  - Links to /signup and /recover
  - On success: navigate to /dashboard (customer) or /admin (admin)

---

#### ✅ Task 13: Signup page + CAPTCHA + strength meter
**Owner:** Dev 3 | **Dependencies:** Tasks 8, 6  
**Deliverables:**
- `src/pages/Signup.jsx`
- `src/components/PasswordStrengthMeter.jsx`
- `src/components/Captcha.jsx`

**Implementation:**
- **Strength meter:** visual bar + label (weak ≤10, medium 11-17, strong ≥18)
- **CAPTCHA:** arithmetic challenge (e.g., "5 + 3 =") with refresh button
- **Form:**
  - All Req 7 fields (title, first/middle/last, suffix, dob, gender, address, city, state, zip, country, phone, email, password, confirm-password)
  - Required markers
  - Security questions: repeater (min 3, add/remove)
  - CAPTCHA + strength meter
  - Submit validation: password strong, answers filled, CAPTCHA correct
- **Success screen:** displays assigned disambiguator (if generated) + login CTA

---

#### ✅ Task 14: Recover page
**Owner:** Dev 3 | **Dependencies:** Tasks 11, 13  
**Deliverables:**
- `src/pages/Recover.jsx`

**Implementation:**
- **Step 1 (Identify):** form with firstName, lastName, dob → POST /api/auth/recover/init
- **Step 2 (Answer):** displays questions (from Step 1 response) → user enters answers → POST /api/auth/recover/answer
- **Step 3 (Reset):** new password form (re-uses PasswordStrengthMeter) → POST /api/auth/recover/reset
- **Error handling:** vague messages (don't leak whether user/answers exist)
- **Success:** redirects to /login

---

#### ✅ Task 20: Async update hook
**Owner:** Dev 3 | **Dependencies:** Task 5  
**Deliverables:**
- `src/hooks/useLiveResource.js`

**Implementation:**
- **Signature:** `useLiveResource(key, fetcher, intervalMs = 15000)`
- **Behavior:**
  - Calls fetcher() on mount + every intervalMs
  - Pauses polling when document.visibilityState === "hidden"
  - On update (JSON changed), emits toast event: `window.dispatchEvent(new CustomEvent("toast", {...}))`
  - Cancels on unmount
- **Returns:** {data, error, loading}
- **Used by:** flights, flight detail, ticket, dashboard (for live gate/time/status updates)

---

### Phase 4 — Flights & Booking UI (Dev 3)

#### ✅ Task 18: Flights view
**Owner:** Dev 3 | **Dependencies:** Tasks 16, 6  
**Deliverables:**
- `src/pages/Flights.jsx`
- `src/components/FlightTable.jsx` (desktop)
- `src/components/FlightCard.jsx` (mobile)

**Implementation:**
- **Tabs:** Arrivals | Departures
- **Search:** text input (debounced) matching flightNumber, airline, airport, city
- **Sort:** clickable column headers (flightNumber, airline, airport, city, time, gate) → asc/desc
- **Pagination:** page + pageSize controls
- **Columns:** flightNumber, airline, airport, city, time, gate (departures only), status badge
- **CTA:** "Book this flight" button visible only if bookable && status==scheduled && arrival > now + 24h
- **Components:**
  - FlightTable (desktop view)
  - FlightCard (mobile view, responsive)
  - Status badges (scheduled, delayed, cancelled, past)

---

#### ✅ Task 19: Flight detail page
**Owner:** Dev 3 | **Dependencies:** Task 18  
**Deliverables:**
- `src/pages/FlightDetail.jsx`

**Implementation:**
- Fetches flight from `/api/flights/:id` using useLiveResource (async updates)
- Displays all flight fields (flightNumber, airline, airports, times, gate, status, seats available)
- "Book this flight" button (enabled if bookable && >24h rule) → navigate to /book/:flightId
- "Not bookable: <reason>" hint if not bookable

---

#### ✅ Task 25: Booking UI: passenger + payment forms
**Owner:** Dev 3 | **Dependencies:** Tasks 19, 15  
**Deliverables:**
- `src/pages/Booking/Passenger.jsx`
- `src/pages/Booking/Payment.jsx`
- Shared booking context (useReducer)

**Implementation:**
- **Passenger.jsx:** first, middle, last, sex, dob, phone, email + Next button
- **Payment.jsx:** card number (masked), expiry, CVC, cardholder, billing address, zip, "Save for later" toggle (logged-in only), strong warning "Never enter real card data"
- **Context:** booking reducer stores: flightId, passenger, payment, seat, bags
- **Navigation:** next/back buttons between steps
- **Validation:** per-step (passenger required fields, payment number format, etc.)

---

#### ✅ Task 26: Booking UI: seat map
**Owner:** Dev 3 | **Dependencies:** Tasks 22, 25  
**Deliverables:**
- `src/pages/Booking/SeatMap.jsx`

**Implementation:**
- **Layout:** SVG or CSS grid of 90 seats (18 rows × A–F)
- **Legend:** available (white), taken (red), locked (yellow), mine (blue highlight)
- **Live updates:** useLiveResource polling /api/flights/:id/seats
- **Interaction:**
  - Click available/mine seat → POST /api/flights/:id/seats/lock
  - Previous lock auto-released (DELETE then POST)
  - Visual feedback during lock attempt
- **Hover preview:** shows seat label

---

#### ✅ Task 27: Booking UI: bags + review + confirm
**Owner:** Dev 3 | **Dependencies:** Tasks 23, 26  
**Deliverables:**
- `src/pages/Booking/Bags.jsx`
- `src/pages/Booking/Review.jsx`

**Implementation:**
- **Bags.jsx:**
  - Steppers: carry-on (0-2), checked (0-5)
  - Live price breakdown: seat + carry-on fees + checked fees
  - Validation: max limits enforced
- **Review.jsx:**
  - Displays: passenger name, seat, bags, card last4, address, total
  - Submit button → POST /api/bookings → on success: navigate to /ticket/:confirmation
  - Error handling: No Fly rejection → clear message + back to passenger step
  - Loading spinner during POST

---

#### ✅ Task 28: Ticket lookup page
**Owner:** Dev 3 | **Dependencies:** Task 24  
**Deliverables:**
- `src/pages/TicketLookup.jsx`

**Implementation:**
- Form: lastName + confirmation code
- Submit → GET /api/tickets/by-confirmation → navigate to /ticket/:confirmation
- Error handling: "Ticket not found"

---

#### ✅ Task 29: Ticket view page
**Owner:** Dev 3 | **Dependencies:** Tasks 20, 24  
**Deliverables:**
- `src/pages/Ticket.jsx`

**Implementation:**
- Displays: arrival/departure flag, airline + number, destination, depart/arrive datetime, passenger name, gate, confirmation code, status
- Live updates via useLiveResource (gate/time/status refresh every 15s)
- Cancel/refund button (enabled if status==active && flight not departed)
- Confirmation modal before cancel

---

### Phase 5 — Customer Dashboard (Dev 3)

#### ✅ Task 31: Customer dashboard UI
**Owner:** Dev 3 | **Dependencies:** Tasks 30, 20  
**Deliverables:**
- `src/pages/Dashboard.jsx`

**Implementation:**
- **Profile card:** name, lastLoginIp, lastLoginDatetime
- **Upcoming flights:** async-updated list (via useLiveResource) with click-to-ticket
- **Past flights:** paginated list
- **Settings link:** navigate to /dashboard/settings

---

#### ✅ Task 32: Customer settings UI
**Owner:** Dev 3 | **Dependencies:** Task 31  
**Deliverables:**
- `src/pages/Settings.jsx`

**Implementation:**
- **Profile edit:** firstName, lastName, dob, gender, phone, email → PATCH /api/me
- **Default flight sort:** dropdown (time, airline, etc.) → PATCH /api/me
- **Saved cards:** list with delete buttons → DELETE /api/me/cards/:id
- **Auto-logout:** selector (15m / 5m / 1h / never) → PATCH /api/me
- **Delete account:** confirm modal + double confirm → DELETE /api/me
- **Claim ticket:** form (lastName + confirmation) → POST /api/me/claim-ticket

---

### Phase 6 — Admin & Root Dashboards (Dev 3)

#### ✅ Task 35: Admin dashboard UI
**Owner:** Dev 3 | **Dependencies:** Tasks 33, 6  
**Deliverables:**
- `src/pages/Admin/Dashboard.jsx`
- `src/pages/Admin/Customers.jsx`
- `src/pages/Admin/Tickets.jsx`

**Implementation:**
- **Dashboard.jsx:** 10 stat tiles (5 windows: 1d/7d/30d/365d/all) × (tickets sold, gross profit)
- **Customers.jsx:** 
  - Search input (email, name, phone, address)
  - Paginated table: email, name, type, lastLogin
  - Edit modal: update customer fields (no type change)
  - Delete button (with confirm)
  - Create customer form (pre-fills must_change_password + must_complete_profile)
  - Airline ban manager (per customer): list/add/remove bans
- **Tickets.jsx:**
  - Search by flight fields
  - Paginated table: confirmation, passenger name, flight, seat, date, status
  - Cancel button (with confirm)
  - View ticket link

---

#### ✅ Task 36: Root admin UI
**Owner:** Dev 3 | **Dependencies:** Tasks 34, 35  
**Deliverables:**
- `src/pages/Admin/Admins.jsx`

**Implementation:**
- **Admins.jsx** (visible only to root):
  - List: email, name, lastLogin
  - Edit modal: update email/name (no type change)
  - Delete button (disabled for root row, enabled for others)
  - Create admin form
  - Root row styled as non-editable (visual hint)

---

#### ✅ Task 37 (frontend): Admin-created customer first-login flow
**Owner:** Dev 3 | **Dependencies:** Tasks 15, 37-backend  
**Deliverables:**
- `src/pages/CompleteProfile.jsx`
- Router guard in App.jsx

**Implementation:**
- **CompleteProfile.jsx:**
  - Change password form (using PasswordStrengthMeter)
  - Complete profile form (missing required fields)
  - Submit → PATCH /api/me + update must_change_password + must_complete_profile flags
  - On success: redirect to /dashboard
- **Router guard:** if user.must_change_password || user.must_complete_profile, redirect to /complete-profile (except for /api/me updates)

---

### Phase 7 — Error Handling, Testing, Deployment (All Devs)

#### ✅ Task 40: Global error UI + spinners
**Owner:** Dev 3 | **Dependencies:** Task 5  
**Deliverables:**
- `src/components/ErrorBoundary.jsx`
- `src/components/Spinner.jsx`
- Toast system in Layout

**Implementation:**
- **ErrorBoundary:** React error boundary wrapping router; displays error message + reload button
- **Spinner:** reusable loading indicator (animated spin, 24px default)
- **Toast system:** 
  - Global listener: `window.addEventListener("toast", ...)`
  - Auto-dismiss after 4s
  - Used for: API success/error messages, HTTP 555 retry notifications
- **Route-level Suspense:** fallback spinner on each route (no blank screen > 500ms)

---

#### ✅ Task 41: Responsive QA pass
**Owner:** Dev 3 | **Dependencies:** All UI tasks  
**Deliverables:**
- Verified on: 320px (mobile), 768px (tablet), 1280px (desktop)
- Documented fixes per page

**Implementation:**
- Mobile nav: drawer on screens < md
- Sticky table headers on scroll
- Tap targets ≥ 44px
- No horizontal overflow
- Card layouts stack on mobile
- Lighthouse mobile score target: ≥90 on Home, Flights, Dashboard

---

#### ✅ Task 42: Test suite (complete)
**Owner:** Dev 2 + Dev 3 | **Dependencies:** Phases 1–5  
**Deliverables:**
- Vitest unit tests (backend utilities)
- Supertest integration tests (auth, booking, admin flows)
- React Testing Library tests (key pages)
- Mock BDPA API (msw/node)
- CI workflow (`.github/workflows/ci.yml`)

**Implementation:**
- **Unit tests:** password hashing, pricing logic, validators, confirmation code generation
- **Integration tests:** 
  - Signup → login → book → cancel (happy path)
  - Login lockout (3 fails)
  - Admin create/edit/delete customers
  - Root create/edit/delete admins
  - No Fly blocking
- **React tests:** Login form submit, Signup validation, Flights search + sort
- **Mock API:** msw/node mocking BDPA /v1/* endpoints
- **Coverage:** target >80% for backend routes, >70% for frontend pages

---

## 4. File Structure & Architecture

```
AirportPortal/
├── src/                                 # Frontend (React + Vite)
│   ├── App.jsx                         # Routes definition
│   ├── main.jsx                        # Entry point
│   ├── index.css                       # TailwindCSS base
│   ├── lib/
│   │   ├── api.js                      # Fetch wrapper
│   │   └── utils.js                    # Helpers
│   ├── context/
│   │   ├── AuthContext.jsx             # Auth state + login/logout
│   │   └── BookingContext.jsx          # Booking state (optional)
│   ├── hooks/
│   │   ├── useLiveResource.js          # Polling + visibility pause
│   │   └── useAutoLogout.js            # Activity-based timeout
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.jsx              # Header/Footer/Outlet
│   │   │   ├── Container.jsx           # Max-width wrapper
│   │   │   └── Section.jsx             # Padded container
│   │   ├── ErrorBoundary.jsx           # React error boundary
│   │   ├── Spinner.jsx                 # Loading indicator
│   │   ├── Guards.jsx                  # Route guards (RequireAuth, etc.)
│   │   ├── PasswordStrengthMeter.jsx   # Password strength UI
│   │   ├── Captcha.jsx                 # Arithmetic CAPTCHA
│   │   └── ui/                         # Primitives (button, card, dialog, etc.)
│   └── pages/
│       ├── Home.jsx                    # Landing page
│       ├── Login.jsx                   # Login form
│       ├── Signup.jsx                  # Signup + security questions
│       ├── Recover.jsx                 # 3-step password recovery
│       ├── Flights.jsx                 # List + search + sort
│       ├── FlightDetail.jsx            # Single flight
│       ├── TicketLookup.jsx            # Guest ticket lookup
│       ├── Ticket.jsx                  # Ticket detail
│       ├── Dashboard.jsx               # Customer dashboard
│       ├── Settings.jsx                # Customer settings
│       ├── CompleteProfile.jsx         # First-login forced completion
│       ├── Booking/
│       │   ├── Passenger.jsx
│       │   ├── Payment.jsx
│       │   ├── SeatMap.jsx
│       │   ├── Bags.jsx
│       │   └── Review.jsx
│       └── Admin/
│           ├── Dashboard.jsx           # Stats
│           ├── Customers.jsx           # CRUD customers
│           ├── Tickets.jsx             # Search tickets
│           └── Admins.jsx              # CRUD admins (root only)
│
├── server/                             # Backend (Express + Node.js)
│   ├── server.js                       # Express app + middleware mounting
│   ├── db/
│   │   ├── index.js                    # better-sqlite3 singleton, migration runner
│   │   ├── seed.js                     # Root admin seeding
│   │   └── migrations/
│   │       └── 0001_init.sql           # All tables
│   ├── middleware/
│   │   ├── requestId.js                # UUID injection
│   │   ├── errorHandler.js             # Centralized error response
│   │   ├── auth.js                     # attachUser, requireAuth, requireAdmin, requireRoot
│   │   ├── completionGate.js           # must_change_password + must_complete_profile guard
│   │   └── rateLimit.js                # Rate limiting
│   ├── routes/
│   │   ├── health.js                   # GET /health
│   │   ├── auth.js                     # POST signup, login, logout, recover/*, /api/auth/me
│   │   ├── flights.js                  # GET /api/flights, GET /api/flights/:id, seats endpoints
│   │   ├── noFly.js                    # POST /api/no-fly/check
│   │   ├── bookings.js                 # POST /api/bookings
│   │   ├── tickets.js                  # GET by-confirmation, POST cancel
│   │   ├── me.js                       # GET dashboard, PATCH me, DELETE me, cards, claim-ticket
│   │   ├── admin.js                    # GET stats, CRUD customers/tickets/admins
│   │   └── adminRoot.js                # CRUD admins (root only, or part of admin.js)
│   ├── utils/
│   │   ├── apiClient.js                # Axios wrapper, bearer token, HTTP 555 retry
│   │   ├── cache.js                    # flight_cache get/put/prune
│   │   ├── password.js                 # argon2id hash/verify
│   │   ├── session.js                  # Token generation, cookie management
│   │   ├── seats.js                    # 90-seat layout constant
│   │   ├── pricing.js                  # bagFees, confirmationCode
│   │   └── validators.js               # Zod schemas (if centralized)
│   └── jobs/
│       └── flightSync.js               # Background flight cache refresh
│
├── public/                             # Static assets
├── package.json                        # Dependencies + scripts
├── .env.example                        # Environment template
├── vite.config.mts                     # Vite configuration
├── vitest.config.js                    # Vitest configuration
├── tailwind.config.cjs                 # TailwindCSS theme
├── postcss.config.cjs                  # PostCSS plugins
├── components.json                     # shadcn/ui config (if used)
├── jsconfig.json                       # JS path aliases
├── Dockerfile                          # Multi-stage Docker build
└── README.md                           # Setup, run, deploy
```

---

## 5. Security Model

### Password Handling (Server-Side Only)
- **Algorithm:** argon2id (memory-hard, 19 MiB, 2 time-cost, 1 parallelism)
- **Storage:** PHC string includes salt (no separate column needed)
- **Verification:** timing-safe compare, constant-time
- **Never client-side:** browser sends plaintext to server over HTTPS; hashing always server-side

### Session Security
- **Token:** 32-byte random crypto.randomBytes
- **Hashing:** SHA-256 token hash in DB; plain token in HttpOnly secure cookie
- **Cookie:** secure, httpOnly, sameSite=lax, signed (if using cookie-parser)
- **Sliding window:** idle timeout per auto_logout_minutes (unless remember-me)
- **Cleanup:** old sessions pruned on DB maintenance

### Input Validation
- **Server-side:** Zod schemas validate every POST/PATCH
- **Client-side:** Trusted text only (no innerHTML); React's default JSX escaping
- **SQL:** Parameterized queries (better-sqlite3 prepared statements)
- **Rate limiting:** express-rate-limit on /api/auth/*, /api/bookings

### Network Security
- **CORS:** restricted to CLIENT_ORIGIN, credentials: true
- **Helmet:** CSP, X-Frame-Options, X-Content-Type-Options headers
- **Bearer token:** only server-side; never in cookies or client storage
- **HTTPS:** required in production (enforced in Dockerfile)

---

## 6. Server-Side vs Client-Side Responsibilities

### Server-Side
- ✅ Password hashing (argon2id)
- ✅ Session generation + token hashing
- ✅ Authentication + authorization gates
- ✅ No Fly List checks (calls upstream API)
- ✅ Seat locking + availability (database source-of-truth)
- ✅ Booking validation (bookable, >24h, seat lock owned, airline bans)
- ✅ Pricing calculation (seat + bag fees)
- ✅ Ticket creation + confirmation code generation
- ✅ Admin audit logging
- ✅ Flight caching + syncing
- ✅ Input validation (Zod schemas)

### Client-Side
- 🖥️ Form UI + submission
- 🖥️ Password strength feedback (visual only)
- 🖥️ CAPTCHA arithmetic challenge (verification server-side)
- 🖥️ Seat map visualization
- 🖥️ Live polling for updates (useLiveResource)
- 🖥️ Responsive layout (Tailwind)
- 🖥️ Navigation + routing
- 🖥️ Error/success toast messages
- 🖥️ Local form state (useReducer, useState)

---

## 7. API Integration

All requests from Express to BDPA API:
- **Bearer token:** server-side only
- **Endpoints used:** `/v1/flights`, `/v1/flights/:id`, `/v1/airports`, `/v1/airlines`, `/v1/no-fly-list`, `/v1/flights/:id/book`, `/v1/tickets/:id` (cancel)
- **Error handling:** HTTP 555 triggers retry with exponential backoff (max 3 attempts, 200ms → 400ms → 800ms)
- **Response shape:** varies per endpoint; server normalizes to local schema

---

## 8. Data Flow Examples

### Example 1: New User Signup & Login

```
Frontend → POST /api/auth/signup
           {firstName, lastName, password, email, security_questions[], captchaAnswer}
Backend  → Validate (zod), check name collision, hash password (argon2id),
           detect duplicate name, generate disambiguator (if needed), 
           insert users + security_questions, return {disambiguator}
Frontend → Show disambiguator (if generated), redirect to /login

Frontend → POST /api/auth/login
           {firstName, lastName, password, disambiguator?, rememberMe}
Backend  → Query user by (first, last, disambiguator), verify password (argon2),
           check lockout status, update attempt count, issue session + cookie,
           update last_login_ip/datetime, return {user}
Frontend → Store user in AuthContext, navigate to /dashboard
```

### Example 2: Booking Flow

```
Frontend → Click "Book this flight" on /flights/:id
           Navigate to /book/:flightId

Frontend → Fill passenger info → Next → /book/:flightId/payment
           Fill payment → Next → /book/:flightId/seat

Frontend → GET /api/flights/:id/seats
Backend  → Merge active tickets + non-expired locks, return seat map
Frontend → Display 90-seat map; user clicks seat
           POST /api/flights/:id/seats/lock {seat}
Backend  → Validate seat available, create seat_lock (10-min expiry), return {ok}

Frontend → Next → /book/:flightId/bags
           Select bags (2 carry, 3 checked) → Next → /book/:flightId/review
           Review all fields → Submit

Frontend → POST /api/bookings
           {flightId, passenger, payment, seat, carryOnCount, checkedCount}
Backend  → Validate: flight bookable, >24h, seat lock owned by session
           Check No Fly List (POST /v1/no-fly-check), airline bans
           Calculate price (seat + bags), call API book (POST /v1/flights/:id/book),
           create tickets row, generate confirmation code, cleanup lock, return {confirmationCode}
Frontend → Navigate to /ticket/:confirmation, show confirmation code + option to save
```

### Example 3: Admin Customer Management

```
Frontend (Admin) → Navigate to /admin/customers
Frontend → GET /api/admin/customers?q=smith&page=1
Backend  → Query customers WHERE email|address|name|phone LIKE q, paginate, return list

Frontend → Click "Edit" on customer
           Modal pre-fills customer data, user updates fields → Submit
Frontend → PATCH /api/admin/customers/:id
           {firstName, lastName, email, phone, ...}
Backend  → Validate (no type change), update users row, log admin_audit, return {ok}

Frontend → Click "Delete" with confirm
Frontend → DELETE /api/admin/customers/:id
Backend  → Delete user, nullify user_id on all their tickets (anonymize),
           log admin_audit, return {ok}
Frontend → Refresh list (GET /api/admin/customers)
```

---

## 9. Implementation Order & Parallelization

### Phase 0 (Sequential: all devs blocked)
1. ✅ **Task 1** (Dev 1): Repo & tooling (npm install, package.json, .env.example)
2. ✅ **Task 2** (Dev 1): Express bootstrap (server.js, middleware, health route)
3. ✅ **Task 3** (Dev 1): SQLite + migrations (db/index.js, schema, seed)
4. ✅ **Task 4** (Dev 1): API client + cache (apiClient.js, cache.js)

### Phase 1 (Parallel after Phase 0)
**Dev 1 (Auth backend):**
- ✅ **Task 7** (password utils) → **Task 8** (signup) → **Task 9** (login) → **Task 10** (logout/me) → **Task 11** (recover)
- ✅ **Task 39** (rate limiting)
- ✅ **Task 38** (validation + security) + **Task 34** (root admin) + **Task 37** (backend)

**Dev 2 (Flights backend):**
- ✅ **Task 16** (flights proxy) → **Task 17** (cache refresh)
- ✅ **Task 21** (no-fly check)
- ✅ **Task 22** (seat locking) → **Task 23** (booking) → **Task 24** (ticket lookup/cancel)

**Dev 3 (Frontend foundation):**
- ✅ **Task 5** (app shell) → **Task 6** (Tailwind theme)
- ✅ **Task 20** (useLiveResource hook)
- ✅ **Task 15** (auth context + guards)
- ✅ **Task 40** (error boundary + spinner)

### Phase 2 (Parallel after Dev 1 Tasks 9/11 + Dev 3 Tasks 5/15)
**Dev 3 (Auth UI):**
- ✅ **Task 12** (login page)
- ✅ **Task 13** (signup page + CAPTCHA + strength meter)
- ✅ **Task 14** (recover page)

### Phase 3 (Parallel after Dev 2 Task 16 + Dev 3 Task 6)
**Dev 3 (Flights UI):**
- ✅ **Task 18** (flights view) → **Task 19** (flight detail)

### Phase 4 (Parallel after Dev 2 Tasks 22/23 + Dev 3 Task 19)
**Dev 3 (Booking UI):**
- ✅ **Task 25** (passenger + payment)
- ✅ **Task 26** (seat map)
- ✅ **Task 27** (bags + review + confirm)

**Dev 2 (Dashboard backend):**
- ✅ **Task 30** (dashboard endpoints) → **Task 33** (admin endpoints)

**Dev 3 (Lookup):**
- ✅ **Task 28** (ticket lookup) → **Task 29** (ticket view)

### Phase 5 (After Dev 2 Task 30 + Dev 3 Task 29)
**Dev 3 (Dashboards UI):**
- ✅ **Task 31** (customer dashboard) → **Task 32** (settings)
- ✅ **Task 35** (admin dashboard) → **Task 36** (root admin)
- ✅ **Task 37** (first-login profile completion)

### Phase 6 (Final)
- ✅ **Task 41** (responsive QA) — all devs
- ✅ **Task 42** (test suite) — Dev 1 + Dev 2 + Dev 3
- ✅ **Task 43** (deployment) — Dev 1

---

## 10. Known Constraints & Caveats

- **API availability:** BDPA API may return HTTP 555; always retry with backoff
- **Flight deletion:** Past flights deleted from API after 7 days; local cache preserves ticket history
- **Session tokens:** 30-day remember-me or 15-min idle default; customer-configurable
- **Seat locks:** 10-minute expiry; released on booking or unlock endpoint
- **Pricing:** all seats same price; bags: carry 0→0, 1→0, 2→$30; checked 0→0, 1→0, 2→$50, 3+→$50+$100×(n-2)
- **No Fly checks:** case-insensitive, trimmed whitespace
- **Confirmation codes:** 8-char, safe alphabet (A–Z excl I/O, 2-9)
- **Admin restrictions:** admins cannot CRUD other admins (root only); root cannot be deleted/demoted

---

## 11. Success Criteria & Acceptance

✅ **All 43 tasks completed as specified**
✅ **All endpoints return proper JSON + HTTP status codes**
✅ **All passwords hashed server-side using argon2id**
✅ **All SQL queries parameterized**
✅ **All routes gated by proper auth middleware**
✅ **All forms validated server-side + client-side**
✅ **All flights/tickets async-updated via useLiveResource**
✅ **All pages responsive on 320px, 768px, 1280px**
✅ **Integration tests pass (auth, booking, admin flows)**
✅ **Lighthouse mobile score ≥90 on key pages**
✅ **Deployment-ready Dockerfile + production build script**

