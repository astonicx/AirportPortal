"use strict";

const request = require("supertest");
const {
    db,
    getApp,
    resetDb,
    createUser,
    createAuthCookie,
} = require("./helpers/routeTestHarness");

const app = getApp();

function seedFlightCache(flightId, payload) {
    db.prepare(
        `INSERT INTO flight_cache (flight_id, payload_json, fetched_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(flight_id) DO UPDATE SET payload_json=excluded.payload_json, fetched_at=excluded.fetched_at`
    ).run(flightId, JSON.stringify(payload));
}

function v2Flight(overrides = {}) {
    return {
        flight_id: "V2-1",
        id: "V2-1",
        type: "departure",
        flightNumber: "UA200",
        airline: "United",
        landingAt: "MWK",
        airport: "ORD",
        time: "10:00",
        gate: "A1",
        status: "scheduled",
        seat_price: 199,
        arriveAtReceiver: new Date(Date.now() + 72 * 3600_000).toISOString(),
        departFromReceiver: new Date(Date.now() + 74 * 3600_000).toISOString(),
        departFromSender: new Date(Date.now() + 48 * 3600_000).toISOString(),
        bookable: true,
        seat_classes: [
            { class: "economy", available: 60, priceCents: 19900 },
            { class: "first_class", available: 8, priceCents: 49900 },
        ],
        available_extras: [
            { name: "Extra legroom", costCents: 2500, costFfm: 0 },
            { name: "Lounge pass", costCents: 0, costFfm: 500 },
        ],
        ffm_credit: 100,
        ...overrides,
    };
}

