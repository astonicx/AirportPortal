# Server Security Audit (V2 Auth and Policy)

## Scope
This document captures security assumptions and verification points for the V2 migration:
- API client V2 migration and bearer handling
- Email-based auth
- Ban and restriction enforcement
- Attendant role scaffolding

## Verified Controls

### 1. SQL query safety
- Auth, booking, and admin route queries are parameterized.
- No user-controlled SQL string concatenation is used in core auth/booking paths.

### 2. Bearer token protection
- Bearer token is injected server-side only by the API client.
- API logging is method/path/status only in non-production mode.
- Authorization header values are not logged.

### 3. Ban enforcement
- Login blocks banned users with `Account banned`.
- Mid-session ban is enforced by global `requireNotBanned` middleware.
- Enforced response: `401` with account-banned message and logout cookie clear.
- Booking route hard-blocks banned authenticated users with:
  - `code: CUSTOMER_BANNED`
  - `status: 403`

### 4. Airline restriction enforcement
- Admin CRUD endpoints use `airline_restrictions` table.
- Booking route checks customer restriction by `user_id + airline`.
- Enforced response:
  - `code: AIRLINE_RESTRICTED`
  - `status: 403`

### 5. Email uniqueness and auth identity
- Email remains the login identity key.
- Signup handles duplicate-email collisions via `409` response.
- Login no longer depends on name disambiguators.

### 6. Role-based recovery policy
- Password recovery init uses email lookup.
- Recovery is customer-only.
- Explicit denials:
  - Admin/root: `Admins cannot use password recovery`
  - Attendant: `Attendants cannot use password recovery`

### 7. Attendant scaffolding guardrails
- Attendants are root-managed via admin endpoints.
- `requireAttendant` middleware enforces role and assignment presence.
- Airline assignment is carried in request context for attendant-only route scoping.

## Remaining Hardening Follow-ups
- Add dedicated tests for:
  - mid-session ban enforcement path
  - airline restriction enforcement responses
  - attendant role guard and assignment checks
- Expand security audit automation with grep-based SQL safety checks in CI.
