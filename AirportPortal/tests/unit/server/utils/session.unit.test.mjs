/**
 * Unit tests for session.js – cookieOpts (pure function only)
 *
 * cookieOpts() is the only function in session.js that has no database
 * dependency. It is a pure transformation: given an ISO expiry string, it
 * returns the Express cookie-options object.
 *
 * The remaining session functions (issueSession, readCookie, slide, destroy)
 * require a live SQLite database. Those are tested as integration tests in
 * tests/integration/utils/session.test.mjs.
 */
import { describe, it, expect } from "vitest";
import { cookieOpts } from "../../../../server/utils/session.js";

// Use a fixed future date so tests are deterministic
const FUTURE_ISO = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

describe("cookieOpts – security properties", () => {
    it("httpOnly is true", () => {
        expect(cookieOpts(FUTURE_ISO).httpOnly).toBe(true);
    });

    it("sameSite is 'lax'", () => {
        expect(cookieOpts(FUTURE_ISO).sameSite).toBe("lax");
    });

    it("signed is false (cookie-parser signing not used)", () => {
        expect(cookieOpts(FUTURE_ISO).signed).toBe(false);
    });

    it("path is '/'", () => {
        expect(cookieOpts(FUTURE_ISO).path).toBe("/");
    });
});

describe("cookieOpts – expires field", () => {
    it("expires is a Date instance", () => {
        expect(cookieOpts(FUTURE_ISO).expires).toBeInstanceOf(Date);
    });

    it("expires Date matches the provided ISO string", () => {
        const iso = "2030-06-15T12:00:00.000Z";
        const opts = cookieOpts(iso);
        expect(opts.expires.toISOString()).toBe(new Date(iso).toISOString());
    });

    it("expires is in the future for a future ISO string", () => {
        expect(cookieOpts(FUTURE_ISO).expires.getTime()).toBeGreaterThan(Date.now());
    });

    it("returns a Date in the past when given a past ISO string", () => {
        const pastIso = new Date(Date.now() - 1000).toISOString();
        expect(cookieOpts(pastIso).expires.getTime()).toBeLessThan(Date.now());
    });
});

describe("cookieOpts – secure flag by NODE_ENV", () => {
    it("secure is false when NODE_ENV is 'test'", () => {
        const original = process.env.NODE_ENV;
        process.env.NODE_ENV = "test";
        expect(cookieOpts(FUTURE_ISO).secure).toBe(false);
        process.env.NODE_ENV = original;
    });

    it("secure is false when NODE_ENV is 'development'", () => {
        const original = process.env.NODE_ENV;
        process.env.NODE_ENV = "development";
        expect(cookieOpts(FUTURE_ISO).secure).toBe(false);
        process.env.NODE_ENV = original;
    });

    it("secure is true when NODE_ENV is 'production'", () => {
        const original = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        expect(cookieOpts(FUTURE_ISO).secure).toBe(true);
        process.env.NODE_ENV = original;
    });
});

describe("cookieOpts – shape completeness", () => {
    it("returns an object with exactly the expected keys", () => {
        const opts = cookieOpts(FUTURE_ISO);
        const keys = Object.keys(opts).sort();
        expect(keys).toEqual(["expires", "httpOnly", "path", "sameSite", "secure", "signed"].sort());
    });
});
