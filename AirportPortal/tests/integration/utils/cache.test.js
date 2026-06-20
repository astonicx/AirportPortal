/**
 * Integration tests for server/utils/cache.js
 *
 * WHY CJS (.js) AND A REAL DATABASE (not mocked):
 * cache.js calls db.prepare() at the TOP of the module (not inside functions).
 * This means the database schema must exist the moment cache.js is first
 * require()'d. An ESM mock cannot reach into the CJS require() cache.
 *
 * Using CJS here guarantees that:
 *   1. All require() calls share the same module registry.
 *   2. db/index.js is loaded once, opening the :memory: DB.
 *   3. runMigrations() creates the schema (including flight_cache).
 *   4. Then cache.js is require()'d and its top-level db.prepare() calls
 *      succeed against the now-existing schema.
 *
 * Execution order in this file:
 *   a. backend.setup.mjs (setupFile) sets DB_PATH=':memory:'
 *   b. This file's require() calls resolve (db opens, cache prepares stmts)
 *   c. runMigrations() in beforeAll creates the tables
 *   BUT — because require() runs before beforeAll(), we have a chicken-and-egg
 *   problem. Solution: load db/index.js first (it just opens the file),
 *   then call runMigrations() synchronously at module top level,
 *   THEN require cache.js as a late require inside beforeAll or via a lazy
 *   require at the describe level.
 *
 * Simpler resolution: require db and run migrations BEFORE requiring cache.js,
 * using Node's synchronous module loading. In CJS we can do this with
 * a module-level call order trick shown below.
 */
"use strict";

// describe, it, expect, beforeEach are Vitest globals (globals: true in
// vitest.config.js). Do NOT require("vitest") — it only ships ESM exports.

// Step 1 – open the database (but do NOT use db.prepare yet)
const { db, runMigrations } = require("../../../server/db/index.js");

// Step 2 – run migrations synchronously so all tables are created
//           BEFORE cache.js is require()'d
runMigrations();

// Step 3 – now it is safe to require cache.js because flight_cache exists
const { getCached, putCached, pruneOlderThan } = require("../../../server/utils/cache.js");

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
    // Clear flight_cache between tests for isolation
    db.prepare("DELETE FROM flight_cache").run();
});

// ── getCached ─────────────────────────────────────────────────────────────────

describe("getCached", () => {
    it("returns null when the flight is not in the cache", () => {
        expect(getCached("UNKNOWN_FLIGHT")).toBeNull();
    });

    it("returns parsed payload and fetchedAt when a cached entry exists", () => {
        const payload = { airline: "United", flightNumber: "UA100", status: "scheduled" };
        putCached("UA100", payload); // seed via putCached

        const result = getCached("UA100");
        expect(result).not.toBeNull();
        expect(result.payload).toEqual(payload);
        expect(typeof result.fetchedAt).toBe("string");
    });

    it("returns null after the cache entry is deleted", () => {
        putCached("TMP001", { x: 1 });
        db.prepare("DELETE FROM flight_cache WHERE flight_id = ?").run("TMP001");
        expect(getCached("TMP001")).toBeNull();
    });

    it("returns the most recent payload after an overwrite", () => {
        putCached("F1", { status: "scheduled" });
        putCached("F1", { status: "boarding" }); // upsert

        const result = getCached("F1");
        expect(result.payload.status).toBe("boarding");
    });

    it("correctly parses complex nested payload objects", () => {
        const payload = {
            flight_id: "F2",
            seats: [{ seat: "1A", state: "taken" }],
            times: { depart: 1700000000000, arrive: 1700007200000 },
        };
        putCached("F2", payload);
        expect(getCached("F2").payload).toEqual(payload);
    });
});

// ── putCached ─────────────────────────────────────────────────────────────────

describe("putCached", () => {
    it("inserts a new entry that can be retrieved", () => {
        const payload = { airline: "Delta", gate: "B4" };
        putCached("DL200", payload);
        const result = getCached("DL200");
        expect(result).not.toBeNull();
        expect(result.payload).toEqual(payload);
    });

    it("upserts an existing entry without error", () => {
        putCached("F3", { status: "scheduled" });
        expect(() => putCached("F3", { status: "delayed" })).not.toThrow();
    });

    it("stores an empty-object payload", () => {
        putCached("F_EMPTY", {});
        expect(getCached("F_EMPTY").payload).toEqual({});
    });

    it("handles numeric and boolean values in the payload", () => {
        const payload = { seatPrice: 249.99, bookable: true, seats: 90 };
        putCached("F_TYPES", payload);
        expect(getCached("F_TYPES").payload).toEqual(payload);
    });

    it("stores each flight id as a separate row", () => {
        putCached("F_A", { a: 1 });
        putCached("F_B", { b: 2 });
        expect(getCached("F_A").payload).toEqual({ a: 1 });
        expect(getCached("F_B").payload).toEqual({ b: 2 });
    });
});

// ── pruneOlderThan ────────────────────────────────────────────────────────────

describe("pruneOlderThan", () => {
    it("does not throw on a call with a valid day count", () => {
        expect(() => pruneOlderThan(7)).not.toThrow();
    });

    it("removes entries older than the specified day count", () => {
        // Insert a row with fetched_at in the distant past directly
        db.prepare(
            `INSERT INTO flight_cache (flight_id, payload_json, fetched_at)
             VALUES ('OLD_FLIGHT', '{"old":true}', datetime('now', '-10 days'))`
        ).run();

        expect(getCached("OLD_FLIGHT")).not.toBeNull();

        pruneOlderThan(7); // remove anything fetched more than 7 days ago

        expect(getCached("OLD_FLIGHT")).toBeNull();
    });

    it("keeps entries newer than the specified day count", () => {
        putCached("RECENT_FLIGHT", { new: true }); // fetched_at = now

        pruneOlderThan(7);

        expect(getCached("RECENT_FLIGHT")).not.toBeNull();
    });

    it("keeps entries that are referenced by active tickets (not pruned)", () => {
        // Insert a ticket that references this flight so pruneOlderThan skips it
        const insertUser = db.prepare(
            `INSERT OR IGNORE INTO users
             (type, first_name, last_name, email, password_hash)
             VALUES ('customer','Prune','Test','prune@test.local','hash')`
        );
        const insertTicket = db.prepare(
            `INSERT INTO tickets
             (confirmation_code, flight_id, passenger_first, passenger_last,
              passenger_dob, passenger_gender, passenger_email, passenger_phone, seat)
             VALUES ('PRNTEST1', 'ACTIVE_FLIGHT', 'Prune', 'Test',
                     '1990-01-01', 'male', 'p@t.local', '555-0000', '1A')`
        );

        // Place the flight in cache with an old timestamp
        db.prepare(
            `INSERT INTO flight_cache (flight_id, payload_json, fetched_at)
             VALUES ('ACTIVE_FLIGHT', '{"status":"scheduled"}', datetime('now', '-10 days'))`
        ).run();

        insertUser.run();
        insertTicket.run();

        pruneOlderThan(7);

        // Flight is referenced by a ticket so it must survive the prune
        expect(getCached("ACTIVE_FLIGHT")).not.toBeNull();
    });
});
