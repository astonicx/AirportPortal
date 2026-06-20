# Frontend Component Testing

This directory contains comprehensive component tests for the React/Vite frontend using React Testing Library and MSW (Mock Service Worker) for API mocking.

## Test Architecture

### Testing Stack

- **Vitest**: Fast unit and integration test runner with jsdom
- **React Testing Library**: User-centric testing utilities
- **MSW (Mock Service Worker)**: Network mocking at the service worker level
- **User Event**: High-level user interaction simulation

### Test Organization

```
tests/frontend/
├── Login.test.jsx              # Authentication page tests
├── Signup.test.jsx             # Registration page tests
├── Flights.test.jsx            # Flight listing page tests
├── Dashboard.test.jsx          # Customer dashboard tests
├── AdminDashboard.test.jsx     # Admin management tests
└── BookingWorkflow.test.jsx    # Multi-step booking flow tests

tests/setup/
├── frontend.setup.js           # Jest DOM setup and MSW initialization
└── msw/
    ├── frontend-handlers.js    # All API mock handlers
    └── frontend-server.js      # MSW server instance

tests/helpers/frontend/
└── renderWithProviders.jsx     # Custom render with Router and Auth providers
```

## Test Coverage

### Authentication (Login/Signup)

**Login Tests (Login.test.jsx)**
- ✅ Form rendering (email, password, captcha, remember me)
- ✅ Input validation (required fields, email format)
- ✅ Loading states (button disabled during submission)
- ✅ Error states (invalid credentials, server errors, captcha failures)
- ✅ Successful submission (redirect to dashboard)
- ✅ Navigation links (forgot password, create account)

**Signup Tests (Signup.test.jsx)**
- ✅ Form rendering (all required and optional fields)
- ✅ Security questions selection
- ✅ Password strength validation
- ✅ Address field optionality
- ✅ Error handling (email already exists, captcha errors)
- ✅ Field population and submission
- ✅ Success redirect to login

### Customer Workflows

**Flights Page (Flights.test.jsx)**
- ✅ Flight list rendering with all columns
- ✅ Departure/arrival filtering
- ✅ Search functionality
- ✅ Sorting by different fields
- ✅ Sort direction toggle
- ✅ Pagination controls and navigation
- ✅ Empty state when no flights match
- ✅ Error handling (network failures, 500 errors)
- ✅ Detail links for each flight

**Dashboard (Dashboard.test.jsx)**
- ✅ Welcome message with user's first name
- ✅ Last login information display
- ✅ Upcoming tickets section
- ✅ Past tickets section
- ✅ Empty state handling (no tickets)
- ✅ Ticket detail navigation links
- ✅ Multiple tickets display
- ✅ Missing data fallback (—)
- ✅ Error states (server errors, unauthorized)

### Admin Workflows

**Admin Dashboard (AdminDashboard.test.jsx)**
- ✅ Customer list display
- ✅ Customer details (name, email)
- ✅ Ticket management list
- ✅ Ticket status display
- ✅ Seat information
- ✅ Empty states (no customers/tickets)
- ✅ Multiple items handling
- ✅ Error handling and loading states
- ✅ Forbidden access handling

### Booking Workflow

**Booking Pages (BookingWorkflow.test.jsx)**
- ✅ Seat selection (availability, disabled taken seats)
- ✅ Seat locking mechanism
- ✅ Passenger information form validation
- ✅ Gender and date of birth selection
- ✅ Payment review and summary
- ✅ Payment processing with loading state
- ✅ Error handling at each step
- ✅ Full workflow integration

## Running Tests

### Run all frontend tests

```bash
npm run test:frontend
```

### Watch mode (rerun on file changes)

```bash
npm run test:frontend:watch
```

### Coverage report

```bash
npm run test:coverage:frontend
```

### Run specific test file

```bash
npm run test:frontend -- tests/frontend/Login.test.jsx
```

### Run tests matching pattern

```bash
npm run test:frontend -- --grep "Login"
```

## Test Structure

