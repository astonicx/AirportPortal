# Developer 2 — Flights, Booking & API Integration Lead

**Primary Focus:** V2 API integration for flights, seat classes, baggage/extras pricing, frequent flier miles, booking pipeline with 36-hour rule, check-in logic, ticket management, attendant endpoints.

**Dependencies:**
- **Waits on Dev 1:** T-1 (API V2 client), T-2 (schema), T-3 (email auth)
- **Feeds Dev 3:** Booking endpoints, attendant dashboard endpoints

**Task Count:** 12 core tasks (~140 story points)

---

## Sprint 1 — V2 API Flight Integration (Unblocks booking)

### T-9 — Sync flight data schema to V2 response format
**Dependencies:** Dev 1 T-1  
**Effort:** Medium | **Est. Hours:** 6–7

**Description:**
The V2 API response includes new fields: seat classes (economy/exit_row/economy_plus/first_class), in-flight extras (wifi, meals, etc.), FFM credit per flight, and dynamic baggage fees. Update the flight cache to store these.

**Deliverables:**
- [ ] Document V2 flight object shape (run `GET` against V2 API, capture JSON sample)
- [ ] Update `flight_cache` table (via migration by Dev 1 T-2) to store:
  - `seat_classes_json` — array of seat class objects with pricing
  - `baggage_fees_json` — carry-on and checked bag pricing tiers
  - `extras_json` — available extras (wifi, meals, etc.) with $$ and FFM costs
  - `ffm_credit` — integer FFM earned per booking
- [ ] Update `server/routes/flights.js` `GET /api/flights` to:
  - Parse V2 response and extract above fields
  - Validate response schema (catch malformed data)
  - Log warnings if unexpected fields missing
- [ ] Update `server/jobs/flightSync.js` to persist new fields to cache on each refresh
- [ ] Test against V2 API staging (if available) or mock

**Acceptance Criteria:**
- [x] V2 flight response parsed correctly
- [x] New fields stored in cache
- [x] Flight sync job updates cache every 60s
- [x] Graceful handling of missing optional fields
- [x] Tests pass: `npm run test:backend`

---

### T-10 — Update flight API endpoint for V2 + 36-hour rule
**Dependencies:** T-9  
**Effort:** Medium | **Est. Hours:** 7–8

**Description:**
Extend `GET /api/flights` to return seat classes, baggage fees, extras, and FFM credit. Enforce 36-hour advance booking rule: only return departures departing >36h from now.

**Deliverables:**
- [ ] **`GET /api/flights?type=arrival|departure&page=&pageSize=&q=&sortBy=&sortDir=`** response shape:
  ```json
  {
    "flights": [
      {
        "id": "flight-123",
        "airline": "AA",
        "flightNumber": "101",
        "departureTime": "2026-07-20T14:00:00Z",
        "arrivalTime": "2026-07-20T18:00:00Z",
        "departureAirport": "JFK",
        "arrivalAirport": "LAX",
        "status": "scheduled",
        "bookable": true,
        "seatClasses": [
          {"class": "economy", "available": 40, "priceCents": 15000},
          {"class": "exit_row", "available": 4, "priceCents": 20000},
          {"class": "economy_plus", "available": 30, "priceCents": 18000},
          {"class": "first_class", "available": 6, "priceCents": 50000}
        ],
        "baggageAllowance": {
          "carryOnMax": 2,
          "carryOnPrices": [0, 0, 3000],
          "checkedMax": 5,
          "checkedPrices": [0, 0, 5000, 10000, 10000, 10000]
        },
        "availableExtras": [
          {"name": "wifi", "costCents": 800, "costFfm": 200},
          {"name": "meals", "costCents": 2000, "costFfm": 500}
        ],
        "ffmCredit": 5000
      }
    ],
    "page": 1,
    "pageSize": 10,
    "totalCount": 47
  }
  ```

- [ ] **Filter by 36-hour rule:** 
  - For `type=departure`, only include flights with `departureTime > now + 36 hours`
  - Response message if no bookable flights in range: `{flights: [], message: "No flights available for booking in the next 36 hours"}`

- [ ] **Pagination & search:** existing logic unchanged, now applied to V2 response

- [ ] Update response documentation in `server/routes/flights.md`

**Acceptance Criteria:**
- [x] V2 flight response includes seat classes, baggage, extras, FFM
- [x] 36-hour filter applied to departure flights
- [x] Bookable flights outside 36h returned but not bookable (for display)
- [x] Pagination works correctly
- [x] Tests: verify 36h filter, seat classes returned, baggage pricing included
- [x] Tests pass: `npm run test:backend`

