import { describe, it, expect } from "vitest";
import { bagFees, confirmationCode } from "./pricing.js";

describe("bagFees", () => {
    it("0 bags free", () => expect(bagFees(0, 0)).toBe(0));
    it("1 carry-on free", () => expect(bagFees(1, 0)).toBe(0));
    it("2 carry-on = 30", () => expect(bagFees(2, 0)).toBe(30));
    it("1 checked free", () => expect(bagFees(0, 1)).toBe(0));
    it("2 checked = 50", () => expect(bagFees(0, 2)).toBe(50));
    it("3 checked = 150", () => expect(bagFees(0, 3)).toBe(150));
    it("4 checked = 250", () => expect(bagFees(0, 4)).toBe(250));
    it("max bags = 30 + 50 + 100*3", () => expect(bagFees(2, 5)).toBe(30 + 50 + 300));
});

describe("confirmationCode", () => {
    it("returns 8-char uppercase code", () => {
        const c = confirmationCode();
        expect(c).toMatch(/^[A-Z2-9]{8}$/);
    });
});
