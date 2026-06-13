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

describe("routes: /api/me", () => {
    beforeEach(() => {
        resetDb();
    });

    it("GET /api/me/dashboard unauthorized returns 401", async () => {
        const res = await request(app).get("/api/me/dashboard");
        expect(res.status).toBe(401);
    });

    it("GET /api/me/dashboard authorized returns profile/upcoming/past schema", async () => {
        const u = await createUser({ first_name: "Dash", last_name: "User", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).get("/api/me/dashboard").set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(res.body.profile.id).toBe(u.id);
        expect(Array.isArray(res.body.upcoming)).toBe(true);
        expect(Array.isArray(res.body.past)).toBe(true);
    });

    it("PATCH /api/me unauthorized returns 401", async () => {
        const res = await request(app).patch("/api/me").send({ city: "X" });
        expect(res.status).toBe(401);
    });

    it("PATCH /api/me malformed returns 400", async () => {
        const u = await createUser({ first_name: "Patch", last_name: "Bad", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).patch("/api/me").set("Cookie", auth.header).send({ email: "not-email" });
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.issues)).toBe(true);
    });

    it("PATCH /api/me happy returns ok", async () => {
        const u = await createUser({ first_name: "Patch", last_name: "Good", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).patch("/api/me").set("Cookie", auth.header).send({ city: "Milwaukee", default_sort: "time" });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("DELETE /api/me unauthorized returns 401", async () => {
        const res = await request(app).delete("/api/me");
        expect(res.status).toBe(401);
    });

    it("DELETE /api/me authorized returns ok", async () => {
        const u = await createUser({ first_name: "Delete", last_name: "Me", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).delete("/api/me").set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("POST /api/me/cards unauthorized returns 401", async () => {
        const res = await request(app).post("/api/me/cards").send({});
        expect(res.status).toBe(401);
    });

    it("POST /api/me/cards happy returns 201 schema", async () => {
        const u = await createUser({ first_name: "Card", last_name: "User", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app)
            .post("/api/me/cards")
            .set("Cookie", auth.header)
            .send({
                cardNumber: "4111111111111111",
                expMonth: 1,
                expYear: 2030,
                cardholder: "Card User",
                billingAddress: "123 A",
                billingZip: "53202",
            });
        expect(res.status).toBe(201);
        expect(typeof res.body.id).toBe("number");
        expect(res.body.last4).toBe("1111");
    });

    it("GET /api/me/cards unauthorized returns 401", async () => {
        const res = await request(app).get("/api/me/cards");
        expect(res.status).toBe(401);
    });

    it("GET /api/me/cards authorized returns array", async () => {
        const u = await createUser({ first_name: "Card2", last_name: "User2", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).get("/api/me/cards").set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it("DELETE /api/me/cards/:id unauthorized returns 401", async () => {
        const res = await request(app).delete("/api/me/cards/1");
        expect(res.status).toBe(401);
    });

    it("DELETE /api/me/cards/:id authorized returns ok", async () => {
        const u = await createUser({ first_name: "Card3", last_name: "User3", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const cardId = db
            .prepare(
                `INSERT INTO saved_cards (user_id, last4, brand, exp_month, exp_year, cardholder_name, billing_address, billing_zip, token_fake)
                 VALUES (?, '1111', 'unknown', 1, 2030, 'X', 'Y', 'Z', 'fake')`
            )
            .run(u.id).lastInsertRowid;
        const res = await request(app).delete(`/api/me/cards/${cardId}`).set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("POST /api/me/claim-ticket unauthorized returns 401", async () => {
        const res = await request(app).post("/api/me/claim-ticket").send({ lastName: "A", confirmation: "B" });
        expect(res.status).toBe(401);
    });

    it("POST /api/me/claim-ticket not found returns 404", async () => {
        const u = await createUser({ first_name: "Claim", last_name: "User", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).post("/api/me/claim-ticket").set("Cookie", auth.header).send({ lastName: "None", confirmation: "NONE" });
        expect(res.status).toBe(404);
    });

    it("POST /api/me/claim-ticket already claimed returns 409", async () => {
        const owner = await createUser({ first_name: "Owner", last_name: "User", password: "StrongPassword123" });
        const other = await createUser({ first_name: "Other", last_name: "User", password: "StrongPassword123" });
        const auth = createAuthCookie(other.id);

        db.prepare(
            `INSERT INTO tickets
             (confirmation_code, user_id, flight_id, passenger_first, passenger_last, passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
              carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents)
             VALUES ('CLAIMED1', ?, 'F-CL', 'X', 'User', '1990-01-01', 'male', 'x@test.local', '555', '1A', 0, 0, 100, 0, 100)`
        ).run(owner.id);

        const res = await request(app).post("/api/me/claim-ticket").set("Cookie", auth.header).send({ lastName: "User", confirmation: "CLAIMED1" });
        expect(res.status).toBe(409);
    });

    it("POST /api/me/claim-ticket happy returns ok", async () => {
        const u = await createUser({ first_name: "Claim2", last_name: "User2", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);

        db.prepare(
            `INSERT INTO tickets
             (confirmation_code, user_id, flight_id, passenger_first, passenger_last, passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
              carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents)
             VALUES ('GUEST1', NULL, 'F-G', 'X', 'User2', '1990-01-01', 'male', 'x@test.local', '555', '1A', 0, 0, 100, 0, 100)`
        ).run();

        const res = await request(app).post("/api/me/claim-ticket").set("Cookie", auth.header).send({ lastName: "User2", confirmation: "GUEST1" });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("POST /api/me/complete unauthorized returns 401", async () => {
        const res = await request(app).post("/api/me/complete").send({});
        expect(res.status).toBe(401);
    });

    it("POST /api/me/complete malformed request returns 400", async () => {
        const u = await createUser({ first_name: "Complete", last_name: "Bad", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).post("/api/me/complete").set("Cookie", auth.header).send({ profile: "not-object" });
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.issues)).toBe(true);
    });

    it("POST /api/me/complete weak password returns 400", async () => {
        const u = await createUser({ first_name: "Complete", last_name: "Weak", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).post("/api/me/complete").set("Cookie", auth.header).send({ password: "short" });
        expect(res.status).toBe(400);
    });

    it("POST /api/me/complete happy returns ok", async () => {
        const u = await createUser({ first_name: "Complete", last_name: "Good", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).post("/api/me/complete").set("Cookie", auth.header).send({
            password: "NewStrongPassword123",
            profile: { phone: "555", city: "Milwaukee", gender: "male" },
        });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("PUT /api/me without auth returns 401 via router auth guard", async () => {
        const res = await request(app).put("/api/me").send({});
        expect(res.status).toBe(401);
    });
}
);