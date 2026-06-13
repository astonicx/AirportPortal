# AirportPortal Test Suite Review and Future Enhancement Guide

## Executive Summary

Current test extension speed is moderate.

- Best case for adding a new requirement with tests: about 3 to 5 hours.
- Typical current case: about 6 to 10 hours.
- Main blockers: assertion-light frontend tests, duplicated setup patterns, and hardcoded E2E seed expectations.

The suite has strong foundations (MSW, route harness, layered tests), but adding competition requirements quickly will benefit from standard templates and helper extraction.

---

## 1) Testing Extension Checklist

Use this checklist whenever a new competition requirement is added.

### Requirement framing

- Define requirement type: UI only, route only, API integration, or full workflow.
- Write acceptance criteria in Given/When/Then format.
- Identify role matrix impacted: guest, customer, admin, root.
- Identify data states impacted: empty, populated, malformed, upstream failure.

### Coverage plan

- Add or update unit tests for pure logic and validation helpers.
- Add or update route integration tests for auth, validation, happy path, errors.
- Add or update frontend component tests for rendering, interaction, and failure states.
- Add or update E2E for at least one end-to-end user journey.

### Test data and mocks

- Reuse existing fixture patterns and keep schema aligned with route responses.
- Add MSW handlers for each new endpoint and error mode.
- Avoid hardcoded IDs in assertions unless deterministic seed guarantees them.
- Confirm fallback behavior for 429, 500, timeout, and network failure where relevant.

### Quality gates

- Ensure each new test has behavioral assertions, not only existence checks.
- Ensure unauthorized and forbidden access are tested where applicable.
- Ensure one negative validation case per required input field.
- Ensure one resiliency case (timeout, malformed payload, or upstream error) for API-dependent features.

### CI and maintainability

- Keep duplicate setup under control: extract helpers if repeated more than 2 times.
- Keep fixture source centralized by domain.
- Name test blocks consistently by endpoint and behavior.
- Update testing docs when adding new reusable test helper patterns.

---

## 2) New Feature Testing Template

Copy this structure for any new feature.

Template name: feature-name.test.plan

1. Scope
- Requirement summary:
- User roles affected:
- Dependencies (routes, components, external API):

2. Unit tests
- Validation function returns expected issues.
- Pricing or transformation logic returns deterministic output.
- Edge inputs: null, empty strings, boundary numbers.

3. Route integration tests
- Unauthorized returns expected status.
- Role restrictions enforced.
- Request schema validation returns issues.
- Happy path response schema validated.
- Not found and conflict scenarios validated.
- Upstream failure fallback behavior validated.

4. Frontend component tests
- Page and controls render.
- Loading and empty states.
- User interaction path.
- Error display for server and validation failures.
- Navigation/redirect behavior.

5. E2E tests
- Primary role journey succeeds.
- Access control prevents invalid role journey.
- Error recovery path works.

6. Completion criteria
- Tests added at each required layer.
- No flaky timing assertions.
- No duplicated setup block over 20 lines without helper extraction.

---

## 3) Route Testing Template

Use this for each new endpoint.

Template name: routes.feature.test

Describe block naming:
- routes: /api/feature

Required test sections:

1. Authorization
- Missing auth header/cookie returns expected status.
- Wrong role returns expected status.
- Allowed role succeeds.

2. Validation
- Missing required field returns 400 with issues array.
- Invalid enum/type/value returns 400.
- Malformed payload type returns 400.

3. Happy path
- Returns expected status (200 or 201).
- Response contract fields exist and have expected types.
- Side effects persisted in database when applicable.

4. Error and edge handling
- Resource not found returns 404.
- Conflict returns 409 if domain supports conflicts.
- Upstream or dependency failure maps to expected status.

5. Method mismatch
- Unsupported method returns 404 or 405 according to app behavior.

---

## 4) Component Testing Template

Use this for React views and key components.

Template name: FeaturePage.test.jsx

Required test sections:

1. Rendering
- Heading and required controls render.
- Accessibility labels and role-based selectors exist.

2. Loading and empty
- Spinner or placeholder appears during fetch.
- Empty state messaging appears for no data.

3. Interaction
- User can input/select/click core controls.
- Submission invokes expected API call path.
- UI updates on success.

4. Error handling
- Validation error shown for invalid input.
- Server error shown for non-2xx responses.
- Unauthorized behavior matches route guard intent.

5. Navigation
- Links or redirects point to correct routes.

Selector guidance:
- Prefer role, label text, and visible text.
- Avoid direct document query selectors except for unavoidable legacy markup.

---

## 5) API Integration Testing Template

Use this for routes that call external systems.

Template name: routes.api-integration.feature.mocked.test

Required test sections:

1. Success path
- Upstream success returns normalized local response.

2. Upstream error mapping
- 400, 401, 403, 404, 429, 500, 503 each produce expected route behavior.

