"use strict";
const ROWS = 18;
const COLS = ["A", "B", "C", "D", "E", "F"]; // 18 × 6 = 108 → cap at 90 below
const SEATS = Array.from({ length: ROWS }, (_, r) =>
    COLS.map((c) => `${r + 1}${c}`)
).flat();

// Trim down to exactly 90 seats per spec (drop last 18 to leave 15 rows × 6).
const NINETY = SEATS.slice(0, 90);

module.exports = { SEATS: NINETY };
