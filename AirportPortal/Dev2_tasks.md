# Developer 2 — Flights, Booking & API Integration

**Focus:** Flight cache/sync, booking pipeline (seat locks, No Fly, bag pricing, ticket lifecycle), admin backend, integration tests.
**Parallelism note:** Starts in earnest after Dev 1 completes Task 4 (API client). Booking UI hand-off to Dev 3 once endpoints are ready.

---

## Task 16 — Backend flights proxy + cache
Dependencies: Task 4 (Dev 1)
Expected Output:
- `GET /api/flights` with query params: `type` (`arrival`|`departure`), `page`, `pageSize`, `q`, `sortBy` (flightNumber, airline, airport, city, time, gate), `sortDir`.
- Strips `status=="past"` from public listing.
- `GET /api/flights/:id` reads cache then API fallback.
- Response shape documented in `server/routes/flights.md`.

## Task 17 — Flight cache refresher job
Dependencies: Task 16
Expected Output:
- `server/jobs/flightSync.js` runs every 60s (configurable) and refreshes `flight_cache` page-by-page.
- Prunes `past` entries >7 days old unless referenced by `tickets`.
- Graceful shutdown handler.

## Task 21 — No Fly List check endpoint
Dependencies: Task 4 (Dev 1)
Expected Output:
- `POST /api/no-fly/check` body `{first, middle, last, dob, gender}` → `{blocked: bool, reason?: string}`.
- Case-insensitive comparison; trims whitespace.
- Unit test asserts blocking of documented test passenger (Restricted User Flier, 1985-12-25, male).

## Task 22 — Seat availability + locking
Dependencies: Tasks 16, 3 (Dev 1)
Expected Output:
- `GET /api/flights/:id/seats` returns 90-seat map with state per seat: `available` | `taken` | `locked` | `mine`.
- `POST /api/flights/:id/seats/lock` reserves a seat for 10 minutes (extends if same session).
- `DELETE /api/flights/:id/seats/lock` releases.
- Background sweep removes expired locks.

## Task 23 — Booking endpoint
Dependencies: Tasks 21, 22, 9 (Dev 1)
Expected Output:
- `POST /api/bookings` payload: flightId, passenger info, payment (fake), seat, carryOnCount, checkedCount.
- Server enforces: `bookable==true`, `status=="scheduled"`, `arriveAtReceiver > now + 24h`, seat lock owned, No Fly cleared, airline-ban cleared.
- Server-computed price: seat_price + bag fees (carry 0→0, 1→0, 2→30; checked 0→0, 1→0, 2→50, 3+→+100 each).
- Calls BDPA `POST /v1/flights/:id/book`; persists `tickets` row with crypto-random 8-char confirmation code.
- Associates with `user_id` if authenticated.

## Task 24 — Ticket lookup + cancel endpoints
Dependencies: Task 23
Expected Output:
- `GET /api/tickets/by-confirmation?lastName=&code=` → ticket detail (404 if mismatch).
- `POST /api/tickets/:id/cancel` allowed for owner, admin, or guest with matching lastName+code. Only if flight hasn't departed.
- Calls API to release seat, sets `status='cancelled'`, frees `seat_locks`.

## Task 30 — Dashboard + me endpoints
Dependencies: Tasks 10 (Dev 1), 23
Expected Output:
- `GET /api/me/dashboard` returns profile (incl. `last_login_ip`, `last_login_datetime`), upcoming tickets, past tickets (joined with cached flight data so past flights survive API deletion).
- `PATCH /api/me` profile edits (no type change).
- `DELETE /api/me` deletes customer; retains anonymized ticket history.
- `POST /api/me/cards`, `DELETE /api/me/cards/:id` for saved fake cards.
- `POST /api/me/claim-ticket` body `{lastName, confirmation}` attaches existing guest ticket when lastName matches.

## Task 33 — Admin endpoints
Dependencies: Tasks 23, 30
Expected Output:
- `GET /api/admin/stats` returns ticket counts + gross totals for windows: 1d, 7d, 30d, 365d, all.
- `GET /api/admin/customers?q=` search across email, address, name, phone.
- `POST /api/admin/customers` (sets must_change_password + must_complete_profile flags).
- `PATCH /api/admin/customers/:id` (cannot change type).
- `DELETE /api/admin/customers/:id`.
- `GET /api/admin/tickets?q=` search by any flight field (joined via cache).
- `POST /api/admin/tickets/:id/cancel`.
- `POST /api/admin/airline-bans` `{identity, airline}`, `DELETE /api/admin/airline-bans/:id`.
- All routes guarded by admin scope; admin-on-admin writes return 403 (root only).

## Task 42 — Test suite
Dependencies: Phases 1–5 (coordinate with Dev 1 and Dev 3)
Expected Output:
- Vitest unit tests: bag pricing, sort comparator, password hash, No Fly normalization, confirmation-code generator.
- Supertest integration tests: signup→login→book→cancel happy path; lockout after 3 fails; admin cancel; root-only admin CRUD; No Fly block.
- Mock BDPA API using `msw/node`.
- npm script `test` runs all; CI workflow file (`.github/workflows/ci.yml`).

---

**Workload summary:** 9 large tasks covering the booking critical path + admin backend + integration tests. Tightly couples with Dev 1's auth and Dev 3's UI.
