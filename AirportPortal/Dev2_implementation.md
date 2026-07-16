# Dev 2 Implementation Plan (V2 Flights, Booking, FFM, Check-in)

## Scope
Backend ownership for V2 flight parsing, booking engine updates, seat class pricing, dynamic baggage, extras, FFM accounting, check-in, attendant ticket operations, and integration test coverage.

## Dependency Contract

### Start Gate (hard blocker)
Do not begin Dev 2 implementation until Dev 1 completes:
- T-1 (V2 API client)
- T-2 (schema migration)
- T-3 (email auth)

### Additional External Gates
- T-16 attendant ticket creation also requires Dev 1 T-6.
- T-21 attendant ticket list depends on T-16 and Dev 1 security completion gate (T-8).

### Outgoing Dependencies for Dev 3
- T-10 unblocks flights UI.
- T-11 unblocks seat map behavior.
- T-13 and T-15 unblock booking baggage/extras flow.
- T-12 unblocks FFM display.
- T-18 and T-19 unblock check-in UI.
- T-21 unblocks attendant dashboard data tables.

## Execution Rules
- Respect the foundation chain T-9 -> T-10 before downstream booking features.
- Do not start T-15 until T-12, T-13, and T-14 are complete.
- Keep response contracts stable once handed to Dev 3.

## Ordered Implementation Plan

### Phase 1: Flight Data Foundation
1. T-9 Sync and persist V2 flight schema fields.
2. T-10 Expand flights endpoint payload and enforce 36-hour visibility behavior.

### Phase 2: Booking Core and Pricing
1. T-11 Seat class pricing and seat lock handling. Depends on T-10.
2. T-13 Dynamic baggage pricing from V2 data. Depends on T-10.
3. T-14 Backend booking validation for 36-hour rule. Depends on T-10.
4. T-12 FFM account endpoints and accounting foundations. Depends on Dev 1 T-2 and T-3.
5. T-15 Booking extras and mixed payment orchestration. Depends on T-12, T-13, T-14.
6. T-17 Mixed payment verification hardening. Depends on T-15.

Parallel guidance in Phase 2:
- T-11, T-13, and T-14 may run in parallel after T-10.
- T-12 may run in parallel with T-11/T-13/T-14 once Dev 1 T-2/T-3 are complete.

### Phase 3: Check-in and Ticket Lifecycle
1. T-18 Check-in endpoint and eligibility rules. Depends on T-10.
2. T-19 Ticket lookup includes check-in eligibility. Depends on T-18.
3. T-24 Cancellation flow with FFM refund/reversal and idempotency. Depends on T-18 and should integrate T-12 accounting rules.

### Phase 4: Attendant Features
1. T-16 Attendant ticket creation for assigned airline only. Depends on Dev 1 T-6 and T-15.
2. T-21 Attendant paginated ticket list and search/sort. Depends on T-16 and Dev 1 T-8.

### Phase 5: Jobs and Quality Gate
1. T-22 Expired seat lock cleanup every 10 seconds. Depends on T-11.
2. T-33 Full unit, integration, and cross-team scenarios. Depends on completion of all above tasks.

## Handoff Milestones to Dev 3

### Handoff A: Flights UX Enablement
Required complete tasks: T-10.
Deliver:
- Stable flights response containing seat classes, baggage summary, extras, and ffmCredit.
- 36-hour rule semantics documented for UI disabled states.

### Handoff B: Booking UX Enablement
Required complete tasks: T-11, T-13, T-15.
Deliver:
- Seat availability and lock APIs.
- Baggage endpoint and dynamic pricing behavior.
- Booking payload and error contracts for extras/mixed payment.

### Handoff C: Check-in UX Enablement
Required complete tasks: T-18 and T-19.
Deliver:
- Check-in submission contract.
- Lookup payload with checkinEligible and availableAt semantics.

### Handoff D: Attendant UX Enablement
Required complete tasks: T-21.
Deliver:
- Paginated attendant ticket list schema.
- Sorting and filtering parameter contract.

## Contract Freeze List
- Booking rejection codes/messages:
  - BOOKING_TOO_CLOSE
  - AIRLINE_RESTRICTED
  - CUSTOMER_BANNED
  - Insufficient FFM and insufficient payment payload shapes
- Check-in behavioral responses:
  - Not yet eligible response with availableAt
  - Already checked-in redirect semantics
- FFM fields:
  - ffmBalance
  - lifetimeEarned
  - lifetimeSpent

## Verification Checklist
- Backend tests pass per phase before moving forward.
- FFM accounting reconciles on purchase, mixed payment, and cancellation.
- Seat locks are released by user action and by background expiration.
- All attendant endpoints enforce airline scope and role checks.

## Completion Definition
Dev 2 is complete when T-9 through T-22 and T-24, T-33 are merged with passing tests and all four handoff milestones delivered to Dev 3 in stable form.