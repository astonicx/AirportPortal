# Developer 1 — Backend Lead (Auth, DB, V2 API, Security)

**Primary Focus:** Express infrastructure, API V2 integration, authentication system overhaul (email-based login), database schema expansion, customer banning, security hardening.

**Collaboration:**
- **Dev 2** depends on T-1, T-2, T-3 before starting booking work
- **Dev 3** depends on T-3 (email login) + T-4 (ban handling) for frontend

**Task Count:** 8 core tasks (~100 story points)

---

## Sprint 1 — API & Auth Foundation (Unblocks All)

### T-1 — Update API client for V2 integration + bearer token
**Dependencies:** None  
**Effort:** Medium | **Est. Hours:** 4–6

**Description:**
Replace V1 API integration with V2. The app currently calls `https://airports.api.hscc.bdpa.org/v1`; migrate to `https://airports.api.hscc.bdpa.org/v2`.

**Deliverables:**
- Update `server/utils/apiClient.js`:
  - Change base URL to V2 endpoint
  - Inject `Authorization: Bearer ${BEARER_TOKEN}` header (read from env)
  - Ensure 555 retry logic still works with V2 error format
  - Log all API requests/responses in dev mode (never log bearer token)
- Add `BEARER_TOKEN` to `.env.example`
- Document API v1 → v2 migration notes in `server/routes/flights.md`

**Acceptance Criteria:**
- [x] V2 base URL in use
- [x] Bearer token injected server-side only (client never sees it)
- [x] Retry logic functional for V2 responses
- [x] No bearer token in logs
- [x] Tests pass: `npm run test:backend`

---

### T-2 — Expand SQLite schema for V2 features
**Dependencies:** T-1  
**Effort:** Medium | **Est. Hours:** 6–8

**Description:**
Add tables and columns to support customer banning, airline attendants, frequent flier miles, in-flight extras, check-in records, and email-based login.

**Deliverables:**
- Create `server/db/migrations/0002_v2_features.sql` with:
  - **users** table changes:
    - Add `email` column (VARCHAR(255), UNIQUE NOT NULL)
    - Add `user_type` (ENUM or TEXT: guest/customer/admin/attendant/root; default 'guest')
    - Add `is_banned` (BOOLEAN, default 0)
    - Add `banned_reason` (TEXT, nullable)
    - Drop or deprecate first_name/last_name login logic columns
  - **New tables:**
    - `airline_restrictions` (id PK, user_id FK, airline TEXT, reason TEXT, created_at TIMESTAMP)
    - `frequent_flier_accounts` (user_id FK PK, ffm_balance INT, lifetime_earned INT, lifetime_spent INT, updated_at TIMESTAMP)
    - `ticket_extras` (id PK, ticket_id FK, extra_name TEXT, cost_cents INT, cost_ffm INT, purchased_at TIMESTAMP)
    - `attendant_assignments` (id PK, attendant_id FK, airline TEXT, assigned_at TIMESTAMP)
    - `checkin_records` (id PK, ticket_id FK, checked_in_at TIMESTAMP, gate TEXT, status TEXT)
  - **flight_cache** table additions:
    - Add `seat_classes_json` (TEXT) — JSON array: [{class, max_price_cents, available}, ...]
    - Add `baggage_fees_json` (TEXT) — JSON: {carry_on_prices, checked_prices}
    - Add `extras_json` (TEXT) — JSON array: [{name, cost_cents, cost_ffm}, ...]
    - Add `ffm_credit` (INT) — FFM earned per ticket

- Update `server/db/index.js` to run migration 0002 on boot (idempotent)
- **No data loss:** migration script checks if columns exist before adding

**Acceptance Criteria:**
- [x] Migration file created and runs without errors
- [x] All new columns/tables present in production SQLite
- [x] Idempotent: running migration twice produces same result
- [x] Foreign key constraints active on all FK columns
- [x] Tests pass: `npm run test:backend`

---

### T-3 — Email-based login system (replace name-based)
**Dependencies:** T-2  
**Effort:** Large | **Est. Hours:** 10–12

**Description:**
Overhaul authentication to use email + password instead of first_name + last_name + disambiguator. This is a breaking change that cascades through signup, login, and password recovery.

**Deliverables:**

#### A. Update signup flow:
- **`POST /api/auth/signup`** new payload (BREAKING):
  ```json
  {
    "email": "user@example.com",
    "password": "StrongP@ssw0rd",
    "firstName": "John",
    "lastName": "Doe",
    "dob": "1990-01-15",
    "gender": "M",
    "phone": "555-1234",
    "securityQuestions": [
      {"question": "Q1", "answer": "A1"},
      {"question": "Q2", "answer": "A2"},
      {"question": "Q3", "answer": "A3"}
    ],
    "captchaAnswer": "42"
  }
  ```