---

### T-11 — Seat class pricing system
**Dependencies:** T-10  
**Effort:** Medium | **Est. Hours:** 5–6

**Description:**
Seats now have class-based pricing (economy $100, exit_row $150, etc.). Update seat locking and booking to handle per-class pricing.

**Deliverables:**
- [ ] **`GET /api/flights/:id/seats`** response shape:
  ```json
  {
    "seats": [
      {"seat": "1A", "class": "first_class", "priceCents": 50000, "available": true, "locked": false},
      {"seat": "1B", "class": "first_class", "priceCents": 50000, "available": true, "locked": false},
      {"seat": "1C", "class": "exit_row", "priceCents": 20000, "available": true, "locked": false},
      ...
    ]
  }
  ```

- [ ] **`POST /api/flights/:id/seats/lock`** now validates:
  - Seat exists and has requested class
  - Seat is available (not taken or locked by another session)
  - Lock is extended if same session re-locks same seat

- [ ] **`DELETE /api/flights/:id/seats/lock`** releases lock

- [ ] Background job: sweep expired locks every 10s (release locks with `locked_until < now()`)

**Acceptance Criteria:**
- [x] Seats returned with class and price
- [x] Lock accepts seat + class parameters
- [x] Price extracted from seat data for booking
- [x] Expired locks cleaned up
- [x] Tests: lock seat, verify price, release lock
- [x] Tests pass: `npm run test:backend`

---

## Sprint 2 — Booking & FFM System

### T-12 — Frequent flier miles (FFM) endpoints
**Dependencies:** Dev 1 T-2, T-3  
**Effort:** Medium | **Est. Hours:** 6–7

**Description:**
Customers earn FFM on ticket purchases (unless purchased with FFM). FFM can be spent on tickets, extras, or bags. Track balance, lifetime earned, lifetime spent.

**Deliverables:**
- [ ] **`GET /api/me/ffm`** (authenticated, customer only)
  - Returns: `{ffmBalance: 50000, lifetimeEarned: 100000, lifetimeSpent: 50000}`
  - Guests return 0 balance

- [ ] **Booking with FFM** (in T-15):
  - On `POST /api/bookings`, deduct FFM from `frequent_flier_accounts.ffm_balance`
  - Record cost breakdown in `ticket_extras` or separate field
  - Do NOT earn FFM if purchased with FFM

- [ ] **Earning FFM** (in T-15):
  - On successful booking, credit `ffm_credit` from flight to customer's account
  - If mixed payment ($ + FFM), only FFM portion doesn't earn (only money-paid portion earns)

- [ ] **Cancellation refunds** (in T-24):
  - On ticket cancel, refund FFM spent (if purchased with FFM)
  - Deduct FFM earned (if ticket gave FFM)
  - Result: customer back to pre-booking state

- [ ] **Validation:**
  - On booking, check: `ffmBalance >= ffmRequested` (convert to actual cost)
  - Return 400 if insufficient FFM: `{error: "Insufficient FFM balance", required: 5000, available: 3000}`

**Acceptance Criteria:**
- [x] Customer sees FFM balance endpoint
- [x] FFM deducted on purchase
- [x] FFM earned on purchase (unless purchased with FFM)
- [x] FFM refunded on cancellation
- [x] Mixed payment works (partial FFM, partial money)
- [x] Guests cannot use FFM
- [x] Tests: book with FFM, check balance; cancel, check refund
- [x] Tests pass: `npm run test:backend`

---

### T-13 — Baggage pricing from V2 API
**Dependencies:** T-10  
**Effort:** Small | **Est. Hours:** 3–4

**Description:**
Baggage pricing is now dynamic per flight (no longer hardcoded $30/$50/$100). Parse from `baggageAllowance` field in V2 response.

**Deliverables:**
- [ ] **`GET /api/flights/:id/baggage`**
  ```json
  {
    "carryOnMax": 2,
    "carryOnPrices": [0, 0, 3000],
    "checkedMax": 5,
    "checkedPrices": [0, 0, 5000, 10000, 10000, 10000]
  }
  ```
  - Index 0 = first item (free), index 1 = second item, etc.

- [ ] Booking validation uses these prices, not hardcoded values

**Acceptance Criteria:**
- [x] Baggage endpoint returns dynamic prices
- [x] Booking uses dynamic prices (not hardcoded)
- [x] Tests pass: `npm run test:backend`

