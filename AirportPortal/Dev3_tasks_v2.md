# Developer 3 — Frontend, Dashboards & UX Lead

**Primary Focus:** React UI for email-based login/signup, V2 flight browsing (seat classes, extras), booking wizard (seat class UI, extras, FFM), check-in flow, persistent sidebar with FFM, attendant dashboard, customer ban handling, responsive design.

**Dependencies:**
- **Waits on Dev 1:** T-3 (email login), T-4 (ban handling), T-6 (attendant scaffolding)
- **Waits on Dev 2:** T-10 (flight V2 response), T-15 (booking endpoint), T-18 (check-in logic), T-21 (attendant ticket list)

**Task Count:** 11 core tasks (~120 story points)

---

## Sprint 1 — Auth UI Updates (Email-Based Login)

### T-23 — Email login page (replace name-based)
**Dependencies:** Dev 1 T-3  
**Effort:** Medium | **Est. Hours:** 6–7

**Description:**
Replace name-based login with email + password. Remove disambiguator field and logic.

**Deliverables:**
- [ ] Replace `src/pages/Login.jsx`:
  - Form fields: email (text input), password (password input), remember-me checkbox
  - Remove: first_name, last_name, disambiguator fields
  - Validation: email format, password required
  - Error messages:
    - "Invalid email or password" (generic for security)
    - "Account banned. Contact support." (if 403 from server)
    - "Too many failed attempts. Try again later." (if locked)
    - Show attempts remaining counter (when not locked)
  - On success: navigate to `/dashboard` (customer) or `/admin` (admin/root)

- [ ] Links: Signup (`/signup`), Password Recovery (`/recover`)

- [ ] Responsive: mobile-first, centered form, accessible focus states

**Acceptance Criteria:**
- [x] Email + password login works
- [x] No disambiguator field visible
- [x] Error messages clear
- [x] Attempts counter shown (when applicable)
- [x] Mobile responsive
- [x] Accessibility: keyboard navigable, form labels present
- [x] Manual test: login with email, verify redirect

---

### T-24 — Signup page updated for email + optional name
**Dependencies:** Dev 1 T-3  
**Effort:** Medium | **Est. Hours:** 6–7

**Description:**
Update signup to use email (required, unique) and make first/last name optional (can be filled later in profile completion).

**Deliverables:**
- [ ] Update `src/pages/Signup.jsx`:
  - New field: email (text input, unique validation)
  - First/last name: optional fields (can skip, fill later)
  - Other fields: password (with strength meter), DOB, gender, phone, security questions, CAPTCHA
  - Unique email validation: on blur, debounce 500ms, call `POST /api/auth/signup/check-email`
  - If email taken: show "Email already in use"

- [ ] Remove: name disambiguation logic

- [ ] Success screen: "Signup successful! You can now login." with link to `/login`

- [ ] Responsive: mobile-first

**Acceptance Criteria:**
- [x] Email field present and validated
- [x] Email uniqueness checked (debounced)
- [x] First/last name optional
- [x] Password strength meter works
- [x] Signup submits correctly
- [x] Success screen shown
- [x] Mobile responsive
- [x] Manual test: signup with email, verify in DB

---

### T-14 (frontend half) — Auth context + protected routes (updated)
**Dependencies:** Dev 1 T-3  
**Effort:** Small | **Est. Hours:** 3–4

**Description:**
Update AuthContext to use email instead of name for user identity.

**Deliverables:**
- [ ] Update `src/context/AuthContext.jsx`:
  - `GET /api/auth/me` now returns `email` field instead of first_name
  - User profile in context: `{userId, email, user_type, ...}`
  - Remove any name-based identity logic
  - On login/logout, update context correctly

**Acceptance Criteria:**
- [x] Context reflects email-based auth
- [x] Protected routes work
- [x] Tests pass

---

## Sprint 2 — Ban Handling & Profile Updates

### T-30 — Customer ban/logout handling (frontend)
**Dependencies:** Dev 1 T-4  
**Effort:** Medium | **Est. Hours:** 4–5

**Description:**
If user is banned mid-session, detect it and force logout with clear message.

