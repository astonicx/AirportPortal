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

describe("routes: /api/admin and /api/admin/admins", () => {
    beforeEach(() => {
        resetDb();
    });

    async function makeAdmin() {
        const admin = await createUser({ type: "admin", first_name: "Admin", last_name: "User", password: "StrongPassword123" });
        const auth = createAuthCookie(admin.id);
        return { admin, auth };
    }

    async function makeRoot() {
        const root = await createUser({ type: "root", first_name: "Root", last_name: "User", password: "StrongPassword123" });
        const auth = createAuthCookie(root.id);
        return { root, auth };
    }

    it("GET /api/admin/stats unauthorized returns 403", async () => {
        const res = await request(app).get("/api/admin/stats");
        expect(res.status).toBe(403);
    });

    it("GET /api/admin/stats non-admin forbidden returns 403", async () => {
        const u = await createUser({ first_name: "Cust", last_name: "User", password: "StrongPassword123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).get("/api/admin/stats").set("Cookie", auth.header);
        expect(res.status).toBe(403);
    });

    it("GET /api/admin/stats admin returns windows schema", async () => {
        const { auth } = await makeAdmin();
        const res = await request(app).get("/api/admin/stats").set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.windows)).toBe(true);
        expect(res.body.windows.length).toBe(5);
    });

    it("GET /api/admin/customers admin returns array", async () => {
        const { auth } = await makeAdmin();
        const res = await request(app).get("/api/admin/customers?q=").set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it("POST /api/admin/customers malformed returns 400", async () => {
        const { auth } = await makeAdmin();
        const res = await request(app).post("/api/admin/customers").set("Cookie", auth.header).send({ first_name: "A" });
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.issues)).toBe(true);
    });

    it("POST /api/admin/customers happy returns 201", async () => {
        const { auth } = await makeAdmin();
        const res = await request(app)
            .post("/api/admin/customers")
            .set("Cookie", auth.header)
            .send({ first_name: "C", last_name: "U", email: "newcust@test.local", password: "StrongPassword123" });
        expect(res.status).toBe(201);
        expect(typeof res.body.id).toBe("number");
    });

    it("PATCH /api/admin/customers/:id not found returns 404", async () => {
        const { auth } = await makeAdmin();
        const res = await request(app).patch("/api/admin/customers/9999").set("Cookie", auth.header).send({ city: "X" });
        expect(res.status).toBe(404);
    });

    it("PATCH /api/admin/customers/:id non-customer returns 403", async () => {
        const { auth } = await makeAdmin();
        const { root } = await makeRoot();
        const res = await request(app).patch(`/api/admin/customers/${root.id}`).set("Cookie", auth.header).send({ city: "X" });
        expect(res.status).toBe(403);
    });

    it("PATCH /api/admin/customers/:id happy returns ok", async () => {
        const { auth } = await makeAdmin();
        const cust = await createUser({ first_name: "Cust", last_name: "Edit", password: "StrongPassword123" });
        const res = await request(app).patch(`/api/admin/customers/${cust.id}`).set("Cookie", auth.header).send({ city: "Milwaukee" });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("DELETE /api/admin/customers/:id forbidden when not customer", async () => {
        const { auth } = await makeAdmin();
        const { root } = await makeRoot();
        const res = await request(app).delete(`/api/admin/customers/${root.id}`).set("Cookie", auth.header);
        expect(res.status).toBe(403);
    });

    it("DELETE /api/admin/customers/:id happy returns ok", async () => {
        const { auth } = await makeAdmin();
        const cust = await createUser({ first_name: "Cust", last_name: "Del", password: "StrongPassword123", email: "custdel@test.local" });
        const res = await request(app).delete(`/api/admin/customers/${cust.id}`).set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("GET /api/admin/tickets admin returns array", async () => {
        const { auth } = await makeAdmin();
        const res = await request(app).get("/api/admin/tickets?q=").set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it("POST /api/admin/tickets/:id/cancel not found returns 404", async () => {
        const { auth } = await makeAdmin();
        const res = await request(app).post("/api/admin/tickets/9999/cancel").set("Cookie", auth.header).send({});
        expect(res.status).toBe(404);
    });

    it("POST /api/admin/tickets/:id/cancel happy returns ok", async () => {
        const { auth } = await makeAdmin();
        db.prepare(
            `INSERT INTO tickets
             (confirmation_code, user_id, flight_id, passenger_first, passenger_last, passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
              carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents)
             VALUES ('ADMINTK1', NULL, 'F-A', 'X', 'Y', '1990-01-01', 'male', 'x@test.local', '555', '1A', 0, 0, 100, 0, 100)`
        ).run();
        const id = db.prepare("SELECT id FROM tickets WHERE confirmation_code='ADMINTK1'").get().id;
        const res = await request(app).post(`/api/admin/tickets/${id}/cancel`).set("Cookie", auth.header).send({});
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("GET /api/admin/airline-bans admin returns array", async () => {
        const { auth } = await makeAdmin();
        const res = await request(app).get("/api/admin/airline-bans").set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it("POST /api/admin/airline-bans missing fields returns 400", async () => {
        const { auth } = await makeAdmin();
        const res = await request(app).post("/api/admin/airline-bans").set("Cookie", auth.header).send({ identity: "x" });
        expect(res.status).toBe(400);
    });

    it("POST /api/admin/airline-bans happy returns 201", async () => {
        const { auth } = await makeAdmin();
        const res = await request(app).post("/api/admin/airline-bans").set("Cookie", auth.header).send({ identity: "john doe 1990-01-01", airline: "United" });
        expect(res.status).toBe(201);
        expect(typeof res.body.id).toBe("number");
    });

    it("DELETE /api/admin/airline-bans/:id returns ok", async () => {
        const { auth } = await makeAdmin();
        const id = db.prepare("INSERT INTO airline_bans (user_or_passenger_identity, airline) VALUES (?, ?)").run("x", "United").lastInsertRowid;
        const res = await request(app).delete(`/api/admin/airline-bans/${id}`).set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("GET /api/admin/admins forbidden for admin (root only)", async () => {
        const { auth } = await makeAdmin();
        const res = await request(app).get("/api/admin/admins").set("Cookie", auth.header);
        expect(res.status).toBe(403);
    });

    it("GET /api/admin/admins root returns array", async () => {
        const { auth } = await makeRoot();
        const res = await request(app).get("/api/admin/admins").set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it("POST /api/admin/admins malformed returns 400", async () => {
        const { auth } = await makeRoot();
        const res = await request(app).post("/api/admin/admins").set("Cookie", auth.header).send({ first_name: "a" });
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.issues)).toBe(true);
    });

    it("POST /api/admin/admins happy returns 201", async () => {
        const { auth } = await makeRoot();
        const res = await request(app)
            .post("/api/admin/admins")
            .set("Cookie", auth.header)
            .send({ first_name: "New", last_name: "Admin", email: "newadmin@test.local", password: "StrongPassword123" });
        expect(res.status).toBe(201);
        expect(typeof res.body.id).toBe("number");
    });

    it("PATCH /api/admin/admins/:id not found returns 404", async () => {
        const { auth } = await makeRoot();
        const res = await request(app).patch("/api/admin/admins/9999").set("Cookie", auth.header).send({ first_name: "X" });
        expect(res.status).toBe(404);
    });

    it("PATCH /api/admin/admins/:id root target returns 403", async () => {
        const { root, auth } = await makeRoot();
        const res = await request(app).patch(`/api/admin/admins/${root.id}`).set("Cookie", auth.header).send({ first_name: "X" });
        expect(res.status).toBe(403);
    });

    it("PATCH /api/admin/admins/:id happy returns ok", async () => {
        const { auth } = await makeRoot();
        const admin = await createUser({ type: "admin", first_name: "Old", last_name: "Admin", password: "StrongPassword123", email: "oldadmin@test.local" });
        const res = await request(app).patch(`/api/admin/admins/${admin.id}`).set("Cookie", auth.header).send({ first_name: "New" });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("DELETE /api/admin/admins/:id not found returns 404", async () => {
        const { auth } = await makeRoot();
        const res = await request(app).delete("/api/admin/admins/9999").set("Cookie", auth.header);
        expect(res.status).toBe(404);
    });

    it("DELETE /api/admin/admins/:id root target returns 403", async () => {
        const { root, auth } = await makeRoot();
        const res = await request(app).delete(`/api/admin/admins/${root.id}`).set("Cookie", auth.header);
        expect(res.status).toBe(403);
    });

    it("DELETE /api/admin/admins/:id happy returns ok", async () => {
        const { auth } = await makeRoot();
        const admin = await createUser({ type: "admin", first_name: "Del", last_name: "Admin", password: "StrongPassword123", email: "deladmin@test.local" });
        const res = await request(app).delete(`/api/admin/admins/${admin.id}`).set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("PUT /api/admin/customers returns 404 (no PUT route)", async () => {
        const { auth } = await makeAdmin();
        const res = await request(app).put("/api/admin/customers").set("Cookie", auth.header).send({});
        expect(res.status).toBe(404);
    });
}
);