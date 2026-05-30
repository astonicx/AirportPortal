import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, passwordPolicy } from "./password.js";

describe("password", () => {
    it("hashes are unique per call", async () => {
        const a = await hashPassword("Correct horse battery staple!");
        const b = await hashPassword("Correct horse battery staple!");
        expect(a).not.toBe(b);
        expect(a.startsWith("$argon2id$")).toBe(true);
    });

    it("verifies true/false", async () => {
        const h = await hashPassword("hunter22hunter22");
        expect(await verifyPassword("hunter22hunter22", h)).toBe(true);
        expect(await verifyPassword("wrong", h)).toBe(false);
    });

    it("policy rejects ≤10", () => {
        expect(passwordPolicy("short").ok).toBe(false);
        expect(passwordPolicy("a".repeat(11)).ok).toBe(true);
        expect(passwordPolicy("a".repeat(18)).level).toBe("strong");
    });
});
