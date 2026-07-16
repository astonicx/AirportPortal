# Dev 3 Implementation Plan (Frontend, Dashboards, UX)

## Scope
Frontend ownership for email-based auth UX, V2 flight browsing, booking flow with seat classes/bags/extras/FFM, check-in UX, persistent sidebar, attendant dashboard, and responsive/accessibility validation.

## Dependency Contract

### External Gates from Dev 1
- T-23, T-24, and frontend auth-context update cannot start until Dev 1 T-3 is complete.
- T-30 ban handling cannot start until Dev 1 T-4 is complete.
- T-32 attendant dashboard cannot start until Dev 1 T-6 is complete.

### External Gates from Dev 2
- T-18 flights page depends on Dev 2 T-10.
- T-26 seat map depends on Dev 2 T-11 and T-15.
- T-27 booking steps depend on Dev 2 T-13 and T-15 (plus seat-map integration from T-26).
- T-28 check-in page depends on Dev 2 T-18 and T-19.
- T-29 FFM display depends on Dev 2 T-12.
- T-31 airline restriction UX depends on restriction enforcement availability plus booking errors from Dev 2 T-15.
- T-32 attendant dashboard data flows depend on Dev 2 attendant endpoints (including T-21).

## Execution Rules
- Build only what upstream contracts support; do not assume unfinished API fields.
- Freeze UI error handling strings to match backend error codes once confirmed.
- Prioritize route guards and auth state correctness before feature pages.

## Ordered Implementation Plan

### Phase 1: Auth Migration UI
1. T-23 Replace login with email + password + remember me. Depends on Dev 1 T-3.
2. T-24 Update signup for required email and optional names. Depends on Dev 1 T-3.
3. T-14 frontend half: update auth context and protected routes to email identity. Depends on Dev 1 T-3.

Parallel guidance in Phase 1:
- T-23, T-24, and auth-context refactor may run in parallel once Dev 1 T-3 is done.

### Phase 2: Access Restriction UX
1. T-30 Ban detection and forced logout modal flow. Depends on Dev 1 T-4.
2. T-31 Airline restriction booking error handling. Depends on backend booking error contract availability.

### Phase 3: Flight Discovery and Booking UX
1. T-18 Flights view for V2 fields and 36-hour bookability indicators. Depends on Dev 2 T-10.
2. T-26 Seat map with class colors, lock/unlock, and live updates. Depends on Dev 2 T-11 and T-15.
3. T-27 Multi-step booking flow with bags, extras, review, and confirm. Depends on Dev 2 T-13 and T-15; integrate T-26 seat map.

### Phase 4: Check-in and FFM Surfaces
1. T-28 Guest and customer check-in UX. Depends on Dev 2 T-18 and T-19.
2. T-29 FFM balance display across dashboard, review, and sidebar. Depends on Dev 2 T-12.

### Phase 5: Persistent Sidebar and Attendant Portal
1. T-25 Persistent upcoming-flight sidebar and mobile drawer. Depends on Dev 2 T-10 for data shape.
2. T-32 Attendant dashboard tabs and data actions. Depends on Dev 1 T-6 and Dev 2 attendant endpoints including T-21.

### Phase 6: End-to-End QA and Responsiveness
1. T-34 E2E path validation, accessibility checks, and responsive QA. Depends on completion of all prior phases.

## Handoff and Integration Checkpoints

### Checkpoint A: Auth Ready
Required complete tasks: T-23, T-24, T-14(frontend).
Deliver:
- Email auth forms and auth state fully migrated.
- No remaining disambiguator or name-based login UX.

### Checkpoint B: Booking Ready
Required complete tasks: T-18, T-26, T-27, T-31.
Deliver:
- Flights browsing with V2 metadata.
- End-to-end booking UI with backend-aligned validation errors.

### Checkpoint C: Operations Ready
Required complete tasks: T-28, T-29, T-25, T-32.
Deliver:
- Check-in experiences for guest and logged-in users.
- Sidebar and attendant workflows.

## UI Contract Freeze List
- Booking-related error messages must align with backend codes:
  - BOOKING_TOO_CLOSE
  - AIRLINE_RESTRICTED
  - CUSTOMER_BANNED
  - Insufficient FFM
  - Insufficient payment
- Ban modal message content must use backend ban reason when provided.
- Flight bookability states must reflect backend 36-hour validation, not UI-only assumptions.

## Verification Checklist
- Manual path checks for each phase before progressing.
- Mobile-first behavior verified for forms, tables/cards, and seat-map interactions.
- Keyboard navigation and label coverage on all forms.
- No console errors during happy path and expected error path scenarios.

## Completion Definition
Dev 3 is complete when T-23, T-24, T-14(frontend), T-30, T-31, T-18, T-26, T-27, T-28, T-29, T-25, T-32, and T-34 are delivered with dependency gates respected and integration flows validated.