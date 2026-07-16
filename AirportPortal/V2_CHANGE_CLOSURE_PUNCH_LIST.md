# V2 Change Closure Punch List

Date: 2026-07-16
Scope: Close remaining gaps for the 10 V2 changes implemented across Dev 1-3.

## Current Status Snapshot

- Fully implemented: 1, 2, 4, 10
- Partially implemented: 3, 5, 6, 8, 9
- Missing: 7

## Dev 3 (Frontend)

### 1) Persistent Sidebar (Change 7)

- Create `src/components/layout/UpcomingSidebar.jsx`.
- Mount sidebar in authenticated layout shell in `src/components/layout/Layout.jsx`.
- Show:
  - User greeting and email
  - Nearest upcoming flight (airline, number, destination, departure)
  - FFM balance for customer users
- Data sources:
  - `GET /api/auth/me`
  - `GET /api/me/dashboard`
  - `GET /api/me/ffm`
- Refresh strategy:
  - Poll every 30s with `useLiveResource`.

### 2) Check-in Page and Routing (Change 3)

- Add route for `/checkin` in `src/App.jsx`.
- Create `src/pages/Checkin.jsx`:
  - Inputs: confirmation code + last name
  - Lookup ticket with `GET /api/tickets/by-confirmation`
  - Check eligibility
  - Perform check-in via `POST /api/tickets/:id/checkin`
- Update `src/pages/Ticket.jsx`:
  - Respect backend check-in flags (`requires_checkin_first`, `checked_in_at` when present)
  - Redirect to `/checkin` before ticket details when required
  - Redirect back to ticket after successful check-in

### 3) Booking UI Contract Completion (Changes 5 and 6)

- Update `src/pages/booking/SeatMap.jsx`:
  - Show class legend and class price labels
  - Persist selected `seatClass`
- Update `src/pages/booking/Review.jsx`:
  - Include `seatClass`
  - Include `extras`
  - Include `payment.ffmToApply`
- Show friendly booking errors for:
  - `AIRLINE_RESTRICTED`
  - `BOOKING_TOO_CLOSE`
  - `INSUFFICIENT_FFM`

### 4) Dynamic Baggage Pricing in UI (Change 9)

- Update `src/pages/booking/Bags.jsx`:
  - Replace hardcoded fee function
  - Fetch `GET /api/flights/:id/baggage`
  - Calculate totals from dynamic `carryOnPrices` and `checkedPrices`

### 5) Align Frontend to 36-Hour Rule (Change 8)

- Update `src/pages/FlightDetail.jsx`:
  - Replace 24-hour threshold with 36-hour threshold for bookability

## Dev 2 (Backend)

### 6) Add Check-in Eligibility Endpoint and Flags (Change 3)

- In `server/routes/tickets.js`, add:
  - `GET /api/tickets/:id/checkin-eligible`
- Ensure ticket detail response includes:
  - `requires_checkin_first`
  - `checked_in_at`

### 7) FFM Reconciliation on Cancel (Change 5)

- In `server/routes/tickets.js` cancel flow:
  - Refund all spent FFM (booking + extras)
  - Reverse earned FFM credit on cancellation where applicable
  - Keep operation idempotent

### 8) Seat Lock/Class Validation Hardening (Change 6)

- In `server/routes/flights.js` seat lock endpoint:
  - Validate requested class-seat consistency when class is provided
  - Return clear validation error if mismatch

## Dev 1 (Backend/Auth)

### 9) Email Change Policy Hardening (Change 10)

- In `server/routes/me.js` (`PATCH /api/me`):
  - Either block direct email changes
  - Or require verification workflow before persisting

### 10) Ban/Role Contract Review (Changes 1 and 2)

- Ensure `GET /api/auth/me` response has all frontend-required fields for:
  - ban handling UX
  - role-specific shells (customer/admin/attendant/root)

## Definition of Done

1. Sidebar is visible on authenticated desktop pages and shows upcoming flight + FFM.
2. `/checkin` flow works end-to-end with proper redirect behavior from ticket page.
3. Booking submits class/extras/FFM fields and backend totals reconcile.
4. Baggage pricing in UI comes from per-flight API data, not hardcoded values.
5. 36-hour booking rule is consistent in backend and frontend.
6. FFM balances reconcile correctly after booking and cancellation.
7. Error UX is clear for restricted airline, too-close booking, and insufficient FFM.

## Suggested Execution Order

1. Dev 3: Sidebar + 36-hour UI alignment + dynamic baggage
2. Dev 2: Check-in eligibility endpoint + ticket flags
3. Dev 3: Check-in page/route + ticket redirect flow
4. Dev 3 + Dev 2: seatClass/extras/FFM booking contract completion
5. Dev 2: FFM cancellation reconciliation hardening
6. Dev 1: email-change policy and auth contract final pass
