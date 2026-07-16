# BDPA Airports Portal — V2 Implementation Master Task List

**Status:** BDPA NHSCC 2020 Problem Statement (Part 2) — 10 Changes Integration  
**Stack:** React + Vite + TailwindCSS (frontend), Express + SQLite (backend)  
**API:** V2 API at `https://airports.api.hscc.bdpa.org/v2` (replaces v1)  
**Date Generated:** 2026-07-16

---

## Overview of 10 Changes

| # | Change | Impact | Priority |
|---|--------|--------|----------|
| 1 | Customer banning & airline restrictions | Auth + Booking validation | High |
| 2 | Airline attendants (4th user type) | Auth + Dashboard + Search | High |
| 3 | Check-in view (24-hour window) | Booking flow + Ticket UI | Medium |
| 4 | V2 API migration | All endpoints (base URL + schema) | **Critical** |
| 5 | Frequent flier miles (FFM) | Booking + Dashboard | Medium |
| 6 | Seat classes + in-flight extras | Pricing + Booking UI | High |
| 7 | Persistent sidebar with flight info | UX/Layout | Low |
| 8 | 36-hour advance booking requirement | Booking validation | Medium |
| 9 | Dynamic baggage fees from API | V2 integration | Medium |
| 10 | Email-based login (not name-based) | Auth system | **Critical** |

---

## Phase 0 — Foundations (Unblocks All Teams)

### T-1: Update API client for V2 + bearer token integration
**Owner:** Dev 1 | **Dependencies:** None  
**Effort:** M | **Deliverables:**
- Update `server/utils/apiClient.js` to use V2 base URL
- Add bearer token injection (read from env `BEARER_TOKEN`)
- Update retry logic for V2 error responses (incl. HTTP 555)
- Update cache key strategy for V2 response format

### T-2: Expand SQLite schema for new features
**Owner:** Dev 1 | **Dependencies:** T-1  
**Effort:** L | **Deliverables:**
- `server/db/migrations/0002_v2_features.sql`:
  - `users` table: add `is_banned` (bool), `banned_reason` (text), `user_type` (enum: guest/customer/admin/attendant/root)
  - `airline_restrictions` table: (user_id, airline, reason, created_at)
  - `frequent_flier_accounts` table: (user_id, ffm_balance, lifetime_earned, lifetime_spent, updated_at)
  - `ticket_extras` table: (ticket_id, extra_name, cost_cents, cost_ffm, purchased_at)
  - `attendant_assignments` table: (attendant_id, airline, assigned_at)
  - `checkin_records` table: (ticket_id, checked_in_at, gate, status)

### T-3: Email-based login system (replace name-based)
**Owner:** Dev 1 | **Dependencies:** T-2  
**Effort:** M | **Deliverables:**
- Modify `users` table: add `email` column (unique, required), make `first_name/last_name` optional for guests
- Update signup validation: require unique email
- **Replace** `POST /api/auth/login` to accept `email` + `password` (not first/last name + disambiguator)
- Remove login-disambiguator logic; emails are unique keys
- Update login-audit to track email instead of name combo
- Update security questions flow to use email lookup
- Update `PATCH /api/me` to prevent email changes (or require verification)

---

## Phase 1 — Auth & User Management (Dev 1 + Dev 2)

### T-4: Customer ban/unban endpoints + enforcement
**Owner:** Dev 1 | **Dependencies:** T-3  
**Effort:** M | **Deliverables:**
- `POST /api/admin/customers/:id/ban` body `{reason}` → sets `is_banned=1`
- `POST /api/admin/customers/:id/unban` → sets `is_banned=0`
- Root-only or admin-only guard
- Middleware `requireNotBanned` checks `is_banned` on every authenticated request; forces logout if ban detected mid-session
- Audit entries in `admin_audit` table

### T-5: Airline restrictions endpoint
**Owner:** Dev 1 | **Dependencies:** T-2  
**Effort:** S | **Deliverables:**
- `POST /api/admin/airline-restrictions` body `{user_id, airline, reason}` → inserts row
- `DELETE /api/admin/airline-restrictions/:id` → removes restriction
- `GET /api/admin/airline-restrictions?user_id=X` → list user's restrictions

### T-6: Attendant user type + role scaffolding
**Owner:** Dev 1 | **Dependencies:** T-2  
**Effort:** M | **Deliverables:**
- Update `users.user_type` enum to include `attendant`
- `POST /api/admin/attendants` body `{email, password, airline}` → creates attendant, inserts `attendant_assignments`
- `DELETE /api/admin/attendants/:id` → deletes attendant (root only)
- `RequireAttendant` middleware guard for attendant routes
- Attendant cannot create/modify other attendants

