"use strict";

const express = require("express");
const cookieParser = require("cookie-parser");
const { db, runMigrations } = require("../../../server/db");
const requestId = require("../../../server/middleware/requestId");
const errorHandler = require("../../../server/middleware/errorHandler");
const { attachUser } = require("../../../server/middleware/auth");
const bookingSession = require("../../../server/middleware/bookingSession");
const completionGate = require("../../../server/middleware/completionGate");
const { issueSession, COOKIE } = require("../../../server/utils/session");
const { hashPassword } = require("../../../server/utils/password");

let app;
let initialized = false;

function initApp() {
    if (app) return app;

    runMigrations();

    const expressApp = express();
    expressApp.use(express.json({ limit: "100kb" }));
    expressApp.use(cookieParser(process.env.SESSION_COOKIE_SECRET));
    expressApp.use(requestId);
    expressApp.use(attachUser);
    expressApp.use(bookingSession);
    expressApp.use(completionGate);

    expressApp.use("/api/health", require("../../../server/routes/health"));
    expressApp.use("/api/auth", require("../../../server/routes/auth"));
    expressApp.use("/api/flights", require("../../../server/routes/flights"));
    expressApp.use("/api/no-fly", require("../../../server/routes/noFly"));
    expressApp.use("/api/bookings", require("../../../server/routes/bookings"));
    expressApp.use("/api/tickets", require("../../../server/routes/tickets"));
    expressApp.use("/api/me", require("../../../server/routes/me"));
    expressApp.use("/api/attendant", require("../../../server/routes/attendant"));
    expressApp.use("/api/admin/admins", require("../../../server/routes/adminRoot"));
    expressApp.use("/api/admin", require("../../../server/routes/admin"));

    expressApp.use(errorHandler);

    app = expressApp;
    initialized = true;
    return app;
}

function getApp() {
    if (!initialized) return initApp();
    return app;
}

function resetDb() {
    runMigrations();
    db.exec("PRAGMA foreign_keys = OFF");
    const tables = [
        "admin_audit",
        "airline_bans",
        "airline_restrictions",
        "frequent_flier_accounts",
        "ticket_extras",
        "attendant_assignments",
        "checkin_records",
        "seat_locks",
        "tickets",
        "saved_cards",
        "sessions",
        "security_questions",
        "user_lockouts",
        "user_login_audit",
        "flight_cache",
        "users",
    ];
    for (const t of tables) {
        db.prepare(`DELETE FROM ${t}`).run();
    }
    db.prepare("DELETE FROM sqlite_sequence").run();
    db.exec("PRAGMA foreign_keys = ON");
}

async function createUser(overrides = {}) {
    const user = {
        type: "customer",
        first_name: "Test",
        last_name: "User",
        dob: null,
        email: `user_${Date.now()}_${Math.random().toString(16).slice(2)}@test.local`,
        password: "StrongPassword123",
        must_change_password: 0,
        must_complete_profile: 0,
        auto_logout_minutes: 15,
        ...overrides,
    };
    // Legacy `type` is CHECK-constrained to customer/admin/root; the V2 role
    // lives in `user_type` and may also be 'attendant'/'guest'.
    const userType = user.user_type ?? user.type;
    const password_hash = await hashPassword(user.password);
    const info = db
        .prepare(
            `INSERT INTO users
             (type, first_name, last_name, dob, email, password_hash,
              must_change_password, must_complete_profile, auto_logout_minutes, user_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            user.type,
            user.first_name,
            user.last_name,
            user.dob,
            user.email,
            password_hash,
            user.must_change_password ? 1 : 0,
            user.must_complete_profile ? 1 : 0,
            user.auto_logout_minutes,
            userType
        );
    return { id: Number(info.lastInsertRowid), ...user, password_hash };
}

function createAuthCookie(userId, rememberMe = false, idleMinutes = 15) {
    const { cookieValue } = issueSession(userId, rememberMe, idleMinutes);
    const sessionId = cookieValue.split(".")[0];
    return { header: `${COOKIE}=${cookieValue}`, sessionId };
}

function insertSecurityQuestions(userId, questions) {
    const stmt = db.prepare(
        "INSERT INTO security_questions (user_id, question, answer_hash) VALUES (?, ?, ?)"
    );
    for (const q of questions) {
        stmt.run(userId, q.question, q.answer_hash);
    }
}

module.exports = {
    db,
    getApp,
    resetDb,
    createUser,
    createAuthCookie,
    insertSecurityQuestions,
};
