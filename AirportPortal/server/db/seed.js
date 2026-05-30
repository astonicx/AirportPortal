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

module.exports = { seedRoot };