**Deliverables:**
- [ ] Add ban detection middleware to `src/context/AuthContext.jsx`:
  - On any authenticated request (or periodic check via `GET /api/auth/me`), check user status
  - If `is_banned=true` in response: trigger logout, clear session cookie
  - Show modal: "Your account has been banned. Reason: [reason]. Contact support."
  - Redirect to login after closing modal

- [ ] Component `src/components/BanModal.jsx`:
  - Modal (non-dismissible)
  - Message + support email/link
  - "OK" button → redirect to login

**Acceptance Criteria:**
- [x] Ban detection works
- [x] Modal shown with clear message
- [x] User logged out after ban detected
- [x] Redirect to login
- [x] Manual test: ban user mid-session, verify logout + modal

---

### T-31 — Airline restriction error handling
**Dependencies:** Dev 2 T-5, Dev 2 T-15  
**Effort:** Small | **Est. Hours:** 2–3

**Description:**
On booking error due to airline restriction, show friendly error message.

**Deliverables:**
- [ ] In booking flow (T-27 or T-26), handle error response:
  ```json
  {error: "You are not permitted to book with [airline]", code: "AIRLINE_RESTRICTED"}
  ```
  - Show toast or modal: "You are not permitted to book flights with [airline]. Contact support for more information."
  - Allow user to go back and select different flight

**Acceptance Criteria:**
- [x] Error message clear and helpful
- [x] Manual test: attempt booking with restricted airline, see error

---

## Sprint 3 — Flights & Seat Selection

### T-18 — Flights view (updated for V2 + 36h rule)
**Dependencies:** Dev 2 T-10  
**Effort:** Large | **Est. Hours:** 8–10

**Description:**
Display flights with seat classes, baggage fees, extras, FFM credit. Filter honors 36-hour rule. Mobile-first responsive.

**Deliverables:**
- [ ] Update `src/pages/Flights.jsx`:
  - Tabs: Arrivals / Departures
  - Search input (debounced): searches flight number, airline, airport, city
  - Column headers (sortable): flight#, airline, airport, city, departure time, gate, status
  - Results: paginated table (desktop) / cards (mobile)

- [ ] Update `src/components/FlightTable.jsx` (desktop):
  - Columns: flight#, airline, destination, departure time, status, price range (with seat classes), FFM credit, "Book" button
  - Price range: "$15 - $500 (economy - first class)"
  - FFM credit: "Earn 5,000 FFM"
  - "Book" button: enabled only if `bookable && status=="scheduled" && >36h to departure`
  - Disabled state reason: "Not bookable: within 36 hours of departure" or "Not available"

- [ ] Update `src/components/FlightCard.jsx` (mobile):
  - Horizontal card layout
  - Key info: airline, flight#, time, destination, price range, FFM credit
  - "Book" button (same enable logic as table)

- [ ] Pagination controls: page + pageSize dropdowns

- [ ] Async updates: `useLiveResource` polls `/api/flights` every 30s, updates flight status/times/gates in real-time

**Acceptance Criteria:**
- [x] V2 response parsed correctly (seat classes, extras, FFM visible)
- [x] 36-hour filter honored (non-bookable flights grayed out)
- [x] Search works
- [x] Sort works
- [x] Pagination works
- [x] Price range displayed (all seat classes)
- [x] FFM credit shown
- [x] Async updates work (use `useLiveResource`)
- [x] Mobile responsive (stacks cards on small screens)
- [x] Accessibility: semantic HTML, ARIA on dynamic updates
- [x] Manual test: browse flights, see prices + FFM, try booking within 36h (should be disabled)

---

### T-26 — Booking UI: seat map with class colors
**Dependencies:** Dev 2 T-11, Dev 2 T-15  
**Effort:** Large | **Est. Hours:** 10–12

**Description:**
Interactive seat map showing seat classes (economy, exit row, economy plus, first class) with color coding and price labels.

