/**
 * Integration tests for server/utils/session.js
 *
 * WHY CJS (.js not .mjs):
 * session.js uses CommonJS require() internally. If this test file were ESM
 * (.mjs), Vitest would give db/index.js two separate module instances (one in
 * the ESM registry, one in the Node CJS cache). runMigrations() would create
 * tables in the ESM instance while session.js would look at the CJS instance
 * and find no tables.
 *
 * Using .js (CJS) ensures all require() calls share the same module registry,
 * so runMigrations() and session.js operate on the same in-memory database.
 *
 * DB isolation: process.env.DB_PATH = ':memory:' is set by
 * tests/setup/backend.setup.mjs before any module is loaded. Each Vitest
 * fork worker gets its own process, so each worker gets its own
 * completely separate in-memory database.
 */
"use strict";
// describe, it, expect, beforeAll, beforeEach are injected as globals by
// Vitest (globals: true in vitest.config.js). Do NOT require("vitest") —
// Vitest only ships ESM exports and would throw in a CJS context.
const { db, runMigrations } = require("../../../server/db/index.js");
const {
    issueSession,
    readCookie,
    slide,
    destroy,
    COOKIE,
} = require("../../../server/utils/session.js");

// ── One-time database and user setup ─────────────────────────────────────────

let TEST_USER_ID;

beforeAll(() => {
    runMigrations(); // creates all tables in the :memory: DB (idempotent)

    // Insert a minimal customer so sessions can reference a valid user_id.
    const result = db
        .prepare(
            `INSERT INTO users
         (type, first_name, last_name, email, password_hash)
         VALUES ('customer', 'Session', 'Tester', 'session-intg@test.local', 'placeholder-hash')`
        )
        .run();
    TEST_USER_ID = result.lastInsertRowid;
});

beforeEach(() => {
    // Wipe sessions between tests to prevent cross-test leakage.
    db.prepare("DELETE FROM sessions").run();
});

// ── issueSession ──────────────────────────────────────────────────────────────