- Validate:
  - `email` is unique (check `users` table)
  - `password` length policy (≤10 → reject)
  - First/last names optional for guests, required for customers (or handle later)
- **Remove** `login_disambiguator` logic entirely
- Return success with just `{userId, email}` (no disambiguator)

#### B. Update login flow:
- **`POST /api/auth/login`** new payload (BREAKING):
  ```json
  {
    "email": "user@example.com",
    "password": "StrongP@ssw0rd",
    "rememberMe": true
  }
  ```
- Lookup user by email (not first+last name combo)
- Enforce ban check: reject if `is_banned=1` with message "Account banned"
- Response on success: `{userId, email, user_type, must_change_password, must_complete_profile}`
- Response on failure: `{error: "Invalid email or password", attempts_remaining: 2, locked_until: null}`
- **No more "disambiguator" needed** — email is the unique key

#### C. Update password recovery:
- **`POST /api/auth/recover/init`** new payload:
  ```json
  {"email": "user@example.com"}
  ```
- Return list of security questions (no answers)
- If email not found: return 404 (do not reveal whether email exists for security)
  
#### D. Update audit logging:
- `user_login_audit` now logs `email` instead of first+last name combo

#### E. Update `GET /api/auth/me`:
- Response now includes `email` field

**Acceptance Criteria:**
- [x] Signup with email works end-to-end
- [x] Login with email works; old name-based login rejected
- [x] Unique email validation enforced (duplicate email → 409)
- [x] Ban check happens at login; banned user rejected with clear message
- [x] Password recovery uses email lookup
- [x] No disambiguator logic in codebase
- [x] Backward-compat tests pass (old v1 login attempts fail gracefully)
- [x] Tests pass: `npm run test:backend`

---

## Sprint 2 — User Management & Security

### T-4 — Customer ban/unban endpoints + enforcement
**Dependencies:** T-3  
**Effort:** Medium | **Est. Hours:** 6–8

**Description:**
Admin (and root) can ban/unban customers. Banned customers cannot login. If banned mid-session, they are forced to logout on next app interaction.

**Deliverables:**

#### A. Admin endpoints (root or admin guard):
- **`POST /api/admin/customers/:id/ban`**
  - Body: `{reason: "Policy violation"}`
  - Sets `users.is_banned=1`, `users.banned_reason=<reason>`
  - Inserts audit entry in `admin_audit`
  - Returns updated customer record

- **`POST /api/admin/customers/:id/unban`**
  - Sets `users.is_banned=0`, `users.banned_reason=NULL`
  - Inserts audit entry
  - Returns updated customer record

#### B. Enforcement middleware:
- Create `server/middleware/requireNotBanned.js` — runs on all authenticated endpoints
  - Checks `GET /api/auth/me` response or cached user data for `is_banned` flag
  - If banned: invalidate session, clear cookie, return 401 with message "Account banned. Contact support."
  - Log admin action if mid-session ban detected

#### C. Booking validation:
- `POST /api/bookings` checks user's `is_banned` status before confirming
- If banned: return 403 `{error: "You are not permitted to book", code: "CUSTOMER_BANNED"}`

**Acceptance Criteria:**
- [x] Ban endpoint works; banned flag persisted
- [x] Unban endpoint works; unbanned customer can login
- [x] Mid-session ban detected; user forced to logout
- [x] Ban prevents new bookings
- [x] Audit entries created for ban/unban actions
- [x] Tests: ban user → attempt booking → rejection; ban mid-session → automatic logout
- [x] Tests pass: `npm run test:backend`

---

### T-5 — Airline restrictions (ban from specific airline)
**Dependencies:** T-2  
**Effort:** Small | **Est. Hours:** 4–5

**Description:**
Alternative to account ban: admins can restrict a customer from booking with a specific airline without banning entire account.

**Deliverables:**

#### A. Admin endpoints:
- **`POST /api/admin/airline-restrictions`**
  - Body: `{user_id, airline, reason}`
  - Inserts row into `airline_restrictions` table
  - Audit entry

- **`DELETE /api/admin/airline-restrictions/:id`**
  - Deletes restriction
  - Audit entry

- **`GET /api/admin/airline-restrictions?user_id=X`**
  - Lists all restrictions for a user

#### B. Booking validation:
- `POST /api/bookings` checks if user has restriction for flight's airline
- If restricted: return 403 `{error: "You are not permitted to book with [airline]", code: "AIRLINE_RESTRICTED"}`

**Acceptance Criteria:**
- [x] Restriction created and persisted
- [x] Booking rejected for restricted airline with proper error
- [x] Unrestricted user can book same airline
- [x] Audit entries logged
- [x] Tests pass: `npm run test:backend`

---

### T-6 — Attendant user type + role scaffolding
**Dependencies:** T-3  
**Effort:** Medium | **Est. Hours:** 6–8