**Deliverables:**
- [ ] Create `src/pages/Booking/SeatMap.jsx`:
  - SVG or CSS grid of seats (simulated aircraft cabin layout)
  - Example: 18 rows (numbers 1–18), columns A–F with center aisle
  - Seat coloring: economy (blue), exit_row (orange), economy_plus (light blue), first_class (gold)
  - On hover: show seat number, class, price (e.g., "1A • First Class • $500")
  - Click to select: highlights selected seat, shows summary below map
  - On selection: calls `POST /api/flights/:id/seats/lock` to reserve seat (10-min lock)
  - On unselect or change: releases prior lock via `DELETE /api/flights/:id/seats/lock`

- [ ] Legend below map: color squares + class names + price ranges

- [ ] Real-time updates: `useLiveResource` polls `GET /api/flights/:id/seats` every 10s
  - Updates seat states: available, taken, locked (by others), mine (selected)
  - Grayed out unavailable seats
  - Toast notification if seat becomes unavailable

- [ ] Error handling:
  - If seat lock expires: show toast "Seat lock expired, please select again"
  - Retry automatically (or prompt user)

- [ ] Responsive: on mobile, seat map may be scrollable or use smaller layout

**Acceptance Criteria:**
- [x] Seat map renders with color coding
- [x] Hover shows seat info
- [x] Click selects seat (calls lock endpoint)
- [x] Seat lock persisted
- [x] Prior lock released on change
- [x] Real-time updates from `useLiveResource`
- [x] Legend clear and accurate
- [x] Price labels visible
- [x] Mobile responsive (scrollable if needed)
- [x] Manual test: select seat, see price, verify in booking summary

---

### T-27 — Booking UI: bags + in-flight extras + review + confirm
**Dependencies:** Dev 2 T-13, Dev 2 T-15  
**Effort:** Large | **Est. Hours:** 10–12

**Description:**
Multi-step booking flow: passenger info, payment, seat selection (T-26), baggage selection with dynamic pricing, extras selection, review + confirm.

**Deliverables:**
- [ ] Create multi-step booking context/state (useReducer or context):
  - Step 1: Passenger info (first/middle/last, DOB, gender, phone, email)
  - Step 2: Payment (card number, expiry, CVC, cardholder, billing address, zip, save card checkbox for logged-in users)
  - Step 3: Seat selection (→ T-26 `SeatMap.jsx`)
  - Step 4: Baggage (`Bags.jsx`, new)
  - Step 5: Extras (`Extras.jsx`, new)
  - Step 6: Review (`Review.jsx`)
  - Step 7: Confirm + submit

- [ ] **`src/pages/Booking/Bags.jsx`:**
  - Steppers for carry-on (0–2) and checked (0–5)
  - Live price display:
    - "Carry-on: 1 @ $0 + 1 @ $30 = $30"
    - "Checked: 1 @ $0 + 1 @ $50 + 1 @ $100 = $150"
  - Price fetched from `GET /api/flights/:id/baggage`
  - Total visible at bottom

- [ ] **`src/pages/Booking/Extras.jsx`:**
  - Checklist of available extras (wifi, meals, seat upgrade, etc.)
  - Each extra shows: name, price ($), price (FFM), checkbox
  - Payment method selectors for each extra: $ / FFM / mixed
  - If mixed: two inputs ($ amount, FFM amount)
  - Live total calculation
  - Tip: "You can mix payment methods. Use whatever works best."

- [ ] **`src/pages/Booking/Review.jsx`:**
  - Summary of all selections:
    - Passenger name + DOB
    - Flight details (airline, number, time, destination)
    - Seat (class, price)
    - Baggage (count, price)
    - Extras (list, prices)
    - Payment breakdown: $ total + FFM total = combined cost in equivalent units
  - Grand total in large text
  - Edit buttons: "Change seat", "Change baggage", etc. (step back)
  - Confirm button

- [ ] **On confirm:**
  - Submit `POST /api/bookings` with full payload
  - Handle errors:
    - No Fly blocked: "We cannot complete your booking. For assistance, contact customer service."
    - Airline restricted: "You are not permitted to book with this airline."
    - 36h rule violated: "Must book at least 36 hours in advance."
    - Insufficient FFM: "Your FFM balance is insufficient. Add funds or use a card."
    - Insufficient payment: "Payment amount insufficient. Please review and try again."
  - On success: navigate to `/ticket/:confirmation` with toast "Booking confirmed!"