describe("issueSession", () => {
    it("returns cookieValue in 'id.token' hex format", () => {
        const { cookieValue } = issueSession(TEST_USER_ID, false, 15);
        const parts = cookieValue.split(".");
        expect(parts).toHaveLength(2);
        expect(parts[0]).toMatch(/^[0-9a-f]+$/);
        expect(parts[1]).toMatch(/^[0-9a-f]+$/);
    });

    it("returns a future expires ISO string", () => {
        const { expires } = issueSession(TEST_USER_ID, false, 15);
        expect(new Date(expires).getTime()).toBeGreaterThan(Date.now());
    });

    it("sets expires ~15 minutes in the future when rememberMe is false", () => {
        const { expires } = issueSession(TEST_USER_ID, false, 15);
        const expiresMs = new Date(expires).getTime();
        const expected = Date.now() + 15 * 60_000;
        expect(expiresMs).toBeGreaterThan(expected - 3000);
        expect(expiresMs).toBeLessThan(expected + 5000);
    });

    it("uses a custom idleMinutes value when provided", () => {
        const { expires } = issueSession(TEST_USER_ID, false, 30);
        const expiresMs = new Date(expires).getTime();
        const expected = Date.now() + 30 * 60_000;
        expect(expiresMs).toBeGreaterThan(expected - 3000);
        expect(expiresMs).toBeLessThan(expected + 5000);
    });

    it("sets expires ~30 days in the future when rememberMe is true", () => {
        const { expires } = issueSession(TEST_USER_ID, true, 15);
        const expiresMs = new Date(expires).getTime();
        const expected = Date.now() + 30 * 24 * 60 * 60_000;
        expect(expiresMs).toBeGreaterThan(expected - 5000);
        expect(expiresMs).toBeLessThan(expected + 5000);
    });

    it("inserts a row into the sessions table", () => {
        const { cookieValue } = issueSession(TEST_USER_ID, false, 15);
        const [id] = cookieValue.split(".");
        const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
        expect(row).not.toBeNull();
        expect(row.user_id).toBe(TEST_USER_ID);
    });

    it("stores remember_me = 0 when rememberMe is false", () => {
        const { cookieValue } = issueSession(TEST_USER_ID, false, 15);
        const [id] = cookieValue.split(".");
        const row = db.prepare("SELECT remember_me FROM sessions WHERE id = ?").get(id);
        expect(row.remember_me).toBe(0);
    });

    it("stores remember_me = 1 when rememberMe is true", () => {
        const { cookieValue } = issueSession(TEST_USER_ID, true, 15);
        const [id] = cookieValue.split(".");
        const row = db.prepare("SELECT remember_me FROM sessions WHERE id = ?").get(id);
        expect(row.remember_me).toBe(1);
    });

    it("stores a SHA-256 hash of the token, NOT the plaintext token", () => {
        const { cookieValue } = issueSession(TEST_USER_ID, false, 15);
        const [id, tok] = cookieValue.split(".");
        const row = db.prepare("SELECT token_hash FROM sessions WHERE id = ?").get(id);
        expect(row.token_hash).not.toBe(tok);
        // SHA-256 hex = exactly 64 chars
        expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("each call produces a unique session id", () => {
        const a = issueSession(TEST_USER_ID, false, 15);
        const b = issueSession(TEST_USER_ID, false, 15);
        const [idA] = a.cookieValue.split(".");
        const [idB] = b.cookieValue.split(".");
        expect(idA).not.toBe(idB);
    });
});

// ── readCookie ────────────────────────────────────────────────────────────────

describe("readCookie", () => {
    it("returns null when the cookie is absent", () => {
        expect(readCookie({ cookies: {} })).toBeNull();
    });

    it("returns null when the cookie has no dot separator", () => {
        expect(readCookie({ cookies: { [COOKIE]: "nodotanywhere" } })).toBeNull();
    });

    it("returns null when the session id does not exist in the database", () => {
        expect(readCookie({ cookies: { [COOKIE]: "deadbeef.cafebabe" } })).toBeNull();
    });

    it("returns null when the token part has been tampered", () => {
        const { cookieValue } = issueSession(TEST_USER_ID, false, 15);
        const [id] = cookieValue.split(".");
        const req = { cookies: { [COOKIE]: `${id}.tamperedtoken` } };
        expect(readCookie(req)).toBeNull();
    });

    it("returns null for an expired session", () => {
        const pastExpiry = new Date(Date.now() - 60_000).toISOString();
        // token_hash must be exactly 64 hex chars to satisfy timingSafeEqual
        const fakeHash = "f".repeat(64);
        db.prepare(
            `INSERT INTO sessions (id, user_id, token_hash, remember_me, expires_at)
             VALUES ('expiredid001', ?, ?, 0, ?)`
        ).run(TEST_USER_ID, fakeHash, pastExpiry);

        expect(readCookie({ cookies: { [COOKIE]: "expiredid001.sometoken" } })).toBeNull();
    });

    it("returns the session row for a valid unexpired cookie", () => {
        const { cookieValue } = issueSession(TEST_USER_ID, false, 15);
        const session = readCookie({ cookies: { [COOKIE]: cookieValue } });
        expect(session).not.toBeNull();
        expect(session.user_id).toBe(TEST_USER_ID);
    });

    it("returned session has an id matching the cookie's id segment", () => {
        const { cookieValue } = issueSession(TEST_USER_ID, false, 15);
        const [expectedId] = cookieValue.split(".");
        const session = readCookie({ cookies: { [COOKIE]: cookieValue } });
        expect(session.id).toBe(expectedId);
    });
});

// ── slide ─────────────────────────────────────────────────────────────────────

describe("slide", () => {
    it("updates expires_at for a non-remember-me session", () => {
        const { cookieValue } = issueSession(TEST_USER_ID, false, 15);
        const [id] = cookieValue.split(".");
        const before = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);

        // Slide to 5 minutes (different from initial 15) so the change is detectable
        slide(before, 5);

        const after = db.prepare("SELECT expires_at FROM sessions WHERE id = ?").get(id);
        const expiresAfterMs = new Date(after.expires_at).getTime();
        const expected = Date.now() + 5 * 60_000;

        expect(expiresAfterMs).toBeGreaterThan(expected - 3000);
        expect(expiresAfterMs).toBeLessThan(expected + 5000);
    });

    it("uses 15-minute default when idleMinutes is not supplied", () => {
        const { cookieValue } = issueSession(TEST_USER_ID, false, 1);
        const [id] = cookieValue.split(".");
        const sessionRow = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);

        slide(sessionRow); // no idleMinutes → defaults to 15

        const updated = db.prepare("SELECT expires_at FROM sessions WHERE id = ?").get(id);
        const expiresMs = new Date(updated.expires_at).getTime();
        const expected = Date.now() + 15 * 60_000;

        expect(expiresMs).toBeGreaterThan(expected - 3000);
        expect(expiresMs).toBeLessThan(expected + 5000);
    });

    it("does NOT change expires_at for a remember-me session", () => {
        const { cookieValue } = issueSession(TEST_USER_ID, true, 15);
        const [id] = cookieValue.split(".");
        const sessionBefore = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);

        slide(sessionBefore, 5); // should be a no-op because remember_me = 1

        const sessionAfter = db.prepare("SELECT expires_at FROM sessions WHERE id = ?").get(id);
        expect(sessionAfter.expires_at).toBe(sessionBefore.expires_at);
    });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe("destroy", () => {
    it("removes the session row from the database", () => {
        const { cookieValue } = issueSession(TEST_USER_ID, false, 15);
        const [id] = cookieValue.split(".");

        expect(db.prepare("SELECT id FROM sessions WHERE id = ?").get(id)).toBeTruthy();

        destroy(id);

        expect(db.prepare("SELECT id FROM sessions WHERE id = ?").get(id)).toBeUndefined();
    });

    it("does not throw when destroying a non-existent session id", () => {
        expect(() => destroy("completely-nonexistent-session-id")).not.toThrow();
    });

    it("does not remove other sessions when one is destroyed", () => {
        const { cookieValue: cv1 } = issueSession(TEST_USER_ID, false, 15);
        const { cookieValue: cv2 } = issueSession(TEST_USER_ID, false, 15);
        const [id1] = cv1.split(".");
        const [id2] = cv2.split(".");

        destroy(id1);

        expect(db.prepare("SELECT id FROM sessions WHERE id = ?").get(id1)).toBeUndefined();
        expect(db.prepare("SELECT id FROM sessions WHERE id = ?").get(id2)).toBeTruthy();
    });
});