### Example Test File

```javascript
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyComponent from "@/pages/MyComponent";
import { renderWithProviders } from "../../helpers/frontend/renderWithProviders";
import { frontendServer, errorHandlers } from "../../setup/msw/frontend-server";

describe("My Component", () => {
    describe("Rendering", () => {
        it("renders main heading", () => {
            renderWithProviders(<MyComponent />);
            expect(screen.getByText("My Component")).toBeInTheDocument();
        });
    });

    describe("Loading States", () => {
        it("shows spinner while loading", () => {
            renderWithProviders(<MyComponent />);
            // Test loading UI
        });
    });

    describe("Error States", () => {
        it("displays error message on failure", async () => {
            frontendServer.use(errorHandlers.serverError[0]);
            renderWithProviders(<MyComponent />);
            
            await waitFor(() => {
                expect(screen.getByText(/error/i)).toBeInTheDocument();
            });
        });
    });

    describe("User Interactions", () => {
        it("handles user input", async () => {
            const user = userEvent.setup();
            renderWithProviders(<MyComponent />);
            
            const input = screen.getByLabelText("Name");
            await user.type(input, "John");
            
            expect(input).toHaveValue("John");
        });
    });
});
```

## Using renderWithProviders

The `renderWithProviders` helper includes all required context providers:

- **MemoryRouter**: For client-side routing (testing different routes)
- **AuthProvider**: For authentication context

```javascript
// Default route (/)
renderWithProviders(<MyComponent />);

// Custom route
renderWithProviders(<MyComponent />, { route: "/flights" });

// With initial auth state (optional, for future use)
renderWithProviders(<MyComponent />, {
    route: "/dashboard",
    initialAuth: { user: { id: 1, email: "test@example.com" } },
});
```

## API Mocking with MSW

### Using Success Handlers (Default)

All tests automatically use success handlers unless overridden:

```javascript
// This test uses default success handlers
it("loads data successfully", async () => {
    renderWithProviders(<MyComponent />);
    
    await waitFor(() => {
        expect(screen.getByText("Data loaded")).toBeInTheDocument();
    });
});
```

### Overriding Handlers for Error Scenarios

```javascript
import { frontendServer, errorHandlers } from "../../setup/msw/frontend-server";

it("shows error on server failure", async () => {
    // Override default handler with error handler
    frontendServer.use(errorHandlers.serverError[0]);
    
    renderWithProviders(<MyComponent />);
    
    await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
});
```

### Creating Custom Handlers

```javascript
import { http, HttpResponse } from "msw";

it("handles custom scenario", async () => {
    frontendServer.use(
        http.get("*/api/endpoint", ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get("search") === "empty") {
                return HttpResponse.json({ items: [] });
            }
            return HttpResponse.json({ items: [...] });
        })
    );
    
    renderWithProviders(<MyComponent />);
    // Test custom behavior
});
```

## Best Practices

### 1. Test User Behavior, Not Implementation

✅ **Good**: User types into field and clicks button
```javascript
await user.type(input, "text");
await user.click(button);
```

❌ **Bad**: Directly calling component methods or manipulating state

### 2. Use Semantic Queries

✅ **Good**: Find by label, role, text
```javascript
screen.getByLabelText("Email")
screen.getByRole("button", { name: /submit/i })
screen.getByText("Loading...")
```

❌ **Bad**: Find by test ID only, find by CSS selectors
```javascript
screen.getByTestId("email-input")
screen.querySelector(".submit-btn")
```

### 3. Await Async Operations

✅ **Good**: Wait for async operations
```javascript
await waitFor(() => {
    expect(screen.getByText("Loaded")).toBeInTheDocument();
});
```

❌ **Bad**: Assume immediate rendering
```javascript
expect(screen.getByText("Loaded")).toBeInTheDocument(); // May fail
```

### 4. Mock External APIs, Not Components

✅ **Good**: Mock API responses with MSW
```javascript
frontendServer.use(errorHandlers.serverError[0]);
```

