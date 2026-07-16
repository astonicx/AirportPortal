"use strict";

// Helpers to derive V2 flight detail fields (seat classes, baggage, extras,
// FFM credit) from an upstream flight object. All derivations fall back to
// sensible defaults so the app keeps working when the upstream omits fields.

const SEAT_CLASS_ORDER = ["economy", "economy_plus", "exit_row", "first_class"];

function centsFromMaybe(value, fallbackCents = 0) {
    if (value === undefined || value === null) return fallbackCents;
    // Upstream may send dollars (e.g. seat_price) or cents (priceCents).
    if (typeof value === "number") return Math.round(value);
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : fallbackCents;
}

// Returns an array of { class, available, priceCents }.
function seatClasses(flight) {
    const raw =
        flight.seat_classes ||
        flight.seatClasses ||
        (flight.seat_classes_json ? safeJson(flight.seat_classes_json) : null);
    if (Array.isArray(raw) && raw.length) {
        return raw.map((c) => ({
            class: c.class || c.name || "economy",
            available: Number(c.available ?? 0),
            priceCents: centsFromMaybe(
                c.priceCents ?? c.price_cents ?? c.max_price_cents ?? 0
            ),
        }));
    }
    // Default: single economy class priced from the flight seat price (dollars).
    const baseCents = Math.round((flight.seat_price ?? flight.seatPrice ?? 0) * 100);
    return [{ class: "economy", available: 90, priceCents: baseCents }];
}

// Returns { carryOnMax, carryOnPrices, checkedMax, checkedPrices } in cents.
function baggageAllowance(flight) {
    const raw =
        flight.baggage_allowance ||
        flight.baggageAllowance ||
        (flight.baggage_fees_json ? safeJson(flight.baggage_fees_json) : null);
    if (raw && (raw.carryOnPrices || raw.carry_on_prices)) {
        return {
            carryOnMax: Number(raw.carryOnMax ?? raw.carry_on_max ?? 2),
            carryOnPrices: (raw.carryOnPrices || raw.carry_on_prices || [0, 0, 3000]).map(
                (n) => centsFromMaybe(n)
            ),
            checkedMax: Number(raw.checkedMax ?? raw.checked_max ?? 5),
            checkedPrices: (
                raw.checkedPrices ||
                raw.checked_prices || [0, 0, 5000, 10000, 10000, 10000]
            ).map((n) => centsFromMaybe(n)),
        };
    }
    // Default pricing mirrors the legacy bag fee schedule ($0/$0/$30 carry-on,
    // $0/$0/$50/$100... checked) expressed in cents.
    return {
        carryOnMax: 2,
        carryOnPrices: [0, 0, 3000],
        checkedMax: 5,
        checkedPrices: [0, 0, 5000, 10000, 10000, 10000],
    };
}

// Returns an array of { name, costCents, costFfm }.
function availableExtras(flight) {
    const raw =
        flight.available_extras ||
        flight.availableExtras ||
        (flight.extras_json ? safeJson(flight.extras_json) : null);
    if (Array.isArray(raw)) {
        return raw.map((e) => ({
            name: e.name,
            costCents: centsFromMaybe(e.costCents ?? e.cost_cents ?? 0),
            costFfm: Number(e.costFfm ?? e.cost_ffm ?? 0),
        }));
    }
    return [];
}

function ffmCredit(flight) {
    return Number(flight.ffm_credit ?? flight.ffmCredit ?? 0);
}

// Sums baggage cost (cents) for the given counts using the flight's pricing.
function baggageCostCents(flight, carryOnCount = 0, checkedCount = 0) {
    const b = baggageAllowance(flight);
    const priceAt = (arr, count) => {
        if (!count) return 0;
        const idx = Math.min(count, arr.length - 1);
        return arr[idx] ?? arr[arr.length - 1] ?? 0;
    };
    return priceAt(b.carryOnPrices, carryOnCount) + priceAt(b.checkedPrices, checkedCount);
}

// Returns the price (cents) for a named seat class, or the base seat price.
function seatClassPriceCents(flight, seatClass) {
    const classes = seatClasses(flight);
    if (!seatClass) return classes[0]?.priceCents ?? 0;
    const match = classes.find(
        (c) => String(c.class).toLowerCase() === String(seatClass).toLowerCase()
    );
    return match ? match.priceCents : classes[0]?.priceCents ?? 0;
}

// Matches requested extra names against the flight's available extras.
// Returns { items: [{name, costCents, costFfm}], totalCents, totalFfm }.
function resolveExtras(flight, requestedNames = []) {
    const available = availableExtras(flight);
    const items = [];
    for (const name of requestedNames) {
        const match = available.find(
            (e) => String(e.name).toLowerCase() === String(name).toLowerCase()
        );
        if (match) items.push(match);
    }
    return {
        items,
        totalCents: items.reduce((s, e) => s + (e.costCents || 0), 0),
        totalFfm: items.reduce((s, e) => s + (e.costFfm || 0), 0),
    };
}


function safeJson(str) {
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}

module.exports = {
    SEAT_CLASS_ORDER,
    seatClasses,
    baggageAllowance,
    availableExtras,
    ffmCredit,
    baggageCostCents,
    seatClassPriceCents,
    resolveExtras,
};
