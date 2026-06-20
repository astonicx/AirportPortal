"use strict";

const request = require("supertest");
const { http, HttpResponse } = require("msw");
const { server } = require("../setup/msw/server.js");
const {
    db,
    getApp,
    resetDb,
    createUser,
    createAuthCookie,
} = require("./helpers/routeTestHarness");

const app = getApp();
const BASE = process.env.BDPA_BASE_URL || "http://127.0.0.1:4010";

function seedFlightCache(flightId, payload) {
    db.prepare(
        `INSERT INTO flight_cache (flight_id, payload_json, fetched_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(flight_id) DO UPDATE SET payload_json=excluded.payload_json, fetched_at=excluded.fetched_at`
    ).run(flightId, JSON.stringify(payload));
}

function bookableFlight(overrides = {}) {
    return {
        flight_id: "F-1",
        id: "F-1",
        flightNumber: "UA100",
        airline: "United",
        airport: "ORD",
        city: "Chicago",
        time: "10:00",
        gate: "A1",
        status: "scheduled",
        seat_price: 199,
        arriveAtReceiver: new Date(Date.now() + 48 * 3600_000).toISOString(),
        departFromSender: new Date(Date.now() + 24 * 3600_000).toISOString(),
        bookable: true,
        ...overrides,
    };
}