### T-7: Attendant customer search endpoint
**Owner:** Dev 2 | **Dependencies:** T-6  
**Effort:** M | **Deliverables:**
- `GET /api/attendant/customers?q=` → search customers by email, name, phone, address (full-text)
- Restricted to own airline (via `attendant_assignments`)
- Response includes contact info + ticket count

### T-8: Attendant ticket management endpoints
**Owner:** Dev 2 | **Dependencies:** T-7  
**Effort:** M | **Deliverables:**
- `GET /api/attendant/tickets?q=` → search tickets by flight field (joined to cache)
- Restricted to own airline
- `GET /api/attendant/tickets/:id` → ticket detail for confirmation
- `POST /api/attendant/tickets` → create ticket for customer (new T-16 v2)
- `POST /api/attendant/tickets/:id/cancel` → cancel upcoming ticket (v2)
- `GET /api/attendant/flights` → list flights for own airline (paginated)

---

## Phase 2 — API V2 Integration & Flights

### T-9: Sync flight data schema to V2 response format
**Owner:** Dev 2 | **Dependencies:** T-1  
**Effort:** M | **Deliverables:**
- Document V2 flight response shape (seat classes, FFM credit, baggage fees, extras)
- Update `server/routes/flights.js` to parse V2 response
- Add fields to `flight_cache` table: `seat_classes_json`, `baggage_fees_json`, `extras_json`, `ffm_credit`
- Update flight sync job `server/jobs/flightSync.js` to store new fields

### T-10: Update flight API endpoint for V2
**Owner:** Dev 2 | **Dependencies:** T-9  
**Effort:** M | **Deliverables:**
- `GET /api/flights?type=arrival|departure&page=&pageSize=&q=&sortBy=&sortDir=` now includes:
  - `seat_classes` (array: economy, exit_row, economy_plus, first_class with prices)
  - `ffm_credit` (number)
  - `baggage_allowance` (carry_on_max, checked_max, carry_on_prices, checked_prices from API)
  - `available_extras` (array: name, price_cents, price_ffm)
- Filter by 36-hour rule: only return departures with `departureTime > now + 36h`

### T-11: Seat class pricing system
**Owner:** Dev 2 | **Dependencies:** T-10  
**Effort:** M | **Deliverables:**
- `GET /api/flights/:id/seats` now includes `seat_class` per seat
- Seats map with cost per class, e.g., `{seat: "1A", class: "first_class", price_cents: 50000, available: true}`
- `POST /api/flights/:id/seats/lock` now validates seat exists in requested class

### T-12: Frequent flier miles endpoints
**Owner:** Dev 2 | **Dependencies:** T-2  
**Effort:** M | **Deliverables:**
- `GET /api/me/ffm` → returns `{ffm_balance, lifetime_earned, lifetime_spent}`
- On ticket booking: if customer uses FFM, deduct cost from balance (insert `frequent_flier_accounts` row with negative adjustment)
- On ticket cancellation: if ticket was purchased with FFM, refund to balance
- FFM not earned if purchased with FFM
- Guests cannot use FFM

### T-13: Baggage pricing from V2 API
**Owner:** Dev 2 | **Dependencies:** T-9  
**Effort:** S | **Deliverables:**
- `GET /api/flights/:id/baggage` returns:
  - `carry_on_max`, `carry_on_prices` (array per count)
  - `checked_max`, `checked_prices` (array per count)
- Pricing now dynamic per flight (not hardcoded $30/$50/$100)

---

## Phase 3 — Booking System Updates

### T-14: Update booking validation for 36-hour rule
**Owner:** Dev 2 | **Dependencies:** T-10  
**Effort:** S | **Deliverables:**
- `POST /api/bookings` rejects if flight departs within 36 hours
- Error: `{ code: "BOOKING_TOO_CLOSE", message: "Must book at least 36 hours in advance" }`

### T-15: In-flight extras in booking
**Owner:** Dev 2 | **Dependencies:** T-11  
**Effort:** M | **Deliverables:**
- `POST /api/bookings` payload now includes `extras: [{name, quantity, paidWith: "money"|"ffm"}]`
- Server computes total: base seat + bags + extras
- User can mix payment methods (e.g., $100 seat + 5000 FFM for wifi + $50 bag)
- Inserted into `ticket_extras` table with cost breakdown
- On cancel: refund FFM portion to account