describe("routes: V2 features (ffm/baggage/extras/checkin/attendant)", () => {
    beforeEach(() => {
        resetDb();
    });

    it("GET /api/me/ffm returns zeros for a new customer", async () => {
        const u = await createUser({ first_name: "Fly", last_name: "Er" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).get("/api/me/ffm").set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            ffmBalance: 0,
            lifetimeEarned: 0,
            lifetimeSpent: 0,
        });
    });

    it("GET /api/flights/:id/baggage returns pricing arrays", async () => {
        seedFlightCache("BAG1", v2Flight({ id: "BAG1", flight_id: "BAG1" }));
        const res = await request(app).get("/api/flights/BAG1/baggage");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.carryOnPrices)).toBe(true);
        expect(Array.isArray(res.body.checkedPrices)).toBe(true);
    });

    it("GET /api/flights/:id/seats includes seat classes and per-seat price", async () => {
        seedFlightCache("SEATC", v2Flight({ id: "SEATC", flight_id: "SEATC" }));
        const res = await request(app).get("/api/flights/SEATC/seats");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.seatClasses)).toBe(true);
        expect(res.body.seats[0]).toHaveProperty("class");
        expect(res.body.seats[0]).toHaveProperty("priceCents");
    });

    it("POST /api/bookings rejects flights within 36h", async () => {
        const user = await createUser({ first_name: "Close", last_name: "Booker" });
        const auth = createAuthCookie(user.id);
        const flight = v2Flight({
            id: "TOO1",
            flight_id: "TOO1",
            arriveAtReceiver: new Date(Date.now() + 10 * 3600_000).toISOString(),
        });
        seedFlightCache("TOO1", flight);
        db.prepare(
            "INSERT INTO seat_locks (flight_id, seat, session_id, locked_until) VALUES (?, ?, ?, ?)"
        ).run("TOO1", "1A", auth.sessionId, new Date(Date.now() + 600_000).toISOString());

        const res = await request(app)
            .post("/api/bookings")
            .set("Cookie", auth.header)
            .send({
                flightId: "TOO1",
                passenger: { first: "P", last: "L", dob: "1990-01-01", gender: "male", email: "p@test.local", phone: "555" },
                payment: { cardNumber: "4111111111111111", expMonth: 1, expYear: 2030, cvc: "123", cardholder: "P L", billingAddress: "A", billingZip: "1" },
                seat: "1A",
                carryOnCount: 0,
                checkedCount: 0,
            });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("BOOKING_TOO_CLOSE");
    });

    it("POST /api/bookings with extras persists ticket_extras and settles FFM", async () => {
        const user = await createUser({ first_name: "Extra", last_name: "Buyer" });
        const auth = createAuthCookie(user.id);
        db.prepare(
            "INSERT INTO frequent_flier_accounts (user_id, ffm_balance) VALUES (?, 1000)"
        ).run(user.id);
        seedFlightCache("EX1", v2Flight({ id: "EX1", flight_id: "EX1" }));
        db.prepare(
            "INSERT INTO seat_locks (flight_id, seat, session_id, locked_until) VALUES (?, ?, ?, ?)"
        ).run("EX1", "1A", auth.sessionId, new Date(Date.now() + 600_000).toISOString());

        const res = await request(app)
            .post("/api/bookings")
            .set("Cookie", auth.header)
            .send({
                flightId: "EX1",
                passenger: { first: "Pat", last: "Smith", dob: "1990-01-01", gender: "male", email: "pat@test.local", phone: "555" },
                payment: { cardNumber: "4111111111111111", expMonth: 1, expYear: 2030, cvc: "123", cardholder: "Pat Smith", billingAddress: "A", billingZip: "1" },
                seat: "1A",
                seatClass: "economy",
                extras: ["Lounge pass"],
                carryOnCount: 0,
                checkedCount: 0,
            });
        expect(res.status).toBe(201);
        const extras = db.prepare("SELECT * FROM ticket_extras WHERE ticket_id=?").all(res.body.ticketId);
        expect(extras.length).toBe(1);
        expect(extras[0].cost_ffm).toBe(500);
        // Spent 500 (lounge) then earned 100 credit => 1000 - 500 + 100 = 600
        expect(res.body.ffmBalance).toBe(600);
    });

    it("POST /api/tickets/:id/checkin blocks before the 24h window", async () => {
        seedFlightCache("CI1", v2Flight({ id: "CI1", flight_id: "CI1" }));
        db.prepare(
            `INSERT INTO tickets
             (confirmation_code, user_id, flight_id, passenger_first, passenger_last,
              passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
              carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents)
             VALUES ('CIC1', NULL, 'CI1', 'Guest', 'Last', '1990-01-01', 'male', 'g@test.local', '555', '1A', 0, 0, 10000, 0, 10000)`
        ).run();
        const id = db.prepare("SELECT id FROM tickets WHERE confirmation_code='CIC1'").get().id;
        const res = await request(app).post(`/api/tickets/${id}/checkin`).send({ lastName: "Last" });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("CHECKIN_NOT_OPEN");
    });

    it("POST /api/tickets/:id/checkin succeeds inside the window", async () => {
        seedFlightCache("CI2", v2Flight({
            id: "CI2",
            flight_id: "CI2",
            departFromReceiver: new Date(Date.now() + 5 * 3600_000).toISOString(),
            arriveAtReceiver: new Date(Date.now() + 5 * 3600_000).toISOString(),
        }));
        db.prepare(
            `INSERT INTO tickets
             (confirmation_code, user_id, flight_id, passenger_first, passenger_last,
              passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
              carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents)
             VALUES ('CIC2', NULL, 'CI2', 'Guest', 'Last', '1990-01-01', 'male', 'g@test.local', '555', '2B', 0, 0, 10000, 0, 10000)`
        ).run();
        const id = db.prepare("SELECT id FROM tickets WHERE confirmation_code='CIC2'").get().id;
        const res = await request(app).post(`/api/tickets/${id}/checkin`).send({ lastName: "Last" });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.seat).toBe("2B");
        const rec = db.prepare("SELECT * FROM checkin_records WHERE ticket_id=?").get(id);
        expect(rec).toBeTruthy();
    });

    it("POST /api/tickets/:id/cancel refunds FFM spent on extras", async () => {
        const user = await createUser({ first_name: "Refund", last_name: "Me" });
        db.prepare(
            "INSERT INTO frequent_flier_accounts (user_id, ffm_balance) VALUES (?, 0)"
        ).run(user.id);
        db.prepare(
            `INSERT INTO tickets
             (confirmation_code, user_id, flight_id, passenger_first, passenger_last,
              passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
              carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents)
             VALUES ('RF1', ?, 'RFF', 'Refund', 'Me', '1990-01-01', 'male', 'r@test.local', '555', '1A', 0, 0, 10000, 0, 10000)`
        ).run(user.id);
        const id = db.prepare("SELECT id FROM tickets WHERE confirmation_code='RF1'").get().id;
        db.prepare(
            "INSERT INTO ticket_extras (ticket_id, extra_name, cost_cents, cost_ffm) VALUES (?, 'Lounge', 0, 300)"
        ).run(id);
        const auth = createAuthCookie(user.id);

        const res = await request(app).post(`/api/tickets/${id}/cancel`).set("Cookie", auth.header).send({});
        expect(res.status).toBe(200);
        expect(res.body.ffmBalance).toBe(300);
    });

    it("attendant can book and list tickets for their own airline", async () => {
        const att = await createUser({ type: "customer", user_type: "attendant", first_name: "Att", last_name: "Endant" });
        db.prepare(
            "INSERT INTO attendant_assignments (attendant_id, airline) VALUES (?, 'United')"
        ).run(att.id);
        const auth = createAuthCookie(att.id);
        seedFlightCache("AT1", v2Flight({ id: "AT1", flight_id: "AT1", airline: "United" }));

        const book = await request(app)
            .post("/api/attendant/tickets")
            .set("Cookie", auth.header)
            .send({
                flightId: "AT1",
                passenger: { first: "Crew", last: "Guest", dob: "1990-01-01", gender: "male", email: "c@test.local", phone: "555" },
                seat: "3C",
                carryOnCount: 0,
                checkedCount: 0,
            });
        expect(book.status).toBe(201);

        const list = await request(app)
            .get("/api/attendant/flights/AT1/tickets")
            .set("Cookie", auth.header);
        expect(list.status).toBe(200);
        expect(list.body.total).toBe(1);
        expect(list.body.items[0].seat).toBe("3C");
    });

    it("attendant cannot book for a different airline", async () => {
        const att = await createUser({ type: "customer", user_type: "attendant", first_name: "Att2", last_name: "Endant2" });
        db.prepare(
            "INSERT INTO attendant_assignments (attendant_id, airline) VALUES (?, 'Delta')"
        ).run(att.id);
        const auth = createAuthCookie(att.id);
        seedFlightCache("AT2", v2Flight({ id: "AT2", flight_id: "AT2", airline: "United" }));

        const res = await request(app)
            .post("/api/attendant/tickets")
            .set("Cookie", auth.header)
            .send({
                flightId: "AT2",
                passenger: { first: "Crew", last: "Guest", dob: "1990-01-01", gender: "male", email: "c@test.local", phone: "555" },
                seat: "3C",
                carryOnCount: 0,
                checkedCount: 0,
            });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("AIRLINE_MISMATCH");
    });
});