❌ **Bad**: Mock components or functions
```javascript
vi.mock("@/lib/api"); // Avoid this
```

### 5. Test User Workflows

✅ **Good**: Test multiple steps together
```javascript
// Fill form
// Submit
// Wait for redirect
```

❌ **Bad**: Only test individual elements in isolation

## Fixtures and Test Data

### Available Fixtures

All fixtures are in `tests/setup/msw/frontend-handlers.js`:

- `fixtureUser`: Standard customer user
- `fixtureAdminUser`: Admin user
- `fixtureDashboard`: Dashboard data with upcoming/past tickets
- `fixtureFlights`: Flight list with pagination
- `fixtureFlightDetail`: Single flight details
- `fixtureSeats`: Seat availability map
- `fixtureTickets`: Ticket information

### Creating Custom Fixtures

```javascript
const customUser = {
    id: 1,
    email: "custom@example.com",
    first_name: "Custom",
    last_name: "User",
    type: "customer",
};

frontendServer.use(
    http.get("*/api/auth/me", () => {
        return HttpResponse.json(customUser);
    })
);
```

## Error Handler Reference

| Handler | Endpoint | Status | Usage |
|---------|----------|--------|-------|
| `unauthorized` | `/api/auth/me` | 401 | Test 401 Unauthorized |
| `forbidden` | `/api/admin/dashboard` | 403 | Test 403 Forbidden |
| `notFound` | `/api/flights/:id` | 404 | Test 404 Not Found |
| `serverError` | `/api/me/dashboard` | 500 | Test 500 Server Error |
| `validationError` | `/api/bookings` | 400 | Test 400 Bad Request |

## Debugging Tests

### View DOM Elements

```javascript
import { screen } from "@testing-library/react";

// Print all text in document
screen.debug();

// Print specific element
screen.debug(screen.getByText("Button"));
```

### Verbose Output

```bash
npm run test:frontend -- --reporter=verbose
```

### Run Single Test

```bash
npm run test:frontend -- tests/frontend/Login.test.jsx --reporter=verbose
```

## Integration with CI/CD

Frontend tests are part of the main test suite:

```bash
npm test  # Runs both backend and frontend tests
```

All frontend tests must pass before deployment. Tests are designed to be:
- **Fast**: Average ~50ms per test
- **Reliable**: No flaky assertions
- **Isolated**: Each test is independent
- **CI-safe**: No external API calls, deterministic data

## Common Issues & Solutions

### Issue: "waitFor timeout" on async operations

**Solution**: Increase timeout or verify async operation completes

```javascript
await waitFor(() => {
    expect(screen.getByText("Loaded")).toBeInTheDocument();
}, { timeout: 3000 });
```

### Issue: "screen.getByText not found"

**Solution**: Use `queryBy` to check if element exists, or wait with `waitFor`

```javascript
expect(screen.queryByText("Not loaded yet")).not.toBeInTheDocument();

await waitFor(() => {
    expect(screen.getByText("Now loaded")).toBeInTheDocument();
});
```

### Issue: User event not triggering handler

**Solution**: Ensure `await` is used and element is not disabled

```javascript
const user = userEvent.setup();
const input = screen.getByLabelText("Email");

// Wait for input to be ready
await waitFor(() => {
    expect(input).not.toBeDisabled();
});

await user.type(input, "test@example.com");
```

### Issue: MSW handler not being used

**Solution**: Verify handler URL matches exactly

```javascript
// ✅ Correct
http.get("*/api/flights", () => ...)

// ❌ Wrong (missing wildcard)
http.get("/api/flights", () => ...)
```

## Contributing New Tests

When adding new component tests:

1. Create test file in `tests/frontend/`
2. Include describe blocks for: Rendering, Validation, Loading States, Error States, User Interactions
3. Use `renderWithProviders` for all component renders
4. Override MSW handlers for error scenarios
5. Test both happy paths and error cases
6. Run tests locally before committing

```bash
npm run test:frontend:watch
```

All components should have >80% test coverage.