---

### T-14 — Booking validation for 36-hour rule (backend)
**Dependencies:** T-10  
**Effort:** Small | **Est. Hours:** 2–3

**Description:**
Reject bookings if flight departs within 36 hours. This complements T-10's filtering; ensures enforcement on backend.

**Deliverables:**
- [ ] **`POST /api/bookings`** validates:
  - `flight.departureTime > now + 36 hours`
  - If not: return 400 `{error: "Must book at least 36 hours in advance", code: "BOOKING_TOO_CLOSE"}`

**Acceptance Criteria:**
- [x] Booking within 36h rejected
- [x] Booking 36h+ out accepted (if other validations pass)
- [x] Tests pass: `npm run test:backend`

---

### T-15 — In-flight extras in booking
**Dependencies:** T-12, T-13, T-14  
**Effort:** Medium | **Est. Hours:** 6–7

**Description:**
Customers can purchase extras (wifi, meals, etc.) during booking, paid with money or FFM or mix.

**Deliverables:**
- [ ] **`POST /api/bookings`** extended payload:
  ```json
  {
    "flightId": "flight-123",
    "passengerInfo": {...},
    "seat": "1A",
    "carryOnCount": 1,
    "checkedCount": 1,
    "extras": [
      {"name": "wifi", "paidWith": "money", "costCents": 800},
      {"name": "meals", "paidWith": "ffm", "costFfm": 500}
    ],
    "payment": {
      "method": "mixed",
      "moneyAmount_cents": 20000,
      "ffmAmount": 5000,
      "cardNumber": "4111111111111111",
      ...
    }
  }
  ```

- [ ] Compute total:
  - Seat price (from seat class)
  - Bag prices (from baggage endpoint)
  - Extras prices (from flight extras)
  - Mix payment: deduct FFM first, charge remainder to card

- [ ] Validate total payment:
  - `moneyAmount_cents + (ffmAmount * ffm_to_dollar_ratio) >= total_cents`
  - If not: return 400 `{error: "Insufficient payment", required: 25000, provided: 20000}`

- [ ] Store in DB:
  - `tickets` row as before
  - `ticket_extras` rows for each extra

- [ ] Update customer FFM account:
  - Deduct FFM spent
  - Credit FFM earned (if not paid-with-FFM)

**Acceptance Criteria:**
- [x] Extras accepted in booking payload
- [x] Extras persisted to `ticket_extras` table
- [x] Mixed payment works ($ + FFM)
- [x] Total calculation correct
- [x] FFM balance updated correctly
- [x] Tests: book with extras, check total, check FFM balance
- [x] Tests pass: `npm run test:backend`

---

### T-16 — Create ticket endpoint (for attendants)
**Dependencies:** Dev 1 T-6, T-15  
**Effort:** Medium | **Est. Hours:** 6–7

**Description:**
Attendants can create tickets for customers on their airline. Useful for phone bookings or manual issuance.

**Deliverables:**
- [ ] **`POST /api/attendant/tickets`** (attendant-only, own airline)
  ```json
  {
    "customerId": 123,
    "flightId": "flight-456",
    "passengerInfo": {
      "firstName": "Jane",
      "lastName": "Doe",
      "dob": "1990-05-10",
      "gender": "F",
      "email": "jane@example.com",
      "phone": "555-1234"
    },
    "seat": "1A",
    "carryOnCount": 1,
    "checkedCount": 1,
    "extras": [...],
    "payment": {...}
  }
  ```

- [ ] Validate:
  - Attendant assigned to flight's airline
  - Same validations as guest booking (36h, bookable, etc.)
  - **No No Fly check** (attendant creates for specific customer, assumed vetted)
  - Customer not banned
  - Customer not restricted from airline

- [ ] Create `tickets` row, link to customer_id
- [ ] Generate confirmation code
- [ ] Return ticket detail

**Acceptance Criteria:**
- [x] Attendant can create ticket for own airline
- [x] Attendant cannot create for other airline
- [x] Non-attendant rejected
- [x] Ticket linked to customer
- [x] Confirmation code generated
- [x] Tests pass: `npm run test:backend`

---

## Sprint 3 — Ticket Management & Check-in

### T-17 — Payment with FFM + money mix
**Dependencies:** T-15  
**Effort:** Small | **Est. Hours:** 2–3

**Description:**
Already covered in T-15; ensure payment engine correctly handles mixed FFM + money.

