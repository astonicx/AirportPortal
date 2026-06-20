/**
 * Additional unit tests for server/utils/password.js
 *
 * The existing password.test.mjs (server/utils/) already covers:
 *   - hashPassword produces unique salted Argon2id hashes
 *   - verifyPassword true/false against a real hash
 *   - passwordPolicy: ≤10 chars is weak, 11 is ok, 18 is strong
 *
 * This file covers the gaps:
 *   - hashPassword error paths (empty string, non-string types)
 *   - verifyPassword with invalid argument types
 *   - passwordPolicy exact boundary values and falsy inputs
 */
import { describe, it, expect } from "vitest";
import {
    hashPassword,
    verifyPassword,
    passwordPolicy,
} from "../../../../server/utils/password.js";

// ── hashPassword error paths ──────────────────────────────────────────────────

describe("hashPassword – invalid inputs", () => {
    it("throws on empty string", async () => {
        await expect(hashPassword("")).rejects.toThrow();
    });

    it("throws when passed a number", async () => {
        // @ts-expect-error intentional wrong type
        await expect(hashPassword(12345)).rejects.toThrow();
    });

    it("throws when passed null", async () => {
        // @ts-expect-error intentional wrong type
        await expect(hashPassword(null)).rejects.toThrow();
    });

    it("throws when passed undefined", async () => {
        // @ts-expect-error intentional wrong type
        await expect(hashPassword(undefined)).rejects.toThrow();
    });

    it("throws when passed an object", async () => {
        // @ts-expect-error intentional wrong type
        await expect(hashPassword({})).rejects.toThrow();
    });
});

// ── verifyPassword error paths ────────────────────────────────────────────────

describe("verifyPassword – invalid argument types", () => {
    it("returns false when plain is null", async () => {
        // @ts-expect-error intentional wrong type
        expect(await verifyPassword(null, "some-hash")).toBe(false);
    });

    it("returns false when plain is a number", async () => {
        // @ts-expect-error intentional wrong type
        expect(await verifyPassword(99, "some-hash")).toBe(false);
    });

    it("returns false when hash is null", async () => {
        // @ts-expect-error intentional wrong type
        expect(await verifyPassword("password", null)).toBe(false);
    });

    it("returns false when hash is undefined", async () => {
        // @ts-expect-error intentional wrong type
        expect(await verifyPassword("password", undefined)).toBe(false);
    });

    it("returns false when hash is not a valid PHC string", async () => {
        // A random non-PHC string should not throw – just return false
        expect(await verifyPassword("password", "not-a-real-argon2-hash")).toBe(false);
    });

    it("returns false for the correct password against a DIFFERENT user's hash", async () => {
        const hashA = await hashPassword("PasswordForUserA!1");
        expect(await verifyPassword("PasswordForUserA!1", hashA)).toBe(true);
        // The same password must NOT verify against a hash produced from a different input
        const hashB = await hashPassword("PasswordForUserB!2");
        expect(await verifyPassword("PasswordForUserA!1", hashB)).toBe(false);
    });
});

// ── passwordPolicy exact boundaries ──────────────────────────────────────────

describe("passwordPolicy – boundary values", () => {
    // Requirement 7: weak = ≤10 chars, strong = ≥18 chars, medium in between.

    it("empty string is weak with ok=false", () => {
        const r = passwordPolicy("");
        expect(r.ok).toBe(false);
        expect(r.level).toBe("weak");
        expect(typeof r.reason).toBe("string");
    });

    it("null is treated as weak (coerced to empty)", () => {
        // @ts-expect-error intentional wrong type
        expect(passwordPolicy(null).ok).toBe(false);
    });

    it("undefined is treated as weak", () => {
        // @ts-expect-error intentional wrong type
        expect(passwordPolicy(undefined).ok).toBe(false);
    });

    it("exactly 10 characters is weak", () => {
        const r = passwordPolicy("a".repeat(10));
        expect(r.ok).toBe(false);
        expect(r.level).toBe("weak");
    });

    it("exactly 11 characters is medium (first acceptable length)", () => {
        const r = passwordPolicy("a".repeat(11));
        expect(r.ok).toBe(true);
        expect(r.level).toBe("medium");
        expect(r.reason).toBeNull();
    });

    it("exactly 17 characters is still medium", () => {
        const r = passwordPolicy("a".repeat(17));
        expect(r.ok).toBe(true);
        expect(r.level).toBe("medium");
    });

    it("exactly 18 characters is strong (first strong length)", () => {
        const r = passwordPolicy("a".repeat(18));
        expect(r.ok).toBe(true);
        expect(r.level).toBe("strong");
        expect(r.reason).toBeNull();
    });

    it("100 character password is strong", () => {
        expect(passwordPolicy("a".repeat(100)).level).toBe("strong");
    });

    it("reason field is null for medium passwords", () => {
        expect(passwordPolicy("a".repeat(15)).reason).toBeNull();
    });

    it("reason field is a non-empty string for weak passwords", () => {
        const r = passwordPolicy("short");
        expect(r.reason).toBeTruthy();
    });
});
