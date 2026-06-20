/**
 * Additional unit tests for server/utils/pricing.js
 *
 * The existing pricing.test.mjs (server/utils/) already covers:
 *   - bagFees: 0/0, 1/0, 2/0, 0/1, 0/2, 0/3, 0/4, 2/5 (single-dimension combos)
 *   - confirmationCode: 8-char uppercase regex match
 *
 * This file covers the gaps:
 *   - Mixed carry-on + checked combinations not tested
 *   - confirmationCode character-set exclusions (no I/O/1/0)
 *   - confirmationCode length is always exactly 8
 *   - confirmationCode uniqueness across consecutive calls
 */
import { describe, it, expect } from "vitest";
import { bagFees, confirmationCode } from "../../../../server/utils/pricing.js";

// ── bagFees – mixed combinations ──────────────────────────────────────────────

describe("bagFees – mixed carry-on and checked combinations", () => {
    // Competition rule: first carry-on free, second = $30
    //                   first checked free, second = $50, each extra = $100

    it("bagFees(2, 1) = 30  – two carry-on, one checked (only carry-on fee)", () => {
        expect(bagFees(2, 1)).toBe(30);
    });

    it("bagFees(2, 2) = 80  – two carry-on, two checked (30 + 50)", () => {
        expect(bagFees(2, 2)).toBe(80);
    });

    it("bagFees(2, 3) = 180 – two carry-on, three checked (30 + 50 + 100)", () => {
        expect(bagFees(2, 3)).toBe(180);
    });

    it("bagFees(2, 4) = 280 – two carry-on, four checked (30 + 50 + 200)", () => {
        expect(bagFees(2, 4)).toBe(280);
    });

    it("bagFees(1, 2) = 50  – one carry-on free, two checked ($50)", () => {
        expect(bagFees(1, 2)).toBe(50);
    });

    it("bagFees(1, 3) = 150 – one carry-on free, three checked (50+100)", () => {
        expect(bagFees(1, 3)).toBe(150);
    });

    it("bagFees(1, 5) = 350 – one carry-on free, five checked (50+100+100+100)", () => {
        expect(bagFees(1, 5)).toBe(350);
    });

    it("bagFees(0, 5) = 350 – no carry-on, five checked bags", () => {
        expect(bagFees(0, 5)).toBe(350);
    });
});

// ── confirmationCode – character-set and structural guarantees ────────────────

describe("confirmationCode – character-set exclusions", () => {
    // The alphabet used is "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    // Excluded: I, O, 1, 0 (visually ambiguous characters)

    it("never contains visually ambiguous characters (I, O, 1, 0)", () => {
        // Run 200 times to make a false negative statistically impossible
        const all = Array.from({ length: 200 }, () => confirmationCode()).join("");
        expect(all).not.toMatch(/[IO10]/);
    });

    it("every code is exactly 8 characters long", () => {
        for (let i = 0; i < 30; i++) {
            expect(confirmationCode()).toHaveLength(8);
        }
    });

    it("all characters are from the allowed uppercase+digit alphabet", () => {
        const allowed = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
        for (let i = 0; i < 30; i++) {
            expect(confirmationCode()).toMatch(allowed);
        }
    });
});

describe("confirmationCode – uniqueness", () => {
    it("two consecutive codes are almost certainly different", () => {
        // With 32^8 ≈ 10^12 possible values, collision is negligible
        const a = confirmationCode();
        const b = confirmationCode();
        expect(a).not.toBe(b);
    });

    it("100 generated codes have no duplicates", () => {
        const codes = Array.from({ length: 100 }, () => confirmationCode());
        expect(new Set(codes).size).toBe(100);
    });
});