- [ ] **Payment notice:**
  - Prominent red banner: "❌ TEST MODE: Never enter real card data. Use fake data only."

- [ ] All steps responsive (mobile: stacked layout, desktop: side-by-side or single-column centered)

**Acceptance Criteria:**
- [x] Multi-step flow works
- [x] Passenger info collected
- [x] Seat map integrates (T-26)
- [x] Baggage pricing dynamic per flight
- [x] Extras available and selectable
- [x] Mixed payment ($ + FFM) works
- [x] Review summary accurate
- [x] Confirm submits correctly
- [x] Error messages clear
- [x] No real card data message prominent
- [x] Mobile responsive
- [x] Accessibility: form labels, error messages accessible
- [x] Manual test: complete booking flow, verify ticket created in DB

---

## Sprint 4 — Check-in & FFM Display

### T-28 — Check-in view
**Dependencies:** Dev 2 T-18, Dev 2 T-19  
**Effort:** Medium | **Est. Hours:** 6–7

**Description:**
Check-in page for guests (lookup by last name + confirmation code) and customers (show nearby flights).

**Deliverables:**
- [ ] Create `src/pages/CheckIn.jsx`:
  - Two sections: "Guest Check-in" + "Customer Check-in"

- [ ] **Guest Check-in:**
  - Form: last name (text input), confirmation code (text input, uppercase suggestion)
  - On submit: calls `GET /api/tickets/by-confirmation?lastName=X&code=Y`
  - If found and eligible: show gate + boarding info, redirect to `/ticket/:confirmation` after 3s or on button click
  - If found but not eligible: "Check-in not yet available. Available at [time]."
  - If already checked in: "You're already checked in! See your ticket."
  - If not found: "Ticket not found. Please verify the confirmation code and last name."

- [ ] **Customer Check-in (authenticated):**
  - List of upcoming flights (within 24h)
  - Each flight card: airline, number, destination, departure time, gate, status
  - "Check-in" button (enabled if within 24h)
  - On click: calls `POST /api/tickets/:id/checkin`
  - Shows gate + boarding status on success

- [ ] **Mobile responsive:** guest form stacks on small screens

**Acceptance Criteria:**
- [x] Guest lookup works (last name + code)
- [x] Eligibility check works (24h window)
- [x] Already-checked-in redirect works
- [x] Customer check-in list shows upcoming flights
- [x] Check-in button works
- [x] Success shows gate + boarding info
- [x] Mobile responsive
- [x] Manual test: guest check-in, customer check-in, not-eligible message

---

### T-29 — FFM balance display
**Dependencies:** Dev 2 T-12  
**Effort:** Small | **Est. Hours:** 3–4

**Description:**
Show customer's FFM balance in sidebar (T-25), dashboard, and booking review.

**Deliverables:**
- [ ] In dashboard (`src/pages/Dashboard.jsx`):
  - Display: "Frequent Flier Miles: 50,000" (large, prominent)
  - Link: "View FFM history" (optional future feature)

- [ ] In booking review (T-27 `Review.jsx`):
  - Show customer's current FFM balance
  - Show FFM being spent in this booking
  - Show FFM earned (if paid with money)
  - Example: "Current balance: 50,000 FFM | Spending: 5,000 FFM | Earning: 0 FFM (paid with money) | New balance: 45,000 FFM"

- [ ] In sidebar (T-25 `UpcomingSidebar.jsx`):
  - Display FFM balance (small): "FFM: 50,000"

**Acceptance Criteria:**
- [x] FFM balance fetched from `GET /api/me/ffm`
- [x] Balance displayed in dashboard, booking, sidebar
- [x] Updates after booking
- [x] Manual test: book with FFM, verify balance updated

---

## Sprint 5 — Persistent Sidebar & UX Polish

### T-25 — Persistent sidebar with upcoming flight + user info
**Dependencies:** Dev 2 T-10 (flight data)  
**Effort:** Medium | **Est. Hours:** 6–8