**Deliverables:**
- [ ] Verify T-15 implementation handles mixed payment correctly
- [ ] Test: book with $50 + 5000 FFM, total $75 → correct split

**Acceptance Criteria:**
- [x] Mixed payment works as expected

---

### T-18 — Check-in validation & logic
**Dependencies:** T-10  
**Effort:** Medium | **Est. Hours:** 5–6

**Description:**
Implement check-in flow: customer checks in within 24 hours of departure, gets gate + status update, inserts check-in record.

**Deliverables:**
- [ ] **`POST /api/tickets/:id/checkin`** (authenticated or guest with lastName match)
  ```json
  {
    "lastName": "Doe"
  }
  ```

- [ ] Validate:
  - Ticket exists
  - Flight departs within 24 hours (`departureTime <= now + 24h`)
  - `lastName` matches ticket's passenger_last
  - Ticket not already cancelled

- [ ] On success:
  - Insert `checkin_records` row (ticket_id, checked_in_at, gate, status)
  - Fetch gate/status from V2 API (if available)
  - Return: `{gate: "A1", boardingGroup: "B", checkedInAt: "2026-07-20T13:45:00Z"}`

- [ ] On error:
  - If not yet within 24h: `{error: "Check-in not yet available", availableAt: "2026-07-20T12:00:00Z"}`
  - If already checked in: redirect response code 303 + location `/api/tickets/:id` (frontend handles redirect)
  - If cancelled: `{error: "Ticket cancelled"}`

**Acceptance Criteria:**
- [x] Check-in allowed within 24h of departure
- [x] Check-in rejected if > 24h out
- [x] Check-in prevents duplicates (redirects on second attempt)
- [x] Gate info returned on success
- [x] Tests: check-in within 24h, verify record created; attempt > 24h, rejected
- [x] Tests pass: `npm run test:backend`

---

### T-19 — Check-in view backend (guest lookup)
**Dependencies:** T-18  
**Effort:** Small | **Est. Hours:** 2–3

**Description:**
Update existing ticket lookup endpoint to include check-in eligibility info.

**Deliverables:**
- [ ] **`GET /api/tickets/by-confirmation?lastName=X&code=Y`** response now includes:
  ```json
  {
    "id": 456,
    "confirmationCode": "ABC123",
    "passengerName": "Jane Doe",
    "flightId": "flight-789",
    "airline": "AA",
    "flightNumber": "101",
    "departureTime": "2026-07-20T14:00:00Z",
    "gate": "A1",
    "status": "scheduled",
    "checkedInAt": null,
    "checkinEligible": true,
    "checkinReason": null
  }
  ```

- [ ] If not within 24h:
  ```json
  {
    "checkinEligible": false,
    "checkinReason": "Check-in opens 24 hours before departure (2026-07-19T14:00:00Z)",
    "availableAt": "2026-07-19T14:00:00Z"
  }
  ```

**Acceptance Criteria:**
- [x] Check-in eligibility flag returned
- [x] Reason provided if not eligible
- [x] Tests pass: `npm run test:backend`

---

### T-24 — Ticket lookup + cancel endpoints (updated for check-in)
**Dependencies:** T-18  
**Effort:** Small | **Est. Hours:** 2–3

**Description:**
Ticket cancel endpoint updates: on cancel, refund FFM; mark seats as released.

**Deliverables:**
- [ ] **`POST /api/tickets/:id/cancel`** (existing endpoint, extend):
  - Check if ticket already cancelled (idempotent)
  - If FFM was spent: refund to `frequent_flier_accounts.ffm_balance`
  - If FFM was earned: deduct from balance
  - Free seat locks
  - Set ticket status to `cancelled`, record `cancelled_at`
  - Call V2 API to release seat (if API supports)

**Acceptance Criteria:**
- [x] FFM refunded on cancel
- [x] FFM earned deducted on cancel
- [x] Seat released
- [x] Idempotent (cancel twice = same result)
- [x] Tests: book with FFM, cancel, verify balance restored
- [x] Tests pass: `npm run test:backend`

---

## Sprint 4 — Attendant Dashboard & Search

### T-21 — Attendant paginated ticket list
**Dependencies:** T-8 (Dev 1), T-16  
**Effort:** Medium | **Est. Hours:** 5–6

**Description:**
Attendants can view all tickets for a flight on their airline, paginated and searchable.