### T-16: Create ticket endpoint (for attendants)
**Owner:** Dev 2 | **Dependencies:** T-8, T-15  
**Effort:** M | **Deliverables:**
- `POST /api/attendant/tickets` restricted to attendant for own airline
- Payload: customer_id, flight_id, passenger info, seat, bags, extras
- Same validation as guest booking (no No Fly for attendant-created, but enforces 36h rule)
- Issues confirmation code, returns ticket

### T-17: Booking payment with FFM + money mix
**Owner:** Dev 2 | **Dependencies:** T-12, T-15  
**Effort:** M | **Deliverables:**
- Extend `POST /api/bookings` to accept:
  - `payment.method: "money" | "ffm" | "mixed"`
  - If mixed: `payment.moneyAmount_cents`, `payment.ffmAmount`
- Validate: `moneyAmount + (ffmAmount * ffm_rate) >= total_cents`
- On success: deduct FFM from account, credit FFM on next flight (unless paid-with-FFM)

---

## Phase 4 — Check-in System

### T-18: Check-in validation & logic
**Owner:** Dev 2 | **Dependencies:** T-10  
**Effort:** M | **Deliverables:**
- Tickets can only be checked in if flight departs within 24 hours
- `POST /api/tickets/:id/checkin` body `{lastName}` → validates match, checks timing
  - If valid: insert `checkin_records`, return gate + boarding status
  - If already checked in: redirect to ticket detail
  - If < 24h: return "Not yet available"
- `GET /api/tickets/:id/checkin-eligible` → bool (used by frontend for UI)

### T-19: Check-in view backend (guest lookup)
**Owner:** Dev 2 | **Dependencies:** T-18  
**Effort:** S | **Deliverables:**
- Existing `GET /api/tickets/by-confirmation?lastName=&code=` endpoint now checks 24h eligibility
- Response includes `checkin_eligible: bool`, `reason?: string` if not eligible

### T-20: Ticket view redirect logic (check-in enforcement)
**Owner:** Dev 3 | **Dependencies:** T-18, (frontend)  
**Effort:** S | **Deliverables:**
- Frontend: `GET /api/tickets/:id` response includes `checked_in_at`, `requires_checkin_first`
- On frontend `/ticket/:confirmation` load: if `requires_checkin_first=true`, redirect to `/checkin`
- After successful check-in, redirect back to `/ticket/:confirmation`

---

## Phase 5 — Attendant Dashboards & Seat Management

### T-21: Attendant paginated ticket list
**Owner:** Dev 2 | **Dependencies:** T-8  
**Effort:** M | **Deliverables:**
- `GET /api/attendant/flights/:flightId/tickets?page=&pageSize=` → paginated list
- Each row: customer name, email, seat, status, confirmation code
- Sortable by name, seat, status, booked time

### T-22: Cancel seat lock on expired lock
**Owner:** Dev 2 | **Dependencies:** T-11  
**Effort:** S | **Deliverables:**
- Background job: every 10s, delete `seat_locks` with `locked_until < now()`
- Frees up seats for other users

---

## Phase 6 — Customer Experience (Frontend)

### T-23: Email login page (replace name-based)
**Owner:** Dev 3 | **Dependencies:** T-3  
**Effort:** M | **Deliverables:**
- Replace `src/pages/Login.jsx` form: email + password (not first/last name)
- Remove disambiguator field
- Update error messages (email not found vs. password mismatch)
- Link to signup + password recovery

### T-24: Signup page updated for email + optional name
**Owner:** Dev 3 | **Dependencies:** T-3  
**Effort:** S | **Deliverables:**
- Update `src/pages/Signup.jsx`: email field (required, unique validation)
- First/last name optional for now (can be filled later in dashboard)
- Unique email validation on client side (debounced POST check)

### T-25: Persistent sidebar with upcoming flight
**Owner:** Dev 3 | **Dependencies:** T-10  
**Effort:** M | **Deliverables:**
- Component `src/components/layout/UpcomingSidebar.jsx` shown on all authenticated pages
- Displays nearest upcoming flight: airline, number, destination, departure date/time
- Display first name ("Hi, [firstName]!"), email, FFM balance (if customer)
- Auto-refresh via `useLiveResource` every 30s
- Responsive: hidden on mobile, fixed on desktop

### T-26: Seat class UI in booking
**Owner:** Dev 3 | **Dependencies:** T-11, T-26  
**Effort:** L | **Deliverables:**
- Update `src/pages/Booking/SeatMap.jsx` to show seat classes with color coding
- Seat prices displayed per class (economy $100, exit_row $150, etc.)
- On hover: show full price breakdown
- Legend: economy | exit row | economy plus | first class