describe("routes: flights/bookings/tickets/no-fly", () => {
    beforeEach(() => {
        resetDb();
    });

    it("GET /api/flights returns paginated schema", async () => {
        server.use(
            http.get(`${BASE}/v1/flights/search`, () => HttpResponse.json({ flights: [bookableFlight()] }))
        );
        const res = await request(app).get("/api/flights?type=departure&page=1&pageSize=20");
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ page: 1, pageSize: 20 });
        expect(Array.isArray(res.body.items)).toBe(true);
    });

    it("GET /api/flights filters out status=past", async () => {
        seedFlightCache("P1", bookableFlight({ id: "P1", flight_id: "P1", status: "past" }));
        seedFlightCache("A1", bookableFlight({ id: "A1", flight_id: "A1", status: "scheduled" }));
        const res = await request(app).get("/api/flights");
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(1);
    });

    it("GET /api/flights upstream failure falls back to cache", async () => {
        seedFlightCache("C1", bookableFlight({ id: "C1", flight_id: "C1" }));
        server.use(http.get(`${BASE}/v1/flights/search`, () => HttpResponse.error()));
        const res = await request(app).get("/api/flights");
        expect(res.status).toBe(200);
        expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it("GET /api/flights/:id returns 502 when cache missing and upstream unavailable", async () => {
        const res = await request(app).get("/api/flights/not-found");
        expect(res.status).toBe(502);
        expect(typeof res.body.error).toBe("string");
    });

    it("GET /api/flights/:id returns from cache without upstream", async () => {
        seedFlightCache("F-CACHED", bookableFlight({ id: "F-CACHED", flight_id: "F-CACHED" }));
        const res = await request(app).get("/api/flights/F-CACHED");
        expect(res.status).toBe(200);
        expect(res.body.flightNumber).toBe("UA100");
    });

    it("GET /api/flights/:id/seats returns seat state schema", async () => {
        const res = await request(app).get("/api/flights/F-SEAT/seats");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.seats)).toBe(true);
        expect(res.body.seats[0]).toHaveProperty("seat");
        expect(res.body.seats[0]).toHaveProperty("state");
    });

    it("POST /api/flights/:id/seats/lock unauthorized returns 401", async () => {
        const res = await request(app).post("/api/flights/F1/seats/lock").send({ seat: "1A" });
        expect(res.status).toBe(401);
    });

    it("POST /api/flights/:id/seats/lock invalid seat returns 400", async () => {
        const u = await createUser({ first_name: "Seat", last_name: "Locker", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).post("/api/flights/F1/seats/lock").set("Cookie", auth.header).send({ seat: "99Z" });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid seat");
    });

    it("POST /api/flights/:id/seats/lock happy returns 200", async () => {
        const u = await createUser({ first_name: "Seat2", last_name: "Locker2", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).post("/api/flights/F1/seats/lock").set("Cookie", auth.header).send({ seat: "1A" });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(typeof res.body.lockedUntil).toBe("string");
    });

    it("DELETE /api/flights/:id/seats/lock unauthorized returns 401", async () => {
        const res = await request(app).delete("/api/flights/F1/seats/lock");
        expect(res.status).toBe(401);
    });

    it("DELETE /api/flights/:id/seats/lock authorized returns 200", async () => {
        const u = await createUser({ first_name: "Seat3", last_name: "Locker3", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).delete("/api/flights/F1/seats/lock").set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("POST /api/no-fly/check malformed request returns 400", async () => {
        const res = await request(app).post("/api/no-fly/check").send({ first: "A" });
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.issues)).toBe(true);
    });

    it("POST /api/no-fly/check upstream unavailable returns 502", async () => {
        const res = await request(app).post("/api/no-fly/check").send({
            first: "Safe",
            last: "Person",
            dob: "1990-01-01",
            gender: "male",
        });
        expect(res.status).toBe(502);
        expect(typeof res.body.error).toBe("string");
    });

    it("POST /api/bookings malformed request returns 400", async () => {
        const res = await request(app).post("/api/bookings").send({ flightId: "F1" });
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.issues)).toBe(true);
    });

    it("POST /api/bookings not bookable returns 400", async () => {
        const flight = bookableFlight({ id: "NB1", flight_id: "NB1", bookable: false });
        seedFlightCache("NB1", flight);
        const res = await request(app).post("/api/bookings").send({
            flightId: "NB1",
            passenger: { first: "P", last: "L", dob: "1990-01-01", gender: "male", email: "p@test.local", phone: "555" },
            payment: { cardNumber: "4111111111111111", expMonth: 1, expYear: 2030, cvc: "123", cardholder: "P L", billingAddress: "A", billingZip: "1" },
            seat: "1A",
            carryOnCount: 0,
            checkedCount: 0,
        });
        expect(res.status).toBe(400);
    });

    it("POST /api/bookings seat lock not owned returns 409", async () => {
        const flight = bookableFlight({ id: "L1", flight_id: "L1" });
        seedFlightCache("L1", flight);
        const res = await request(app).post("/api/bookings").send({
            flightId: "L1",
            passenger: { first: "P", last: "L", dob: "1990-01-01", gender: "male", email: "p@test.local", phone: "555" },
            payment: { cardNumber: "4111111111111111", expMonth: 1, expYear: 2030, cvc: "123", cardholder: "P L", billingAddress: "A", billingZip: "1" },
            seat: "1A",
            carryOnCount: 0,
            checkedCount: 0,
        });
        expect(res.status).toBe(409);
        expect(res.body.error).toBe("Seat lock not owned");
    });

    it("POST /api/bookings happy path returns 201", async () => {
        const user = await createUser({ first_name: "Book", last_name: "Owner", password: "StrongPassword123" });
        const auth = createAuthCookie(user.id);
        const flight = bookableFlight({ id: "B1", flight_id: "B1", airline: "United" });
        seedFlightCache("B1", flight);

        db.prepare("INSERT INTO seat_locks (flight_id, seat, session_id, locked_until) VALUES (?, ?, ?, ?)").run(
            "B1",
            "1A",
            auth.sessionId,
            new Date(Date.now() + 10 * 60_000).toISOString()
        );

        server.use(
            http.get(`${BASE}/v1/info/no-fly-list`, () => HttpResponse.json({ noFlyList: [] })),
            http.post(`${BASE}/v1/flights/B1/book`, () => HttpResponse.json({ ok: true }))
        );

        const res = await request(app)
            .post("/api/bookings")
            .set("Cookie", auth.header)
            .send({
                flightId: "B1",
                passenger: { first: "Pat", middle: "M", last: "Smith", dob: "1990-01-01", gender: "male", email: "pat@test.local", phone: "555" },
                payment: { cardNumber: "4111111111111111", expMonth: 1, expYear: 2030, cvc: "123", cardholder: "Pat Smith", billingAddress: "Addr", billingZip: "53202", saveCard: true },
                seat: "1A",
                carryOnCount: 1,
                checkedCount: 1,
            });
        expect(res.status).toBe(201);
        expect(res.body.ok).toBe(true);
        expect(typeof res.body.ticketId).toBe("number");
        expect(typeof res.body.confirmationCode).toBe("string");
    });

    it("GET /api/tickets/by-confirmation missing params returns 400", async () => {
        const res = await request(app).get("/api/tickets/by-confirmation");
        expect(res.status).toBe(400);
    });

    it("GET /api/tickets/by-confirmation not found returns 404", async () => {
        const res = await request(app).get("/api/tickets/by-confirmation?lastName=Nope&code=NONE");
        expect(res.status).toBe(404);
    });

    it("GET /api/tickets/by-confirmation happy returns ticket schema", async () => {
        db.prepare(
            `INSERT INTO tickets
             (confirmation_code, user_id, flight_id, passenger_first, passenger_last,
              passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
              carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents)
             VALUES ('CONF1234', NULL, 'F-T1', 'Guest', 'Last', '1990-01-01', 'male', 'g@test.local', '555', '1A', 0, 0, 10000, 0, 10000)`
        ).run();
        seedFlightCache("F-T1", bookableFlight({ id: "F-T1", flight_id: "F-T1" }));

        const res = await request(app).get("/api/tickets/by-confirmation?lastName=Last&code=CONF1234");
        expect(res.status).toBe(200);
        expect(res.body.ticket.confirmation_code).toBe("CONF1234");
        expect(res.body.flight.flightNumber).toBe("UA100");
    });

    it("POST /api/tickets/:id/cancel not found returns 404", async () => {
        const res = await request(app).post("/api/tickets/9999/cancel").send({ lastName: "X", code: "Y" });
        expect(res.status).toBe(404);
    });

    it("POST /api/tickets/:id/cancel forbidden returns 403", async () => {
        db.prepare(
            `INSERT INTO tickets
             (confirmation_code, user_id, flight_id, passenger_first, passenger_last,
              passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
              carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents)
             VALUES ('CONF403', NULL, 'F-403', 'Guest', 'Last', '1990-01-01', 'male', 'g@test.local', '555', '1A', 0, 0, 10000, 0, 10000)`
        ).run();
        const id = db.prepare("SELECT id FROM tickets WHERE confirmation_code='CONF403'").get().id;

        const res = await request(app).post(`/api/tickets/${id}/cancel`).send({ lastName: "Wrong", code: "Wrong" });
        expect(res.status).toBe(403);
    });

    it("POST /api/tickets/:id/cancel already cancelled returns 409", async () => {
        db.prepare(
            `INSERT INTO tickets
             (confirmation_code, user_id, flight_id, passenger_first, passenger_last,
              passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
              carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents, status)
             VALUES ('CONF409', NULL, 'F-409', 'Guest', 'Last', '1990-01-01', 'male', 'g@test.local', '555', '1A', 0, 0, 10000, 0, 10000, 'cancelled')`
        ).run();
        const id = db.prepare("SELECT id FROM tickets WHERE confirmation_code='CONF409'").get().id;

        const res = await request(app).post(`/api/tickets/${id}/cancel`).send({ lastName: "Last", code: "CONF409" });
        expect(res.status).toBe(409);
    });

    it("POST /api/tickets/:id/cancel happy guest path returns 200", async () => {
        db.prepare(
            `INSERT INTO tickets
             (confirmation_code, user_id, flight_id, passenger_first, passenger_last,
              passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
              carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents)
             VALUES ('CONF200', NULL, 'F-200', 'Guest', 'Last', '1990-01-01', 'male', 'g@test.local', '555', '1A', 0, 0, 10000, 0, 10000)`
        ).run();
        const id = db.prepare("SELECT id FROM tickets WHERE confirmation_code='CONF200'").get().id;

        server.use(http.delete(`${BASE}/v1/tickets/${id}`, () => HttpResponse.json({ ok: true })));

        const res = await request(app).post(`/api/tickets/${id}/cancel`).send({ lastName: "Last", code: "CONF200" });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
}
);