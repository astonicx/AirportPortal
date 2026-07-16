"use strict";

const request = require("supertest");
const { hashPassword } = require("../../server/utils/password");
const {
    db,
    getApp,
    resetDb,
    createUser,
    createAuthCookie,
    insertSecurityQuestions,
} = require("./helpers/routeTestHarness");

const app = getApp();

function validSignup() {
    return {
        first_name: "Jane",
        last_name: "Doe",
        dob: "1990-05-15",
        gender: "female",
        address1: "123 Main",
        city: "Milwaukee",
        state: "WI",
        zip: "53202",
        country: "USA",
        phone: "555-111-2222",
        email: `signup_${Date.now()}_${Math.random().toString(16).slice(2)}@test.local`,
        password: "StrongPassword123",
        captchaAnswer: "4",
        captchaExpected: "4",
        securityQuestions: [
            { question: "What is your pet name?", answer: "Fluffy" },
            { question: "Where were you born?", answer: "Chicago" },
            { question: "Favorite teacher?", answer: "Ms Smith" },
        ],
    };
}

describe("routes: auth + health + method mismatch", () => {
    beforeEach(() => {
        resetDb();
    });

    it("GET /api/health returns 200 with schema", async () => {
        const res = await request(app).get("/api/health");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("status", "ok");
        expect(typeof res.body.at).toBe("string");
    });

    it("PUT /api/health returns not found (no PUT route)", async () => {
        const res = await request(app).put("/api/health").send({});
        expect(res.status).toBe(404);
    });

    it("POST /api/auth/signup happy path returns 201 schema", async () => {
        const res = await request(app).post("/api/auth/signup").send(validSignup());
        expect(res.status).toBe(201);
        expect(res.body.ok).toBe(true);
        expect(typeof res.body.userId).toBe("number");
        expect(["weak", "medium", "strong"]).toContain(res.body.strength);
    });

    it("POST /api/auth/signup validation failure returns 400 with issues", async () => {
        const payload = validSignup();
        delete payload.first_name;
        const res = await request(app).post("/api/auth/signup").send(payload);
        expect(res.status).toBe(400);
        expect(typeof res.body.error).toBe("string");
        expect(Array.isArray(res.body.issues)).toBe(true);
    });

    it("POST /api/auth/signup captcha mismatch returns 400", async () => {
        const payload = validSignup();
        payload.captchaAnswer = "5";
        payload.captchaExpected = "4";
        const res = await request(app).post("/api/auth/signup").send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("CAPTCHA failed");
    });

    it("POST /api/auth/signup duplicate email returns 409", async () => {
        const payload = validSignup();
        await request(app).post("/api/auth/signup").send(payload);
        const res = await request(app).post("/api/auth/signup").send(payload);
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/Email already registered/i);
    });

    it("POST /api/auth/login happy path returns 200 and sets cookie", async () => {
        await createUser({
            first_name: "Anna",
            last_name: "Smith",
            email: "anna.smith@test.local",
            password: "VerySecure123",
        });
        const res = await request(app).post("/api/auth/login").send({
            email: "anna.smith@test.local",
            password: "VerySecure123",
            rememberMe: true,
        });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.user.firstName).toBe("Anna");
        expect(Array.isArray(res.headers["set-cookie"]) || !!res.headers["set-cookie"]).toBe(true);
    });

    it("POST /api/auth/login missing fields returns 400", async () => {
        const res = await request(app).post("/api/auth/login").send({ password: "x" });
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.issues)).toBe(true);
    });

    it("POST /api/auth/login wrong password returns 401", async () => {
        await createUser({
            first_name: "Amy",
            last_name: "Stone",
            email: "amy.stone@test.local",
            password: "RightPassword123",
        });
        const res = await request(app).post("/api/auth/login").send({
            email: "amy.stone@test.local",
            password: "WrongPassword",
        });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Invalid credentials");
        expect(typeof res.body.attemptsRemaining).toBe("number");
    });

    it("POST /api/auth/login unknown email returns 401", async () => {
        await createUser({ first_name: "Same", last_name: "Name", password: "StrongPass123", email: "same1@test.local" });
        const res = await request(app).post("/api/auth/login").send({
            email: "missing.user@test.local",
            password: "StrongPass123",
        });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Invalid credentials");
    });

    it("POST /api/auth/login locked user returns 423", async () => {
        const u = await createUser({
            first_name: "Lock",
            last_name: "Me",
            email: "lock.me@test.local",
            password: "StrongPass123",
        });
        const lockedUntil = new Date(Date.now() + 3600_000).toISOString();
        db.prepare("INSERT INTO user_lockouts (user_id, locked_until, failed_count) VALUES (?, ?, ?)").run(u.id, lockedUntil, 3);
        const res = await request(app).post("/api/auth/login").send({
            email: "lock.me@test.local",
            password: "StrongPass123",
        });
        expect(res.status).toBe(423);
        expect(res.body.error).toBe("Locked");
    });

    it("POST /api/auth/logout returns 200 even without auth", async () => {
        const res = await request(app).post("/api/auth/logout").send({});
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it("GET /api/auth/me unauthorized returns 401", async () => {
        const res = await request(app).get("/api/auth/me");
        expect(res.status).toBe(401);
    });

    it("GET /api/auth/me authorized returns schema", async () => {
        const u = await createUser({ first_name: "Me", last_name: "User", password: "StrongPass123" });
        const auth = createAuthCookie(u.id);
        const res = await request(app).get("/api/auth/me").set("Cookie", auth.header);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(u.id);
        expect(res.body.firstName).toBe("Me");
        expect(res.body).toHaveProperty("lastLoginIp");
    });

    it("POST /api/auth/recover/init not found returns 404", async () => {
        const res = await request(app).post("/api/auth/recover/init").send({
            email: "none.nobody@test.local",
        });
        expect(res.status).toBe(404);
    });

    it("POST /api/auth/recover/init malformed returns 400", async () => {
        const res = await request(app).post("/api/auth/recover/init").send({ firstName: "x" });
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.issues)).toBe(true);
    });

    it("POST /api/auth/recover/init happy returns questions", async () => {
        const u = await createUser({ first_name: "Rec", last_name: "User", dob: "1990-01-01", email: "rec.user@test.local" });
        const a1 = await hashPassword("blue");
        const a2 = await hashPassword("dog");
        const a3 = await hashPassword("tree");
        insertSecurityQuestions(u.id, [
            { question: "Q1", answer_hash: a1 },
            { question: "Q2", answer_hash: a2 },
            { question: "Q3", answer_hash: a3 },
        ]);

        const res = await request(app).post("/api/auth/recover/init").send({
            email: "rec.user@test.local",
        });
        expect(res.status).toBe(200);
        expect(res.body.userId).toBe(u.id);
        expect(Array.isArray(res.body.questions)).toBe(true);
        expect(res.body.questions.length).toBe(3);
    });

    it("POST /api/auth/recover/answer mismatch count returns 400", async () => {
        const u = await createUser({ first_name: "Ans", last_name: "Mismatch", dob: "1991-01-01" });
        const a1 = await hashPassword("a");
        const a2 = await hashPassword("b");
        insertSecurityQuestions(u.id, [
            { question: "Q1", answer_hash: a1 },
            { question: "Q2", answer_hash: a2 },
        ]);
        const res = await request(app).post("/api/auth/recover/answer").send({ userId: u.id, answers: ["a", "b", "c"] });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Answers mismatch");
    });

    it("POST /api/auth/recover/answer wrong answers returns 401", async () => {
        const u = await createUser({ first_name: "Ans", last_name: "Wrong", dob: "1991-01-02" });
        const a1 = await hashPassword("aa");
        const a2 = await hashPassword("bb");
        const a3 = await hashPassword("cc");
        insertSecurityQuestions(u.id, [
            { question: "Q1", answer_hash: a1 },
            { question: "Q2", answer_hash: a2 },
            { question: "Q3", answer_hash: a3 },
        ]);
        const res = await request(app).post("/api/auth/recover/answer").send({ userId: u.id, answers: ["x", "y", "z"] });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Recovery failed");
    });

    it("POST /api/auth/recover/reset invalid token returns 400", async () => {
        const res = await request(app).post("/api/auth/recover/reset").send({
            resetToken: "abcabcabcabc",
            newPassword: "StrongPassword123",
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid or expired token/);
    });

    it("POST /api/auth/recover/reset weak password returns 400", async () => {
        const res = await request(app).post("/api/auth/recover/reset").send({
            resetToken: "toktoktoktok",
            newPassword: "short",
        });
        expect(res.status).toBe(400);
    });

    it("POST /api/auth/recover/reset happy path returns 200", async () => {
        const u = await createUser({ first_name: "Flow", last_name: "Reset", dob: "1992-01-01" });
        const a1 = await hashPassword("red");
        const a2 = await hashPassword("green");
        const a3 = await hashPassword("blue");
        insertSecurityQuestions(u.id, [
            { question: "Q1", answer_hash: a1 },
            { question: "Q2", answer_hash: a2 },
            { question: "Q3", answer_hash: a3 },
        ]);

        const ans = await request(app).post("/api/auth/recover/answer").send({
            userId: u.id,
            answers: ["red", "green", "blue"],
        });
        expect(ans.status).toBe(200);
        expect(typeof ans.body.resetToken).toBe("string");

        const reset = await request(app).post("/api/auth/recover/reset").send({
            resetToken: ans.body.resetToken,
            newPassword: "NewStrongPassword123",
        });
        expect(reset.status).toBe(200);
        expect(reset.body.ok).toBe(true);
    });

    it("POST /api/auth/recover/reset malformed request returns 400", async () => {
        const res = await request(app).post("/api/auth/recover/reset").send({ resetToken: 123 });
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.issues)).toBe(true);
    });
}
);