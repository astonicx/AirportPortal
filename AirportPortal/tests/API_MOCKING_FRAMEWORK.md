# External API Mocking Framework

This project uses [MSW (Mock Service Worker)](https://mswjs.io/) to mock all external API calls, providing complete test isolation and predictable testing scenarios.

## Architecture

### External APIs

The application makes requests to BDPA (flight/booking/no-fly) endpoints:

- `GET /v1/flights/search` - Query available flights (with optional filters)
- `GET /v1/info/no-fly-list` - Fetch no-fly list entries
- `POST /v1/flights/:id/book` - Book a flight seat
- `DELETE /v1/tickets/:id` - Cancel a ticket

### Client Implementation

All external requests go through [server/utils/apiClient.js](../../server/utils/apiClient.js):

- Axios-based HTTP client
- Automatic Bearer token injection
- 15-second timeout
- Automatic retry on 555 status (up to 3 attempts with exponential backoff)
- Custom ApiError class for consistent error handling

### Test Mocking

MSW intercepts all external API calls at the network layer, providing:

1. **Mocked Tests** (default) - All tests use pre-configured mock responses
2. **Live Smoke Tests** (opt-in) - Optional real API calls against staging/dev endpoints
3. **Scenario Coverage** - Each test scenario has dedicated mock handlers

## Test Scenarios Covered

### Success Cases

- Standard GET, POST, PUT, PATCH, DELETE responses
- Paginated results
- Cached vs. fresh data
- Fallback to local cache when upstream fails

### API Errors (4xx/5xx)

- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 429 Rate Limit
- 500 Internal Server Error
- 503 Service Unavailable

### Network Issues

- Connection failures
- Timeout (15+ seconds)
- Network errors

### Malformed Data

- Empty payloads (null)
- Non-JSON responses
- Missing required fields
- Partial responses

## Test Organization

### Mocked Test Files

All tests in these files use MSW mocks and run in CI:

```
tests/unit/server/utils/apiClient.mocked.test.mjs
├── GET requests (success)
├── POST requests (success)
├── DELETE requests (success)
├── API error responses (4xx/5xx)
├── Retry logic (555 status)
├── Network failures
├── Timeout handling
├── Empty/malformed payloads
└── Authorization header verification

tests/integration/routes.api-integration.mocked.test.mjs
├── GET /api/flights (flights list)
├── GET /api/flights/:id (flight detail)
├── POST /api/no-fly/check (no-fly check)
├── POST /api/bookings (create booking)
├── Rate limit handling
└── Empty/malformed upstream responses
```

### Live Test Files

Tests that make real API calls (skipped in CI by default):

```
tests/integration/apiClient.live.test.mjs
├── Real GET /v1/flights/search
├── Real GET /v1/info/no-fly-list
├── Rate limit behavior
└── Timeout behavior
```

## Running Tests

### Mocked Tests (default, includes CI)

```bash
# Run all tests with mocks
npm run test:backend

# Run specific test file
npm run test:backend -- tests/unit/server/utils/apiClient.mocked.test.mjs

# Watch mode
npm run test:backend:watch
```

### Live Smoke Tests (manual only, never in CI)

```bash
# Test against dev/staging environment
SKIP_LIVE=1 BDPA_BASE_URL=https://dev-api.example.com BEARER_TOKEN=xxx npm run test:backend:live

# Note: Tests are skipped by default in CI and require explicit SKIP_LIVE=1 flag
```

## Mocking API in Your Tests

### Use Existing Handlers

For standard success scenarios, handlers are automatically set up:

```javascript
import { successHandlers } from "../../setup/api-mocks/handlers.mjs";
import { setupServer } from "msw/node";

const server = setupServer(...successHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Override for Specific Scenarios

```javascript
import { errorHandlers } from "../../setup/api-mocks/handlers.mjs";

it("handles rate limit error", async () => {
    server.use(...errorHandlers.rateLimit);
    // Test code
});
```

### Create Custom Handlers

```javascript
import { http, HttpResponse } from "msw";

const customHandler = http.get(
    `${BASE}/v1/flights/search`,
    () => {
        return HttpResponse.json(
            { error: "Custom error" },
            { status: 503 }
        );
    }
);

server.use(customHandler);
```

## Handler Reference

All handlers are in [tests/setup/api-mocks/handlers.mjs](../setup/api-mocks/handlers.mjs):

| Handler | Description |
|---------|-------------|
| `successHandlers` | Default success responses for all endpoints |
| `errorHandlers.badRequest` | 400 Bad Request |
| `errorHandlers.unauthorized` | 401 Unauthorized |
| `errorHandlers.forbidden` | 403 Forbidden |
| `errorHandlers.notFound` | 404 Not Found |
| `errorHandlers.rateLimit` | 429 Too Many Requests |
| `errorHandlers.serverError` | 500 Internal Server Error |
| `errorHandlers.serviceUnavailable` | 503 Service Unavailable |
| `errorHandlers.retryableError` | 555 Retryable (tests retry logic) |
| `networkFailureHandler` | Network connection error |
| `timeoutHandler` | Timeout (20+ seconds) |
| `emptyPayloadHandler` | Null response |
| `malformedPayloadHandler` | Non-JSON response |
| `missingFieldsHandler` | Partial/incomplete response |

## Fixture Data

Common response fixtures for mocking:

- `fixtureFlightList` - Sample list of flights
- `fixtureFlightSingle` - Single flight detail
- `fixtureNoFlyList` - No-fly list entries

## CI/CD Integration

All mocked tests run automatically in CI. Live tests are **always skipped** in CI:

```yaml
# In GitHub Actions or other CI systems
- name: Run backend tests
  run: npm run test:backend
  # Live tests automatically skipped (CI=true, SKIP_LIVE not set to 0)

- name: Smoke test live API (manual trigger only)
  if: github.event_name == 'workflow_dispatch'
  run: SKIP_LIVE=1 npm run test:backend:live
  env:
    BDPA_BASE_URL: ${{ secrets.STAGING_API_URL }}
    BEARER_TOKEN: ${{ secrets.STAGING_API_TOKEN }}
```

## Best Practices

1. **Always mock in tests** - Use MSW for predictable, fast test execution
2. **Separate mocked vs. live** - Keep `.mocked.test.mjs` and `.live.test.mjs` files separate
3. **Test all scenarios** - Success, errors, timeouts, network failures
4. **Use fixtures** - Reuse common response data across tests
5. **Don't modify production code** - Mocking happens at test setup time
6. **Document new handlers** - Update this file when adding new mock scenarios

## Troubleshooting

### Tests fail with "unhandled request"

MSW is blocking a request that wasn't mocked. Either:

1. Add a handler for the endpoint
2. Use `server.use()` to override with a handler
3. Check environment variables (BDPA_BASE_URL, BEARER_TOKEN)

### Live tests don't run

Check that `SKIP_LIVE=1` is set and required env vars are provided:

```bash
SKIP_LIVE=1 BDPA_BASE_URL=... BEARER_TOKEN=... npm run test:backend:live
```

### Timeout tests take too long

The timeout scenario sleeps for 20 seconds. Run it separately if needed:

```bash
npm run test:backend -- --grep "timeout"
```
