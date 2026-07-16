# Dev 1 Implementation Plan (V2 Changes)

## Scope
Backend ownership for V2 API integration, auth migration to email, schema expansion, customer restrictions, attendant role scaffolding, and security hardening.

## Dependency Contract

### Incoming Dependencies
- None for T-1.

### Outgoing Dependencies
- Dev 2 may start booking work only after T-1, T-2, and T-3 are complete.
- Dev 3 may start auth UI work after T-3 is complete.
- Dev 3 may start ban UX work after T-4 is complete.
- Dev 2 and Dev 3 attendant features depend on T-6.

## Execution Rules
- Do not start a task until all listed dependencies are complete and merged.
- Treat T-1, T-2, T-3 as the foundation gate for the rest of the program.
- Keep API response shapes stable once published to unblock frontend integration.

## Ordered Implementation Plan

### Phase 1: Foundation Gate (must be sequential)
1. T-1 Update API client for V2 and bearer token.
2. T-2 Run schema expansion migration for V2 entities and fields.
3. T-3 Migrate auth flows to email-based login/signup/recovery.

### Phase 2: Access Control and Role Expansion
1. T-4 Customer ban and unban endpoints plus enforcement middleware. Depends on T-3.
2. T-5 Airline-specific restriction endpoints and booking enforcement. Depends on T-2.
3. T-6 Attendant user type and assignment scaffolding. Depends on T-3.

Parallel guidance in Phase 2:
- T-5 can run in parallel with T-4 and T-6 once T-2 is complete.
- T-4 and T-6 can run in parallel once T-3 is complete.

### Phase 3: Recovery Policy and Security Audit
1. T-7 Finalize recovery policy by role restrictions (customer allowed, admin/root/attendant denied). Depends on T-3 and T-6.
2. T-8 End-to-end security audit and documentation. Depends on T-3, T-4, T-5, T-6, and T-7.

## Delivery Gates for Cross-Team Handoffs

### Handoff A (to Dev 2)
Required complete tasks: T-1, T-2, T-3.
Deliver:
- Confirmed V2 upstream client and bearer token behavior.
- Applied migration and verified new schema is available.
- Email-based auth endpoints and response contracts.

### Handoff B (to Dev 3)
Required complete tasks: T-3.
Deliver:
- Login/signup/recovery payload contracts using email.
- Auth me response including email and user_type.

### Handoff C (to Dev 2 and Dev 3)
Required complete tasks: T-4 and T-6.
Deliver:
- Ban enforcement behavior and error codes/messages.
- Attendant role and assignment validation contract.

## API and Data Contracts to Freeze
- Auth login key is email only. No disambiguator support.
- Ban errors:
  - Login rejection for banned users.
  - Protected-route rejection when banned mid-session.
- Booking enforcement codes:
  - CUSTOMER_BANNED
  - AIRLINE_RESTRICTED
- User role values: guest, customer, admin, attendant, root.

## Verification Checklist
- Backend tests pass after each phase.
- Migration is idempotent and FK constraints are active.
- No bearer token is exposed in logs or client responses.
- All SQL for new auth and restriction paths is parameterized.

## Completion Definition
Dev 1 is complete when T-1 through T-8 are merged, documented, and all dependency handoff contracts are available to Dev 2 and Dev 3 without blocking clarifications.