**Description:**
Fixed sidebar (desktop) or collapsible panel (mobile) showing customer's nearest upcoming flight and account info.

**Deliverables:**
- [ ] Create `src/components/layout/UpcomingSidebar.jsx`:
  - Desktop: fixed right sidebar (min-width 300px, max-width 350px)
  - Mobile: hidden by default, toggleable via hamburger menu
  - Content sections:
    1. **Greeting:** "Hi, [firstName]!" (first name from user profile)
    2. **Account info:** Email address, phone (if available)
    3. **Upcoming flight:**
       - Airline + flight number (large, bold)
       - Destination (city or airport code)
       - Departure date + time (formatted: "Wed, Jul 23, 2026 at 2:00 PM")
       - Gate (when available)
       - "Check-in" button (if within 24h) → navigate to `/checkin/:ticketId`
    4. **FFM balance:** "Frequent Flier Miles: [balance]" (if customer)
    5. **Quick links:** Dashboard, Settings, Logout

- [ ] Auto-refresh: `useLiveResource` with 30s interval to fetch nearest upcoming flight
- [ ] If no upcoming flight: "No upcoming flights. Book now!"

- [ ] Styling:
  - Desktop: sidebar positioned right, stays visible while scrolling
  - Mobile: slide-out drawer (z-index above main content)
  - Color scheme: contrast with main theme, clearly distinguishable

- [ ] Responsive breakpoint: hidden on screens < 768px (tablets show as drawer)

**Acceptance Criteria:**
- [x] Sidebar visible on desktop (fixed position)
- [x] Mobile drawer accessible
- [x] Upcoming flight displayed
- [x] Flight info auto-refreshes (30s interval)
- [x] Check-in button works (if eligible)
- [x] FFM balance shown
- [x] User greeting personalized
- [x] Quick links functional
- [x] Responsive: desktop fixed, mobile drawer
- [x] Manual test: login, verify sidebar shows correct flight + user info; wait 30s, verify refresh

---

## Sprint 6 — Attendant Dashboard

### T-32 — Attendant dashboard (frontend)
**Dependencies:** Dev 1 T-6, Dev 2 T-8, Dev 2 T-21  
**Effort:** Large | **Est. Hours:** 12–14

**Description:**
Attendant-exclusive dashboard to manage flights, customers, tickets, and create tickets.

**Deliverables:**
- [ ] Create `src/pages/admin/AttendantDashboard.jsx`:
  - Protected route (requires `user_type='attendant'`)
  - Tabs:
    1. **Flights** (default)
    2. **Customers**
    3. **Tickets**
    4. **Create Ticket**

- [ ] **Flights tab:**
  - List of flights for attendant's assigned airline
  - Paginated: 10 flights per page
  - Columns: flight#, destination, departure time, gate, status, # of passengers, actions
  - "View Passengers" button → shows paginated passenger list for that flight

- [ ] **Customers tab:**
  - Search box: search customers by email, name, phone
  - Results: paginated table
  - Columns: name, email, phone, # of bookings, last booking date, actions
  - "View bookings" → shows customer's bookings with this airline

