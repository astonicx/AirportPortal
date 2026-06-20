import { http, HttpResponse } from "msw";

const BASE = process.env.VITE_API_BASE_URL || "";

// ─── Auth Fixtures ────────────────────────────────────────────────────────

export const fixtureUser = {
    id: 1,
    email: "test@example.com",
    first_name: "Test",
    last_name: "User",
    type: "customer",
};

export const fixtureAdminUser = {
    id: 2,
    email: "admin@example.com",
    first_name: "Admin",
    last_name: "User",
    type: "admin",
};

export const fixtureDashboard = {
    profile: {
        firstName: "Test",
        lastLoginDatetime: "2024-01-15T10:00:00Z",
        lastLoginIp: "127.0.0.1",
    },
    upcoming: [
        {
            id: 1,
            confirmation_code: "ABC123",
            flight: { airline: "United", flightNumber: "UA100" },
            seat: "12A",
            passenger_last: "User",
        },
    ],
    past: [],
};

export const fixtureFlights = {
    page: 1,
    pageSize: 20,
    total: 2,
    items: [
        {
            id: "FLIGHT-1",
            flight_id: "FLIGHT-1",
            flightNumber: "UA100",
            airline: "United",
            status: "scheduled",
            city: "New York",
            airport: "JFK",
            time: "14:30",
            gate: "A1",
        },
        {
            id: "FLIGHT-2",
            flight_id: "FLIGHT-2",
            flightNumber: "AA200",
            airline: "American",
            status: "scheduled",
            city: "Boston",
            airport: "BOS",
            time: "15:45",
            gate: "B2",
        },
    ],
};

export const fixtureFlightDetail = {
    id: "FLIGHT-1",
    flight_id: "FLIGHT-1",
    flightNumber: "UA100",
    airline: "United",
    status: "scheduled",
    city: "New York",
    airport: "JFK",
    time: "14:30",
    gate: "A1",
    seat_price: 250,
    bookable: true,
};

export const fixtureSeats = {
    seats: [
        { seat: "12A", state: "available" },
        { seat: "12B", state: "taken" },
        { seat: "12C", state: "available" },
    ],
};

export const fixtureTickets = {
    tickets: [
        {
            id: 1,
            confirmation_code: "ABC123",
            status: "active",
            seat: "12A",
            passenger_last: "User",
        },
    ],
};

// ─── Auth Handlers ────────────────────────────────────────────────────────

export const authHandlers = [
    // GET /api/auth/me - fetch current user
    http.get(`${BASE}/api/auth/me`, () => {
        return HttpResponse.json(fixtureUser);
    }),

    // POST /api/auth/login - user login
    http.post(`${BASE}/api/auth/login`, async ({ request }) => {
        const body = await request.json();
        if (body.email === "invalid@example.com") {
            return HttpResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }
        return HttpResponse.json({ ok: true });
    }),

    // POST /api/auth/logout - user logout
    http.post(`${BASE}/api/auth/logout`, () => {
        return HttpResponse.json({ ok: true });
    }),

    // POST /api/auth/signup - user registration
    http.post(`${BASE}/api/auth/signup`, async ({ request }) => {
        const body = await request.json();
        if (body.email === "existing@example.com") {
            return HttpResponse.json(
                { error: "Email already registered" },
                { status: 409 }
            );
        }
        return HttpResponse.json({ ok: true });
    }),

    // POST /api/auth/password-reset - password reset
    http.post(`${BASE}/api/auth/password-reset`, async ({ request }) => {
        const body = await request.json();
        if (!body.email) {
            return HttpResponse.json(
                { error: "Email required" },
                { status: 400 }
            );
        }
        return HttpResponse.json({ ok: true });
    }),

    // POST /api/auth/recover - password recovery
    http.post(`${BASE}/api/auth/recover`, async ({ request }) => {
        const body = await request.json();
        if (!body.email || !body.securityAnswers) {
            return HttpResponse.json(
                { error: "Invalid request" },
                { status: 400 }
            );
        }
        return HttpResponse.json({ ok: true, tempPassword: "Temp123!!" });
    }),
];

// ─── Customer Handlers ────────────────────────────────────────────────────

