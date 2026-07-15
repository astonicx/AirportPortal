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

function extractSid(setCookieHeader) {
    const sidCookie = (setCookieHeader || []).find((c) => c.startsWith("sid="));
    if (!sidCookie) return null;
    return sidCookie.split(";")[0].slice("sid=".length);
}

describe("authentication + authorization comprehensive coverage", () => {
    beforeEach(() => {
        resetDb();
    });

    describe("login", () => {
        it("valid login issues session cookie and accesses protected route", async () => {
            await createUser({
                first_name: "Valid",
                last_name: "Login",
                email: "valid.login@test.local",
                password: "StrongPassword123",
                must_change_password: 0,
                must_complete_profile: 0,
            });

            const loginRes = await request(app).post("/api/auth/login").send({
                email: "valid.login@test.local",
                password: "StrongPassword123",
                rememberMe: false,
            });

            expect(loginRes.status).toBe(200);
            expect(loginRes.body.ok).toBe(true);

            const sid = extractSid(loginRes.headers["set-cookie"]);
            expect(typeof sid).toBe("string");

            // Current auth token format is sid=id.token (not JWT's three-part format).
            expect(sid.split(".").length).toBe(2);

            const protectedRes = await request(app)
                .get("/api/me/dashboard")
                .set("Cookie", `sid=${sid}`);
            expect(protectedRes.status).toBe(200);
        });

        it("invalid login is rejected", async () => {
            await createUser({
                first_name: "Invalid",
                last_name: "Login",
                email: "invalid.login@test.local",
                password: "StrongPassword123",
            });

            const res = await request(app).post("/api/auth/login").send({
                email: "invalid.login@test.local",
                password: "WrongPassword123",
            });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe("Invalid credentials");
        });
    });

    describe("token/session failures", () => {
        it("missing token returns 401 on protected route", async () => {
            const res = await request(app).get("/api/me/dashboard");
            expect(res.status).toBe(401);
            expect(res.body.error).toBe("Auth required");
        });

        it("malformed token (no delimiter) returns 401", async () => {
            const res = await request(app)
                .get("/api/me/dashboard")
                .set("Cookie", "sid=not_a_valid_token");
            expect(res.status).toBe(401);
            expect(res.body.error).toBe("Auth required");
        });

        it("malformed token (hash mismatch) returns 401", async () => {
            const u = await createUser({
                first_name: "Malformed",
                last_name: "Hash",
                password: "StrongPassword123",
            });
            const auth = createAuthCookie(u.id);

            const res = await request(app)
                .get("/api/me/dashboard")
                .set("Cookie", `sid=${auth.sessionId}.definitelywrongtoken`);
            expect(res.status).toBe(401);
            expect(res.body.error).toBe("Auth required");
        });

        it("expired token returns 401", async () => {
            const u = await createUser({
                first_name: "Expired",
                last_name: "Token",
                password: "StrongPassword123",
            });
            const auth = createAuthCookie(u.id);

            db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 minute') WHERE id = ?").run(auth.sessionId);

            const res = await request(app)
                .get("/api/me/dashboard")
                .set("Cookie", auth.header);
            expect(res.status).toBe(401);
            expect(res.body.error).toBe("Auth required");
        });

        it("revoked token via logout can no longer access protected routes", async () => {
            const u = await createUser({
                first_name: "Revoked",
                last_name: "Token",
                password: "StrongPassword123",
            });
            const auth = createAuthCookie(u.id);

            const before = await request(app)
                .get("/api/me/dashboard")
                .set("Cookie", auth.header);
            expect(before.status).toBe(200);

            const logout = await request(app)
                .post("/api/auth/logout")
                .set("Cookie", auth.header);
            expect(logout.status).toBe(200);
            expect(logout.body.ok).toBe(true);

            const row = db.prepare("SELECT id FROM sessions WHERE id = ?").get(auth.sessionId);
            expect(row).toBeUndefined();

            const after = await request(app)
                .get("/api/me/dashboard")
                .set("Cookie", auth.header);
            expect(after.status).toBe(401);
            expect(after.body.error).toBe("Auth required");
        });
    });

    describe("authorization middleware (roles)", () => {
        it("customer is forbidden from admin routes", async () => {
            const customer = await createUser({ type: "customer", first_name: "Cust", last_name: "User" });
            const auth = createAuthCookie(customer.id);

            const res = await request(app)
                .get("/api/admin/stats")
                .set("Cookie", auth.header);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe("Admin only");
        });

        it("admin can access admin routes but is forbidden from root-only routes", async () => {
            const admin = await createUser({ type: "admin", first_name: "Admin", last_name: "User" });
            const auth = createAuthCookie(admin.id);

            const adminRoute = await request(app)
                .get("/api/admin/stats")
                .set("Cookie", auth.header);
            expect(adminRoute.status).toBe(200);

            const rootOnly = await request(app)
                .get("/api/admin/admins")
                .set("Cookie", auth.header);
            expect(rootOnly.status).toBe(403);
            expect(rootOnly.body.error).toBe("Root only");
        });

        it("root can access root-only routes", async () => {
            const root = await createUser({ type: "root", first_name: "Root", last_name: "User" });
            const auth = createAuthCookie(root.id);

            const res = await request(app)
                .get("/api/admin/admins")
                .set("Cookie", auth.header);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe("status restrictions (completion gate)", () => {
        it("blocked-status user gets 409 on gated route", async () => {
            const user = await createUser({
                first_name: "Needs",
                last_name: "Completion",
                must_change_password: 1,
                must_complete_profile: 0,
            });
            const auth = createAuthCookie(user.id);

            const res = await request(app)
                .get("/api/me/dashboard")
                .set("Cookie", auth.header);
            expect(res.status).toBe(409);
            expect(res.body.error).toBe("Must complete profile first");
        });

        it("blocked-status user can still use allowed auth and completion endpoints", async () => {
            const user = await createUser({
                first_name: "Needs",
                last_name: "AllowedRoutes",
                must_change_password: 1,
                must_complete_profile: 1,
            });
            const auth = createAuthCookie(user.id);

            const authMe = await request(app)
                .get("/api/auth/me")
                .set("Cookie", auth.header);
            expect(authMe.status).toBe(200);

            const complete = await request(app)
                .post("/api/me/complete")
                .set("Cookie", auth.header)
                .send({ profile: { city: "Milwaukee", country: "USA" } });
            expect(complete.status).toBe(200);
            expect(complete.body.ok).toBe(true);
        });
    });
});
