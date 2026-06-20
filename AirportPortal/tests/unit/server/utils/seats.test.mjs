/**
 * Unit tests for server/utils/seats.js
 *
 * The SEATS constant defines the exact 90-seat layout required by the
 * competition spec. Tests verify count, ordering, format, and that the
 * intentional trim (rows 16–18 removed from a potential 108-seat layout)
 * is applied correctly.
 */
import { describe, it, expect } from "vitest";
import { SEATS } from "../../../../server/utils/seats.js";

describe("SEATS constant – count", () => {
    it("contains exactly 90 seats", () => {
        expect(SEATS).toHaveLength(90);
    });
});

describe("SEATS constant – ordering and boundaries", () => {
    it("first seat is 1A", () => {
        expect(SEATS[0]).toBe("1A");
    });

    it("last seat is 15F", () => {
        expect(SEATS[89]).toBe("15F");
    });

    it("seats are in row-major order (1A, 1B, 1C, 1D, 1E, 1F, 2A, ...)", () => {
        expect(SEATS[0]).toBe("1A");
        expect(SEATS[1]).toBe("1B");
        expect(SEATS[5]).toBe("1F");
        expect(SEATS[6]).toBe("2A");
        expect(SEATS[11]).toBe("2F");
    });
});

describe("SEATS constant – format", () => {
    it("all seats match the row-number + column-letter pattern", () => {
        SEATS.forEach((seat) => {
            expect(seat).toMatch(/^\d{1,2}[A-F]$/);
        });
    });

    it("all column letters are in A–F only", () => {
        const cols = new Set(SEATS.map((s) => s.slice(-1)));
        expect([...cols].sort()).toEqual(["A", "B", "C", "D", "E", "F"]);
    });

    it("all row numbers are between 1 and 15 inclusive", () => {
        SEATS.forEach((seat) => {
            const row = parseInt(seat, 10);
            expect(row).toBeGreaterThanOrEqual(1);
            expect(row).toBeLessThanOrEqual(15);
        });
    });
});

describe("SEATS constant – uniqueness", () => {
    it("contains no duplicate seat labels", () => {
        expect(new Set(SEATS).size).toBe(90);
    });
});

describe("SEATS constant – expected rows present", () => {
    it("rows 1 through 15, columns A–F are all present", () => {
        for (let row = 1; row <= 15; row++) {
            for (const col of ["A", "B", "C", "D", "E", "F"]) {
                expect(SEATS).toContain(`${row}${col}`);
            }
        }
    });

    it("rows 16, 17, 18 are NOT present (trimmed from 108 to 90 seats)", () => {
        for (let row = 16; row <= 18; row++) {
            for (const col of ["A", "B", "C", "D", "E", "F"]) {
                expect(SEATS).not.toContain(`${row}${col}`);
            }
        }
    });
});

describe("SEATS constant – immutability guard", () => {
    it("is an array", () => {
        expect(Array.isArray(SEATS)).toBe(true);
    });

    it("can be used with Array.includes (needed by booking validation)", () => {
        expect(SEATS.includes("1A")).toBe(true);
        expect(SEATS.includes("15F")).toBe(true);
        expect(SEATS.includes("16A")).toBe(false);
        expect(SEATS.includes("0A")).toBe(false);
        expect(SEATS.includes("1G")).toBe(false);
    });
});
