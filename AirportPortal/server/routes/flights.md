# Flights API V1 to V2 Migration Notes

## Upstream Base URL
- Old: https://airports.api.hscc.bdpa.org/v1
- New: https://airports.api.hscc.bdpa.org/v2

The server now defaults to the V2 API base URL.
If BDPA_BASE_URL is set explicitly, it is used as-is.

## Security Notes
- Bearer token is injected server-side only through Authorization header.
- Dev logging records method, path, and status only.
- Bearer token is never printed in request or response logs.

## Runtime Route Updates
- flights search and detail upstream calls moved from /v1/... to /v2/...
- bookings upstream calls moved from /v1/... to /v2/...
- no-fly upstream calls moved from /v1/... to /v2/...
- ticket cancellation upstream calls moved from /v1/... to /v2/...
- flight sync job moved from /v1/... to /v2/...

## Retry Behavior
- HTTP 555 responses use exponential backoff retry.
- Retries are bounded and return a structured upstream error on exhaustion.
