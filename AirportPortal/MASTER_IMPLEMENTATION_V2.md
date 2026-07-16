# Master Implementation Plan (V2)

## Purpose
This document is the single dependency-safe execution plan for the V2 changes.
It coordinates Dev 1, Dev 2, and Dev 3 work so no team begins blocked tasks.

## Hard Dependency Gates

1. Gate A (Program start)
- Dev 1 begins T-1, T-2, T-3 in order.
- Dev 2 and Dev 3 do not start implementation work before this gate clears.

2. Gate B (Auth foundation complete)
- Required: Dev 1 T-1, T-2, T-3 complete.
- Unblocks Dev 2 core backend track and Dev 3 auth UI track.

3. Gate C (Role and enforcement)
- Required: Dev 1 T-4 and T-6 complete.
- Unblocks ban UX and attendant features.

4. Gate D (Flight response contract)
- Required: Dev 2 T-10 complete.
- Unblocks Dev 3 flights UI and sidebar data integration.

5. Gate E (Booking contract)
- Required: Dev 2 T-11, T-13, T-15 complete.
- Unblocks Dev 3 seat map and full booking flow.

6. Gate F (Check-in contract)
- Required: Dev 2 T-18 and T-19 complete.
- Unblocks Dev 3 check-in UX.

7. Gate G (Attendant data contract)
- Required: Dev 2 T-21 complete and Dev 1 T-6 complete.
- Unblocks Dev 3 attendant dashboard.

## Program Sequence

### Phase 1: Foundation
- Dev 1: T-1 -> T-2 -> T-3

### Phase 2: Policy and role scaffolding
- Dev 1: T-4, T-5, T-6
- Dev 2: T-9 can begin after Gate B
- Dev 3: T-23, T-24, T-14(frontend) can begin after Gate B

### Phase 3: Core booking backend
- Dev 2: T-10, T-11, T-12, T-13, T-14, T-15, T-17, T-22
- Dev 3: T-18 flights page after Gate D
- Dev 3: T-26 and T-27 after Gate E

### Phase 4: Ticket lifecycle and check-in
- Dev 2: T-16, T-18, T-19, T-24, T-21
- Dev 3: T-28 after Gate F
- Dev 3: T-29 after Dev 2 T-12
- Dev 3: T-25 after Gate D
- Dev 3: T-32 after Gate G

### Phase 5: Quality and release readiness
- Dev 1: T-8 security audit finalization
- Dev 2: T-33 test suite integration
- Dev 3: T-34 E2E and responsive QA

## Cross-Team Handoff Checklist

### Dev 1 -> Dev 2
- V2 client is stable and bearer token handling is server-only.
- Migration applied and idempotent.
- Email auth responses are finalized.

### Dev 1 -> Dev 3
- Email login/signup/recover request and response shapes finalized.
- Ban behavior and user role values finalized.

### Dev 2 -> Dev 3
- Flights payload and 36-hour semantics finalized.
- Seat lock, baggage pricing, extras, and booking errors finalized.
- Check-in eligibility and submission contracts finalized.
- Attendant list/search payloads finalized.

## Contract Freeze (Do Not Drift)
- User roles: guest, customer, admin, attendant, root
- Booking restriction codes:
  - BOOKING_TOO_CLOSE
  - CUSTOMER_BANNED
  - AIRLINE_RESTRICTED
- FFM fields:
  - ffmBalance
  - lifetimeEarned
  - lifetimeSpent
- Check-in fields:
  - checkinEligible
  - availableAt

## Definition of Program Complete
All Dev 1, Dev 2, and Dev 3 implementation plans are complete with tests and QA gates passed:
- Dev 1: T-1 through T-8
- Dev 2: T-9 through T-22 plus T-24 and T-33
- Dev 3: T-23, T-24, T-14(frontend), T-30, T-31, T-18, T-26, T-27, T-28, T-29, T-25, T-32, T-34
