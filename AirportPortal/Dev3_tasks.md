# Developer 3 — Frontend, Dashboards & UX

**Focus:** React app shell, Tailwind theme, auth UI, flights UI, booking wizard UI, customer/admin dashboards, async live updates, responsive QA.
**Parallelism note:** Tasks 5–6 unblock other frontend tasks. Auth UI (12–14) can start once Dev 1 finishes Tasks 9/11. Booking UI (25–27) needs Dev 2's seat + booking endpoints.

---

## Task 5 — Frontend app shell & routing
Dependencies: Task 1 (Dev 1)
Expected Output:
- `react-router-dom` installed; routes wired in [src/App.jsx](src/App.jsx): `/`, `/flights`, `/flights/:id`, `/book/:flightId`, `/ticket/:confirmation`, `/ticket-lookup`, `/login`, `/signup`, `/recover`, `/dashboard`, `/dashboard/settings`, `/admin`, `/admin/customers`, `/admin/tickets`, `/admin/admins`, `*`(404).
- Layout component (Header with auth state, Footer, Container).
- Placeholder pages render.

## Task 6 — Tailwind theme & base UI integration
Dependencies: Task 5
Expected Output:
- `tailwind.config.cjs` extended with brand tokens (colors, spacing scale, breakpoints).
- Updated [src/index.css](src/index.css) base layer (focus rings, typography).
- Verified [src/components/ui/](src/components/ui/) primitives render and are themed.

## Task 12 — Login page
Dependencies: Task 9 (Dev 1), Task 6
Expected Output:
- `src/pages/Login.jsx` form with first/last/password, optional disambiguator field (shown when server says collision), remember-me checkbox.
- Inline error messages, attempts-remaining indicator, lockout countdown when locked.
- Links to Signup and Recover.
- On success, navigate to `/dashboard` (admins → `/admin`).

## Task 13 — Signup page with CAPTCHA + strength meter
Dependencies: Task 8 (Dev 1), Task 6
Expected Output:
- `src/pages/Signup.jsx` implementing every Req 7 field (with required markers).
- `src/components/PasswordStrengthMeter.jsx`: weak (≤10), medium, strong (≥18); blocks submit on weak.
- `src/components/Captcha.jsx`: locally generated arithmetic challenge with refresh button.
- Security questions: repeater allowing add/remove with min=3.
- Success screen shows assigned disambiguator (if any) and login CTA.

## Task 14 — Recover page
Dependencies: Tasks 11 (Dev 1), 13
Expected Output:
- `src/pages/Recover.jsx` three-step UI: identify (first/last/dob) → answer security questions → set new password (re-uses strength meter).
- Friendly errors for unknown users / wrong answers (without leaking which step failed).

## Task 15 — Auth context + protected routes
Dependencies: Tasks 10 (Dev 1), 5
Expected Output:
- `src/context/AuthContext.jsx` calling `GET /api/auth/me` on mount; exposes `user`, `login`, `logout`, `refresh`.
- `RequireAuth`, `RequireAdmin`, `RequireRoot` guards used in router.
- `useAutoLogout(minutes)` hook resets on activity; logs out on timeout (skipped when remember-me is on).