### T-27: In-flight extras selection
**Owner:** Dev 3 | **Dependencies:** T-15  
**Effort:** M | **Deliverables:**
- New booking step `src/pages/Booking/Extras.jsx`
- Checklist of available extras with prices in $$ and FFM
- Radio buttons: pay with money / FFM / mixed
- Live price calculation

### T-28: Check-in view
**Owner:** Dev 3 | **Dependencies:** T-18, T-19  
**Effort:** M | **Deliverables:**
- `src/pages/CheckIn.jsx` → form for last name + confirmation code (for guests)
- Authenticated customers auto-populate; show nearby flights with check-in button
- On submit: calls `POST /api/tickets/:id/checkin`
- Success: shows gate, boarding group, timestamp
- Not eligible: shows "Available after [time]"
- On success: redirect to `/ticket/:confirmation`

### T-29: FFM balance display
**Owner:** Dev 3 | **Dependencies:** T-12  
**Effort:** S | **Deliverables:**
- Add FFM balance to dashboard
- Show in sidebar (T-25)
- Show in booking review step

### T-30: Customer ban/logout handling
**Owner:** Dev 3 | **Dependencies:** T-4  
**Effort:** S | **Deliverables:**
- On any authenticated request, check response header or `GET /api/auth/me` for ban status
- If banned mid-session: show modal "Your account has been banned", force logout
- Redirect to login

### T-31: Airline restriction error handling
**Owner:** Dev 3 | **Dependencies:** T-5, T-15  
**Effort:** S | **Deliverables:**
- On booking error `AIRLINE_RESTRICTED`: show friendly message "You are not permitted to book with [airline]"

### T-32: Attendant dashboard (frontend)
**Owner:** Dev 3 | **Dependencies:** T-8, T-21  
**Effort:** L | **Deliverables:**
- `src/pages/admin/AttendantDashboard.jsx`:
  - Flights list for assigned airline (paginated)
  - Search customers by name/email
  - Search tickets by flight field
  - Click flight → view paginated ticket list (customers, seats, status)
  - Quick cancel button per ticket
  - Create ticket modal (customer email + flight + passenger info)

---

## Phase 7 — Testing & Hardening

### T-33: Unit + integration tests for V2 changes
**Owner:** Dev 1, 2, 3 | **Dependencies:** All phases  
**Effort:** L | **Deliverables:**
- V2 API client tests (bearer token injection, 555 retry)
- Email login tests (signup→login with email, unique email validation)
- Ban/unban tests (mid-session ban forces logout)
- Airline restriction tests (booking rejected with correct error)
- FFM balance tests (earn on purchase, deduct on cancel, no earn if paid-with-FFM)
- 36-hour rule tests (booking rejected if within 36h)
- Check-in tests (eligible within 24h, redirects on not-checked-in)
- Attendant CRUD tests (restricted to own airline)
- Seat class pricing tests (correct price per class)
- In-flight extras tests (mix payment methods)
- E2E: signup (email) → login → book with FFM+money → check-in → cancel

### T-34: Security audit for V2
**Owner:** Dev 1 | **Dependencies:** T-33  
**Effort:** M | **Deliverables:**
- Bearer token never exposed to client
- Email addresses are unique keys (no SQL injection via email)
- Ban enforcement on all auth-required routes
- Airline restrictions checked before booking
- FFM balance validated before purchase
- Attendant routes guarded by airline scope

---

## Dependency Graph (TL;DR)

```
T-1 (V2 API client)
  → T-2 (schema expansion)
    → T-3 (email login)
      → T-4 (ban system)
      → T-5 (airline restrictions)
      → T-6 (attendant type)
        → T-7, T-8 (attendant endpoints)
    → T-9 (V2 flight schema)
      → T-10 (flight endpoint V2)
        → T-11 (seat classes)
          → T-26 (seat class UI)
        → T-13 (baggage pricing)
      → T-12 (FFM system)
    → T-14, T-15 (36h + extras)
      → T-16 (attendant ticket creation)
      → T-17 (FFM+money payment)
      → T-18 (check-in logic)
        → T-19, T-20 (check-in UI)
        → T-28 (check-in page)

T-23, T-24 (email login UI)
T-25 (sidebar) — all phases
T-27, T-29, T-30, T-31 (UX updates)
T-32 (attendant dashboard)
T-33, T-34 (testing + security)
```

---

**Next Steps:** See `Dev1_tasks_v2.md`, `Dev2_tasks_v2.md`, `Dev3_tasks_v2.md` for individual assignments with sprint planning.