export const customerHandlers = [
    // GET /api/me/dashboard - customer dashboard
    http.get(`${BASE}/api/me/dashboard`, () => {
        return HttpResponse.json(fixtureDashboard);
    }),

    // GET /api/flights - list flights
    http.get(`${BASE}/api/flights`, ({ request }) => {
        const url = new URL(request.url);
        const type = url.searchParams.get("type");
        const q = url.searchParams.get("q");
        if (q) {
            return HttpResponse.json({
                ...fixtureFlights,
                items: fixtureFlights.items.filter((f) =>
                    f.flightNumber.includes(q)
                ),
            });
        }
        return HttpResponse.json(fixtureFlights);
    }),

    // GET /api/flights/:id - flight detail
    http.get(`${BASE}/api/flights/:id`, () => {
        return HttpResponse.json(fixtureFlightDetail);
    }),

    // GET /api/flights/:id/seats - seat availability
    http.get(`${BASE}/api/flights/:id/seats`, () => {
        return HttpResponse.json(fixtureSeats);
    }),

    // POST /api/flights/:id/seats/lock - lock seat
    http.post(`${BASE}/api/flights/:id/seats/lock`, async ({ request }) => {
        const body = await request.json();
        if (!body.seat) {
            return HttpResponse.json(
                { error: "Seat required" },
                { status: 400 }
            );
        }
        return HttpResponse.json({
            ok: true,
            lockedUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });
    }),

    // DELETE /api/flights/:id/seats/lock - unlock seat
    http.delete(`${BASE}/api/flights/:id/seats/lock`, () => {
        return HttpResponse.json({ ok: true });
    }),

    // POST /api/bookings - create booking
    http.post(`${BASE}/api/bookings`, async ({ request }) => {
        const body = await request.json();
        if (!body.flightId || !body.seat) {
            return HttpResponse.json(
                { error: "Flight and seat required" },
                { status: 400 }
            );
        }
        return HttpResponse.json({
            ticketId: "TICKET-1",
            confirmationCode: "ABC123",
        });
    }),

    // POST /api/no-fly/check - check no-fly list
    http.post(`${BASE}/api/no-fly/check`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
            blocked: false,
            reason: null,
        });
    }),

    // GET /api/tickets - list tickets
    http.get(`${BASE}/api/tickets`, () => {
        return HttpResponse.json(fixtureTickets);
    }),

    // GET /api/tickets/:code - ticket detail
    http.get(`${BASE}/api/tickets/:code`, () => {
        return HttpResponse.json(fixtureTickets.tickets[0]);
    }),

    // DELETE /api/tickets/:code - cancel ticket
    http.delete(`${BASE}/api/tickets/:code`, () => {
        return HttpResponse.json({ ok: true });
    }),
];

// ─── Admin Handlers ────────────────────────────────────────────────────────

export const adminHandlers = [
    // GET /api/admin/dashboard - admin dashboard
    http.get(`${BASE}/api/admin/dashboard`, () => {
        return HttpResponse.json({
            totalUsers: 100,
            totalTickets: 250,
            totalRevenue: 50000,
        });
    }),

    // GET /api/admin/customers - list customers
    http.get(`${BASE}/api/admin/customers`, () => {
        return HttpResponse.json({
            items: [fixtureUser],
            total: 1,
        });
    }),

    // GET /api/admin/admins - list admins
    http.get(`${BASE}/api/admin/admins`, () => {
        return HttpResponse.json({
            items: [fixtureAdminUser],
            total: 1,
        });
    }),

    // GET /api/admin/tickets - list all tickets
    http.get(`${BASE}/api/admin/tickets`, () => {
        return HttpResponse.json({
            items: fixtureTickets.tickets,
            total: 1,
        });
    }),

    // POST /api/admin/customers/:id/ban - ban customer
    http.post(`${BASE}/api/admin/customers/:id/ban`, () => {
        return HttpResponse.json({ ok: true });
    }),

    // DELETE /api/admin/customers/:id/ban - unban customer
    http.delete(`${BASE}/api/admin/customers/:id/ban`, () => {
        return HttpResponse.json({ ok: true });
    }),
];

// ─── Error Handlers ────────────────────────────────────────────────────────

export const errorHandlers = {
    unauthorized: [
        http.get(`${BASE}/api/auth/me`, () => {
            return HttpResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }),
    ],
    forbidden: [
        http.get(`${BASE}/api/admin/dashboard`, () => {
            return HttpResponse.json(
                { error: "Forbidden" },
                { status: 403 }
            );
        }),
    ],
    notFound: [
        http.get(`${BASE}/api/flights/:id`, () => {
            return HttpResponse.json(
                { error: "Flight not found" },
                { status: 404 }
            );
        }),
    ],
    serverError: [
        http.get(`${BASE}/api/me/dashboard`, () => {
            return HttpResponse.json(
                { error: "Internal server error" },
                { status: 500 }
            );
        }),
    ],
    validationError: [
        http.post(`${BASE}/api/bookings`, () => {
            return HttpResponse.json(
                { error: "Invalid booking data" },
                { status: 400 }
            );
        }),
    ],
};

// ─── Export all success handlers ────────────────────────────────────────────

export const successHandlers = [
    ...authHandlers,
    ...customerHandlers,
    ...adminHandlers,
];