**Deliverables:**
- [ ] **`GET /api/attendant/flights/:flightId/tickets?page=1&pageSize=20&sortBy=name&sortDir=asc`**
  - Validates attendant assigned to flight's airline
  - Returns paginated list:
  ```json
  {
    "tickets": [
      {
        "id": 1001,
        "confirmationCode": "ABC123",
        "customerName": "Jane Doe",
        "customerEmail": "jane@example.com",
        "seat": "1A",
        "status": "active",
        "bookedAt": "2026-07-16T10:00:00Z",
        "checkedInAt": null
      }
    ],
    "page": 1,
    "pageSize": 20,
    "totalCount": 45
  }
  ```

- [ ] Sortable by: name, seat, status, booked_at, checked_in_at
- [ ] Searchable by: name, email, seat, confirmation code (fuzzy match)

**Acceptance Criteria:**
- [x] Attendant sees own airline's tickets only
- [x] Pagination works
- [x] Sorting works
- [x] Search works
- [x] Non-attendant rejected
- [x] Tests pass: `npm run test:backend`

---

### T-22 — Background job: clean expired seat locks
**Dependencies:** T-11  
**Effort:** Small | **Est. Hours:** 2–3

**Description:**
Every 10 seconds, delete expired seat locks to free up seats.

**Deliverables:**
- [ ] Update `server/jobs/flightSync.js` or create new job `server/jobs/seatLockCleanup.js`:
  - Delete all `seat_locks` rows with `locked_until < now()`
  - Run every 10s
  - Log deleted count

**Acceptance Criteria:**
- [x] Expired locks deleted
- [x] Fresh locks not affected
- [x] Job runs periodically without errors

---

## Integration Tests (Dev 2 + Dev 1 + Dev 3 Collaboration)

### T-33 — Unit + integration tests for V2 changes
**Dependencies:** All Phases  
**Effort:** Large | **Est. Hours:** 12–14

**Description:**
Comprehensive test suite covering all V2 changes.

**Deliverables:**
- [ ] **Unit tests:**
  - V2 API client: bearer token injection, 555 retry
  - Email login: unique email validation, ban enforcement
  - FFM: earn on purchase, deduct on cancel, no earn if paid-with-FFM
  - Seat classes: price lookup per class
  - 36-hour rule: filter logic
  - Check-in: 24-hour eligibility
  - Baggage pricing: dynamic prices applied

- [ ] **Integration tests:**
  - V2 signup → login with email → book with seat class + extras + FFM → check-in → cancel (with FFM refund)
  - Ban user → logout mid-session
  - Restrict airline → booking rejected
  - Attendant creates ticket for customer
  - Attendant views paginated ticket list

- [ ] **Mock V2 API** using `msw/node` or similar

- [ ] **E2E tests:** (Dev 3 + Dev 2)
  - User signup → login → browse flights (with 36h filter) → select seat class → add extras → pay with FFM+money → check-in

**Acceptance Criteria:**
- [x] All tests pass: `npm run test:backend`
- [x] E2E tests pass: `npm run test:e2e`
- [x] Coverage >80% on critical paths

---

## Checklist for Dev 2 Completion

- [ ] T-9: V2 flight schema parsed and cached
- [ ] T-10: Flight endpoint returns seat classes, baggage, extras, FFM, 36h filter
- [ ] T-11: Seat class pricing system working
- [ ] T-12: FFM endpoints functional
- [ ] T-13: Baggage pricing dynamic per flight
- [ ] T-14: 36-hour validation in booking
- [ ] T-15: Extras in booking, mixed payment working
- [ ] T-16: Attendant ticket creation working
- [ ] T-17: FFM + money mix payment works
- [ ] T-18: Check-in logic and validation complete
- [ ] T-19: Check-in eligibility in lookup endpoint
- [ ] T-24: Cancel refunds FFM correctly
- [ ] T-21: Attendant paginated ticket list
- [ ] T-22: Seat lock cleanup job running
- [ ] T-33: Integration tests passing
- [ ] All tests passing: `npm run test:backend`
- [ ] Dev 3 unblocked for booking UI

---

## Coordination Notes

**With Dev 1:**
- T-1 (V2 API client) unblocks T-9
- T-2 (schema) unblocks T-12
- T-3 (email login) unblocks T-12
- T-6 (attendant type) unblocks T-7, T-8, T-16

**With Dev 3:**
- T-10 (flight response) unblocks T-18 (flights UI)
- T-15 (booking endpoint) unblocks T-25, T-26 (booking UI)
- T-18 (check-in) unblocks T-28 (check-in UI)