- [ ] **Tickets tab:**
  - Search box: search tickets by flight field (flight#, destination, etc.) or passenger name
  - Results: paginated table
  - Columns: confirmation code, passenger, flight, seat, status, booked date, actions
  - "View detail" → full ticket info
  - "Cancel ticket" button (with confirmation modal) → calls `DELETE /api/attendant/tickets/:id`

- [ ] **Create Ticket tab:**
  - Form to manually create ticket for customer:
    - Customer lookup (email or name)
    - Flight selection (dropdown, filtered by airline)
    - Passenger info (first/middle/last, DOB, gender, email, phone)
    - Seat selection (seat picker UI, like T-26)
    - Baggage (steppers, like T-27)
    - Extras (checklist, like T-27)
    - Submit button
  - On success: "Ticket created! Confirmation code: ABC123"

- [ ] All tables responsive: desktop = full table, mobile = cards with key info + actions

- [ ] Sorting: on table column headers (name, date, etc.)

**Acceptance Criteria:**
- [x] Only attendants can access (guard in router)
- [x] Flights list shows only attendant's airline
- [x] Customer search works
- [x] Ticket search works
- [x] Ticket cancel works (with modal confirmation)
- [x] Create ticket form works end-to-end
- [x] All tables paginated
- [x] Mobile responsive (cards on small screens)
- [x] Manual test: attendant views flights, searches customers, creates ticket, cancels ticket

---

## Testing & QA

### T-34 — E2E & responsive QA
**Dependencies:** All sprints  
**Effort:** Large | **Est. Hours:** 10–12

**Description:**
End-to-end testing and responsive design verification.

**Deliverables:**
- [ ] **E2E flow (Dev 3 + Dev 2):**
  1. New user signup (email)
  2. Login with email
  3. Browse flights (verify 36h filter, see prices + FFM)
  4. Select flight, enter seat class
  5. Add baggage (verify dynamic pricing)
  6. Add extras (verify mixed payment $ + FFM)
  7. Review booking
  8. Confirm → success screen
  9. Check-in (if within 24h)
  10. View ticket
  11. Cancel ticket (verify FFM refunded)

- [ ] **Responsive QA:**
  - Desktop (1920×1080): all UI visible, no truncation
  - Tablet (768×1024): responsive layout, drawer sidebar
  - Mobile (375×667): cards instead of tables, touch-friendly buttons
  - Test on Chrome, Firefox, Safari

- [ ] **Accessibility:**
  - Keyboard navigation: tab through all forms, buttons accessible
  - Screen reader: form labels, error messages, dynamic content announced
  - Color contrast: text readable, not reliant on color alone

- [ ] **Performance:**
  - First meaningful paint <1s
  - Booking page load <2s
  - Flight list pagination smooth (<500ms per page)

**Acceptance Criteria:**
- [x] Full E2E flow works (signup to check-in)
- [x] Desktop fully responsive
- [x] Tablet responsive (drawer sidebar)
- [x] Mobile responsive (cards, touch-friendly)
- [x] Keyboard navigable
- [x] Screen reader friendly
- [x] Performance acceptable
- [x] No console errors
- [x] All manual tests pass

---

## Checklist for Dev 3 Completion

- [ ] T-23: Email login page functional
- [ ] T-24: Signup page with email + optional name
- [ ] T-14 (frontend): Auth context updated for email
- [ ] T-30: Ban detection + logout + modal
- [ ] T-31: Airline restriction error handling
- [ ] T-18: Flights view with V2 data, 36h rule, responsive
- [ ] T-26: Seat map with class colors, locking, real-time updates
- [ ] T-27: Booking multi-step flow (passenger, payment, seat, bags, extras, review, confirm)
- [ ] T-28: Check-in view (guest + customer)
- [ ] T-29: FFM balance displayed (dashboard, booking, sidebar)
- [ ] T-25: Persistent sidebar with upcoming flight + user info
- [ ] T-32: Attendant dashboard (flights, customers, tickets, create ticket)
- [ ] T-34: E2E testing + responsive QA
- [ ] All manual tests passing
- [ ] No console errors
- [ ] Performance acceptable

---

## Coordination Notes

**With Dev 1:**
- T-3 (email login) unblocks T-23, T-24
- T-4 (ban) unblocks T-30
- T-6 (attendant type) unblocks T-32

**With Dev 2:**
- T-10 (flight V2 response) unblocks T-18
- T-11 (seat classes) unblocks T-26
- T-13 (baggage pricing) unblocks T-27
- T-15 (booking endpoint) unblocks T-27
- T-18 (check-in logic) unblocks T-28
- T-12 (FFM endpoint) unblocks T-29
- T-21 (attendant ticket list) unblocks T-32

**Cross-team:**
- Coordinate on V2 API field names / response format (Dev 1 T-1 + Dev 2 T-9 + Dev 3 T-18)
- Test error responses together (ban, airline restriction, No Fly, booking errors)
- E2E test scenarios (T-34) as final integration checkpoint