## Task 18 — Flights view
Dependencies: Tasks 16 (Dev 2), 6
Expected Output:
- `src/pages/Flights.jsx` with Tabs (Arrivals / Departures).
- Search input (debounced), sortable column headers (flight#, airline, airport, city, time, gate), pagination controls (page + pageSize).
- `src/components/FlightTable.jsx` (desktop) and `src/components/FlightCard.jsx` (mobile).
- Status badges; "Book this flight" CTA visible only when `bookable && status==scheduled && arriveAtReceiver > now+24h`.

## Task 19 — Flight detail page
Dependencies: Task 18
Expected Output:
- `src/pages/FlightDetail.jsx` showing all fields, async-updated via `useLiveResource`.
- Book button or "Not bookable: <reason>" hint.

## Task 20 — Async update hook
Dependencies: Task 5
Expected Output:
- `src/hooks/useLiveResource.js`: `(key, fetcher, intervalMs)` polling with pause-on-hidden (Page Visibility API), cancel on unmount, toast on update via [src/components/ui/toast.jsx](src/components/ui/toast.jsx).
- Used by flights, flight detail, ticket, dashboard.

## Task 25 — Booking UI: passenger + payment
Dependencies: Tasks 19, 15
Expected Output:
- `src/pages/Booking/Passenger.jsx`: first/middle/last, sex, DOB, phone, email.
- `src/pages/Booking/Payment.jsx`: masked card fields, expiry, CVC, cardholder, billing address+zip, "Save card" toggle (logged-in only), prominent "Never enter real card data" notice.
- Shared booking state (`useReducer` or context), per-step validation.

## Task 26 — Booking UI: seat map
Dependencies: Tasks 22 (Dev 2), 25
Expected Output:
- `src/pages/Booking/SeatMap.jsx`: SVG/CSS grid of 90 seats (e.g. 18 rows × A–F with aisles), legend, hover preview.
- Calls `POST /api/flights/:id/seats/lock` on selection; releases prior lock.
- Live refresh of seat states via `useLiveResource`.

## Task 27 — Booking UI: bags + review + confirm
Dependencies: Tasks 23 (Dev 2), 26
Expected Output:
- `src/pages/Booking/Bags.jsx` with steppers (carry-on max 2, checked max 5) and live price breakdown.
- `src/pages/Booking/Review.jsx` summarizing passenger, payment last4, seat, bags, totals.
- Submit calls `POST /api/bookings`; on success navigate to `/ticket/:confirmation` with toast; handles `No Fly` rejection with clear message.

## Task 28 — Ticket lookup page
Dependencies: Task 24 (Dev 2)
Expected Output:
- `src/pages/TicketLookup.jsx`: form (last name + confirmation), submit → `/ticket/:confirmation`.

## Task 29 — Ticket view page
Dependencies: Tasks 20, 24 (Dev 2)
Expected Output:
- `src/pages/Ticket.jsx` showing all required fields (arrival/departure flag, airline+number, destination, depart/arrive datetime, passenger name, gate, confirmation, status).
- Gate/time/status update async via `useLiveResource`.
- Cancel/refund button when eligible; confirmation modal.

## Task 31 — Customer dashboard UI
Dependencies: Tasks 30 (Dev 2), 20
Expected Output:
- `src/pages/Dashboard.jsx` displaying name, last_login_ip, last_login_datetime, upcoming flights (async live), past flights (paginated), settings link.
- Clicking a flight navigates to ticket view.

## Task 32 — Customer settings UI
Dependencies: Task 31
Expected Output:
- `src/pages/Settings.jsx`: profile edit form, default flight sort selector, saved cards list with delete, auto-logout selector (15m / 5m / 1h), delete-account flow with double confirm, claim-ticket form.

## Task 35 — Admin dashboard UI
Dependencies: Tasks 33 (Dev 2), 6
Expected Output:
- `src/pages/Admin/Dashboard.jsx`: 10 stat tiles (5 windows × tickets/gross).
- `src/pages/Admin/Customers.jsx`: searchable/paginated customer table, edit modal, create-customer form, airline-ban manager per customer.
- `src/pages/Admin/Tickets.jsx`: search by any flight field, view ticket link, cancel action.

## Task 36 — Root admin UI
Dependencies: Tasks 34 (Dev 1), 35
Expected Output:
- `src/pages/Admin/Admins.jsx` (visible only to root): list/create/edit/delete admins; root row non-editable, non-deletable.

## Task 37 (frontend half) — Admin-created customer first-login flow
Dependencies: Tasks 15, 37-backend (Dev 1)
Expected Output:
- `src/pages/CompleteProfile.jsx` forces password change + missing field completion before other navigation.
- Router redirect when `must_change_password || must_complete_profile`.

## Task 40 — Global error UI + spinners
Dependencies: Task 5
Expected Output:
- `src/components/ErrorBoundary.jsx` wrapping the router.
- `src/components/Spinner.jsx` reusable.
- Toast surface for API errors (incl. HTTP 555: "BDPA API hiccup — retrying…").
- Route-level Suspense fallback so no blank screen exceeds ~500ms.

## Task 41 — Responsive QA pass
Dependencies: All UI tasks
Expected Output:
- Verified on 320px, 768px, 1280px viewports; documented fixes per page.
- Mobile nav drawer; sticky table headers; tap targets ≥ 44px; no horizontal overflow.
- Lighthouse mobile score ≥ 90 on Home, Flights, Dashboard.

---

**Workload summary:** 19 frontend tasks. Heaviest UI surface area but most tasks are independent once Tasks 5/6/15 land, enabling parallel page work alongside Dev 1/Dev 2 backend progress.
