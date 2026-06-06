"use strict";
const { db } = require("./index");
const { hashPassword } = require("../utils/password");

async function seedRoot() {
    const email = process.env.ROOT_EMAIL;
    const pw = process.env.ROOT_PASSWORD;
    if (!email || !pw) return;
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return;
    const hash = await hashPassword(pw);
    db.prepare(
        `INSERT INTO users (type, first_name, last_name, email, password_hash)
     VALUES ('root','Root','Admin',?,?)`
    ).run(email, hash);
    console.log(`seeded root admin: ${email}`);
}

// Test accounts for each role. Login is by FIRST + LAST name + password
// (not email), so these names are what you type on the login screen.
// Passwords must be > 10 chars to satisfy the password policy.
const TEST_USERS = [
    {
        type: "admin",
        first_name: "Test",
        last_name: "Admin",
        email: "admin@portal.local",
        password: "AdminPassword123!",
    },
    {
        type: "customer",
        first_name: "Test",
        last_name: "Customer",
        email: "customer@portal.local",
        password: "CustomerPassword123!",
    },
];

// Seeds known test accounts so every role can be exercised without going
// through signup. Skipped in production to avoid shipping default creds.
async function seedTestUsers() {
    if (process.env.NODE_ENV === "production") return;
    if (process.env.SEED_TEST_USERS === "false") return;
    const insert = db.prepare(
        `INSERT INTO users (type, first_name, last_name, email, password_hash)
     VALUES (?, ?, ?, ?, ?)`
    );
    for (const u of TEST_USERS) {
        const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(u.email);
        if (existing) continue;
        const hash = await hashPassword(u.password);
        insert.run(u.type, u.first_name, u.last_name, u.email, hash);
        console.log(
            `seeded ${u.type} test user: login "${u.first_name} ${u.last_name}" / ${u.password}`
        );
    }
}

module.exports = { seedRoot, seedTestUsers };