**Description:**
Introduce 4th user type: attendant. Root or admin creates attendants and assigns them to an airline. Attendants have limited dashboard and can manage tickets for their airline.

**Deliverables:**

#### A. Attendant creation (root only):
- **`POST /api/admin/attendants`**
  - Body: `{email, password, airline}`
  - Creates user with `user_type='attendant'`
  - Inserts row into `attendant_assignments` (email → airline mapping)
  - Returns `{attendantId, email, airline}`

- **`DELETE /api/admin/attendants/:id`**
  - Deletes attendant (root only)
  - Cascades deletes from `attendant_assignments`
  - Soft-delete tickets (keep history)

#### B. Auth middleware:
- Create `server/middleware/requireAttendant.js` guard
- Checks `user_type='attendant'` and valid `attendant_assignments` row
- Can be used on attendant-only routes

#### C. Airline scope:
- Attendants can only see/manage flights & customers for their assigned airline
- Query helper: `getAttendantAirline(attendantId)` returns airline string

**Acceptance Criteria:**
- [x] Attendant user created with correct type
- [x] Attendant assigned to airline
- [x] Attendant can be deleted (root only)
- [x] Non-attendant cannot access attendant routes
- [x] Attendant restricted to own airline
- [x] Tests pass: `npm run test:backend`

---

## Sprint 3 — Security & Testing

### T-7 — Email-based security question recovery (updated)
**Dependencies:** T-3, T-6  
**Effort:** Small | **Est. Hours:** 3–4

**Description:**
Update password recovery to use email lookup (no more name-based lookup). Admins/root cannot recover via questions; customers only.

**Deliverables:**
- **`POST /api/auth/recover/init`** already updated in T-3 to accept email
- **`POST /api/auth/recover/answer`** validates email + question answers (same as before)
- Reject if user is admin/root with 403 `{error: "Admins cannot use password recovery"}`
- Reject if user is attendant with 403 `{error: "Attendants cannot use password recovery"}`

**Acceptance Criteria:**
- [x] Customer can recover password
- [x] Admin/root/attendant rejected
- [x] Tests pass: `npm run test:backend`

---

### T-8 — Security audit for V2 auth changes
**Dependencies:** T-3, T-4, T-5, T-6, T-7  
**Effort:** Medium | **Est. Hours:** 4–6

**Description:**
Audit all auth endpoints and middleware for security vulnerabilities introduced by V2 changes.

**Deliverables:**
- [ ] Review all SQL queries for email field: parameterized? Indexed?
- [ ] Confirm bearer token never logged or exposed to client
- [ ] Confirm ban check happens on every protected route
- [ ] Confirm airline restriction check happens in booking
- [ ] Confirm email is unique constraint (no duplicates)
- [ ] Confirm attendant routes guarded by airline scope
- [ ] Update CSP if needed for V2 API endpoints
- [ ] Document security assumptions in `server/README.md`

**Acceptance Criteria:**
- [x] All SQL parameterized (grep for string concatenation)
- [x] No bearer token exposure found
- [x] Ban/restriction checks cannot be bypassed
- [x] Security audit doc created
- [x] All tests pass

---

## Optional / Secondary Tasks

### T-9 (if time permits) — Admin audit trail enhancements
**Dependencies:** T-4, T-5, T-6  
**Effort:** Small | **Est. Hours:** 2–3

**Description:**
Enhance `admin_audit` logging to capture all admin actions with structured payloads.

**Deliverables:**
- Update audit logger to include: admin_id, action, target_type, target_id, payload_json (all changes), timestamp
- Example: `{action: "ban_customer", target_type: "user", target_id: 123, payload: {reason: "Policy", banned_by: 456}}`

---

## Checklist for Dev 1 Completion

- [ ] T-1: API V2 client working, bearer token injected
- [ ] T-2: Schema migration passes, all new tables created
- [ ] T-3: Email login fully functional, old name-based login deprecated
- [ ] T-4: Ban/unban endpoints work, mid-session ban forces logout
- [ ] T-5: Airline restrictions enforced in booking
- [ ] T-6: Attendant user type + airline assignment working
- [ ] T-7: Password recovery uses email
- [ ] T-8: Security audit completed, no vulnerabilities
- [ ] All tests passing: `npm run test:backend`
- [ ] `.env.example` updated with new vars
- [ ] Dev 2 unblocked to start booking work
- [ ] Dev 3 unblocked to start email login UI

---

## Coordination Notes

**With Dev 2:**
- After T-1, Dev 2 can start V2 flight schema work (MASTER T-9)
- After T-2 + T-3, Dev 2 can start booking validation (ban check, airline restrictions)
- After T-6, Dev 2 can implement attendant endpoints (MASTER T-7, T-8)

**With Dev 3:**
- After T-3, Dev 3 can update login page to email-based
- After T-4, Dev 3 can add ban-logout handling
- After T-6, Dev 3 can start attendant dashboard planning