3. Retry and timeout
- Retryable status triggers retries.
- Timeout is handled and mapped correctly.

4. Fallback behavior
- Cache fallback works when upstream fails.
- Empty cache fallback behavior is explicit.

5. Malformed payloads
- Null, missing fields, and malformed data are handled gracefully.

6. Contract confidence
- Assert key schema fields, not only status code.

---

## 6) E2E Testing Template

Use this for requirement-level user journeys.

Template name: feature-workflow.spec

Required journeys:

1. Primary success journey
- Login or role setup.
- Navigate through UI flow.
- Confirm success state and resulting page.

2. Authorization journey
- Disallowed role redirected or blocked.

3. Failure journey
- Invalid data or mocked failure shows recoverable UX.

4. Determinism practices
- Use seeded users from fixtures.
- Avoid hardcoded text/IDs unless guaranteed by seed setup.
- Keep assertions focused on stable user-facing outcomes.

---

## Identified Issues

### Fragile tests

1. Captcha tests rely on direct DOM selection and implicit captcha values.
- tests/frontend/Login.test.jsx
- tests/frontend/Signup.test.jsx

2. Many frontend tests are assertion-light and can pass without exercising target behavior.
- tests/frontend/Login.test.jsx
- tests/frontend/Flights.test.jsx
- tests/frontend/BookingWorkflow.test.jsx

3. Booking workflow test file uses local mock components instead of testing production booking pages, reducing regression detection.
- tests/frontend/BookingWorkflow.test.jsx

4. E2E helpers depend on fixed seed strings and IDs, increasing brittleness when fixture text changes.
- tests/e2e/helpers/workflows.js

### Duplicated tests

1. Weak password/captcha submission flows are duplicated with similar setup and assertions.
- tests/frontend/Signup.test.jsx

2. Auth and role assertions overlap heavily across route suites.
- tests/integration/routes.auth.test.js
- tests/integration/authentication.comprehensive.test.js
- tests/integration/routes.admin.test.js

3. API integration and route-level API failure coverage partially overlap.
- tests/integration/routes.api-integration.mocked.test.mjs
- tests/integration/routes.flights-bookings-tickets-nofly.test.js

### Maintainability concerns

1. Large monolithic route test files increase change surface and review complexity.
- tests/integration/routes.admin.test.js
- tests/integration/routes.flights-bookings-tickets-nofly.test.js

2. Fixture and handler ownership is spread between frontend and backend mock trees, making schema drift easier.
- tests/setup/msw/frontend-handlers.js
- tests/setup/api-mocks/handlers.mjs

3. Mixed ESM/CJS test styles increase cognitive overhead in shared test utilities.
- tests/integration and tests/unit mixed imports/requires

### Refactoring opportunities

1. Extract common frontend form-action helpers.
- fill required fields
- satisfy captcha for tests
- submit and assert alert text

2. Create route assertion helpers.
- assertUnauthorized
- assertForbidden
- assertValidationIssueArray
- assertSchemaFieldTypes

3. Split large route suites by endpoint family and shared helper fixtures.

4. Replace hardcoded E2E constants with references from seeded fixture objects.

5. Introduce a single fixture domain map to reduce schema drift.

---

## Extension Speed Assessment

Current state: moderate speed.

- Fast additions are possible when requirements fit existing endpoints and views.
- Slower additions happen when tests require repeated setup and manual fixture tuning.

Estimated effort to add a typical new competition feature with complete testing:

- Current pattern: 6 to 10 hours.
- With helper/template refactor: 3 to 5 hours.

Primary bottlenecks:

- Repeated form setup in frontend tests.
- Repeated auth/role blocks in route tests.
- Hardcoded E2E expectations tied to current seed wording.
- Large test files that require broad edits for small features.

---

## Future Enhancement Roadmap

### Phase 1 (quick wins)

- Add reusable frontend action helpers for login/signup/booking setup.
- Add route assertion helper module for auth and validation boilerplate.
- Parameterize E2E assertions using seeded fixture fields.

Expected gain: 20% to 30% faster test authoring for new requirements.

### Phase 2 (structural)

- Split large route files by endpoint group.
- Consolidate fixtures into domain-based folders with shared types/shapes.
- Introduce common naming convention for describes and test titles.

Expected gain: 30% to 40% reduction in maintenance overhead.

### Phase 3 (quality hardening)

- Add assertion-quality lint rule or review checklist for no-op tests.
- Add flaky-test tracking in CI for retries and quarantine reporting.
- Add contract checks for key upstream payload fields.

Expected gain: improved reliability and lower regression risk for competition delivery.

---

## Recommended Definition of Done for New Competition Requirements

- Unit, route, component, and E2E coverage updated as applicable.
- At least one negative-path test per new input boundary.
- At least one resiliency test for external dependency behavior.
- No duplicated setup blocks over 20 lines without helper extraction.
- All test docs and templates updated when new testing pattern is introduced.
