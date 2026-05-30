"use strict";
const { randomBytes, createHash, timingSafeEqual } = require("crypto");
const { db } = require("../db");

const COOKIE = "sid";

function newToken() {
    const id = randomBytes(16).toString("hex");
    const tok = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(tok).digest("hex");
    return { id, tok, hash };
}

function issueSession(userId, rememberMe, idleMinutes) {
    const { id, tok, hash } = newToken();
    const ms = rememberMe
        ? 1000 * 60 * 60 * 24 * 30
        : 1000 * 60 * (idleMinutes || 15);
    const expires = new Date(Date.now() + ms).toISOString();
    db.prepare(
        `INSERT INTO sessions (id, user_id, token_hash, remember_me, expires_at)
     VALUES (?, ?, ?, ?, ?)`
    ).run(id, userId, hash, rememberMe ? 1 : 0, expires);
    return { cookieValue: `${id}.${tok}`, expires };
}

function readCookie(req) {
    const raw = req.cookies?.[COOKIE];
    if (!raw || !raw.includes(".")) return null;
    const [id, tok] = raw.split(".");
    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
    if (!row) return null;
    const expected = Buffer.from(row.token_hash, "hex");
    const got = createHash("sha256").update(tok).digest();
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
    if (new Date(row.expires_at) < new Date()) return null;
    return row;
}

function slide(sessionRow, idleMinutes) {
    if (sessionRow.remember_me) return;
    const expires = new Date(
        Date.now() + 1000 * 60 * (idleMinutes || 15)
    ).toISOString();
    db.prepare(
        "UPDATE sessions SET last_seen_at = datetime('now'), expires_at = ? WHERE id = ?"
    ).run(expires, sessionRow.id);
}

function destroy(sessionId) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

const cookieOpts = (expires) => ({
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    signed: false,
    expires: new Date(expires),
    path: "/",
});

module.exports = { COOKIE, issueSession, readCookie, slide, destroy, cookieOpts };
