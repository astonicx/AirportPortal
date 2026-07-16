"use strict";
const router = require("express").Router();
const api = require("../utils/apiClient");
const { getCached, putCached } = require("../utils/cache");
const { db } = require("../db");
const { SEATS } = require("../utils/seats");

// The airport this portal serves. A flight is bookable here only when it is
// landing at this airport, i.e. `landingAt === HOME_AIRPORT`. The upstream
// `type` field is NOT authoritative for this (a flight landing here can be
// tagged either "arrival" or "departure"), so we always match on `landingAt`.
const HOME_AIRPORT = (process.env.HOME_AIRPORT || "").trim();
const landsAtHome = (f) => !HOME_AIRPORT || f.landingAt === HOME_AIRPORT;

const SORTABLE = new Set([
    "flightNumber",
    "airline",
    "airport",
    "city",
    "time",
    "gate",
]);
const LOCK_MIN = 10;

function sortFlights(list, sortBy, sortDir) {
    if (!SORTABLE.has(sortBy)) return list;
    const dir = sortDir === "desc" ? -1 : 1;
    const key = sortBy === "time" ? "timeMs" : sortBy;
    return [...list].sort((a, b) => {
        const av = a[key] ?? "";
        const bv = b[key] ?? "";
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
    });
}

// Map an upstream flight object to the shape the UI table renders.
// Upstream uses comingFrom/landingAt/departingTo and epoch-ms timestamps;
// the table expects `airport`, `city`, and a human-readable `time`.
function normalizeFlight(f) {
    const type = f.type === "arrival" ? "arrival" : "departure";
    const arriving = type === "arrival";
    const whenMs = arriving ? f.arriveAtReceiver : f.departFromSender;
    const counterpart = arriving ? f.comingFrom : f.departingTo;
    let time = "";
    if (whenMs) {
        const d = new Date(whenMs);
        time = `${d.toLocaleDateString("en-US")} ${d.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
        })}`;
    }
    return {
        ...f,
        type,
        flight_id: f.flight_id || f.id,
        airport: counterpart || f.landingAt || "",
        city: counterpart || "",
        // Present each leg relative to OUR airport so the board matches the
        // booking page: an arrival comes FROM comingFrom and lands here
        // (landingAt); a departure leaves here (landingAt = our airport) and
        // flies TO departingTo.
        from: arriving ? (f.comingFrom || "") : (f.landingAt || ""),
        to: arriving ? (f.landingAt || "") : (f.departingTo || ""),
        // A flight can be booked here only when it lands at our airport, is
        // flagged bookable + scheduled, and arrives more than 24h from now.
        canBook:
            !!f.bookable &&
            f.status === "scheduled" &&
            landsAtHome(f) &&
            new Date(f.arriveAtReceiver || 0).getTime() > Date.now() + 24 * 3600 * 1000,
        time,
        timeMs: whenMs || 0,
        seatPrice: f.seatPrice ?? f.seat_price ?? 0,
    };
}

function matchesQuery(f, q) {
    if (!q) return true;
    const needle = q.toLowerCase();
    // Match against the values actually shown in the table (from/to are
    // normalized relative to our airport) plus flight/airline/gate.
    return ["flightNumber", "airline", "gate", "from", "to"].some((k) =>
        String(f[k] ?? "")
            .toLowerCase()
            .includes(needle)
    );
}

// ── GET /api/flights ────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
    try {
        const type = req.query.type === "arrival" ? "arrival" : "departure";
        const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
        const pageSize = Math.min(
            50,
            Math.max(1, parseInt(req.query.pageSize ?? "20", 10))
        );
        const q = (req.query.q || "").trim();
        const sortBy = req.query.sortBy || "time";
        const sortDir = req.query.sortDir === "desc" ? "desc" : "asc";

        let flights = [];
        try {
            // `sort=desc` returns the newest (currently scheduled) flights.
            // Without it the API returns the oldest flights, which are all
            // already "past"/"cancelled".
            const upstream = await api.get(
                `/v1/flights/search?type=${type}&sort=desc`
            );
            flights = upstream.flights || upstream || [];
        } catch (e) {
            // Fallback: serve from local cache if upstream is unreachable.
            flights = db
                .prepare("SELECT payload_json FROM flight_cache")
                .all()
                .map((r) => JSON.parse(r.payload_json));
        }

        for (const f of flights) putCached(f.flight_id || f.id, f);

        // The upstream `type` filter is not authoritative (it returns both
        // arrivals and departures), so filter locally as well. Flights with no
        // `type` field (e.g. seeded from local cache) pass through.
        flights = flights
            .filter((f) => !f.type || f.type === type)
            .filter((f) => f.status !== "past")
            .map(normalizeFlight)
            .filter((f) => matchesQuery(f, q));

        const sorted = sortFlights(flights, sortBy, sortDir);
        const start = (page - 1) * pageSize;
        res.json({
            page,
            pageSize,
            total: sorted.length,
            items: sorted.slice(start, start + pageSize),
        });
    } catch (e) {
        next(e);
    }
});

// ── GET /api/flights/search ─────────────────────────────────────────────────
// Booking search. Only flights LANDING at our airport (landingAt ===
// HOME_AIRPORT) may be booked. The user can optionally filter by ORIGIN (where
// the flight comes from) and the arrival DATE. Results are limited to flights
// that can actually be booked (bookable, scheduled, landing > 24h away) and
// include the seat price.
function flightOriginMatches(f, needle) {
    if (!needle) return true;
    const n = needle.toLowerCase();
    // From is always our airport now, so guests filter by DESTINATION.
    return ["departingTo", "destination", "to", "city", "state", "country", "airport"].some((k) =>
        String(f[k] ?? "")
            .toLowerCase()
            .includes(n)
    );
}

function flightDepartDate(f) {
    const ms = f.departFromReceiver || f.arriveAtReceiver;
    if (!ms) return "";
    return new Date(ms).toISOString().slice(0, 10); // YYYY-MM-DD
}

router.get("/search", async (req, res, next) => {
    try {
        const origin = (req.query.origin || req.query.destination || "").trim();
        const date = (req.query.date || "").trim();

        let flights = [];
        try {
            // The upstream `type` query param is NOT authoritative — a flight
            // landing at our airport can be tagged either "arrival" or
            // "departure". So fetch both feeds and merge/dedupe; the
            // `landsAtHome` filter below guarantees the list is scoped to our
            // home airport only. `sort=desc` returns the newest (currently
            // scheduled/bookable) flights.
            const [arr, dep] = await Promise.all([
                api.get("/v1/flights/search?type=arrival&sort=desc"),
                api.get("/v1/flights/search?type=departure&sort=desc"),
            ]);
            const merged = [
                ...(arr.flights || arr || []),
                ...(dep.flights || dep || []),
            ];
            const byId = new Map();
            for (const f of merged) byId.set(f.flight_id || f.id, f);
            flights = [...byId.values()];
        } catch (e) {
            flights = db
                .prepare("SELECT payload_json FROM flight_cache")
                .all()
                .map((r) => JSON.parse(r.payload_json));
        }

        const cutoff = Date.now() + 24 * 3600 * 1000;
        const results = flights.filter((f) => {
            // Bookable flights are the ones present at our airport (landingAt ===
            // HOME_AIRPORT) that then depart to another destination. Guests book
            // a seat on the leg DEPARTING from our airport.
            if (!landsAtHome(f)) return false;
            if (!f.bookable || f.status !== "scheduled") return false;
            const departMs = new Date(f.departFromReceiver || f.arriveAtReceiver || 0).getTime();
            if (departMs <= cutoff) return false;
            if (!flightOriginMatches(f, origin)) return false;
            if (date && flightDepartDate(f) !== date) return false;
            return true;
        });

        for (const f of results) putCached(f.flight_id || f.id, f);

        const fmtTime = (ms) => {
            if (!ms) return "";
            const d = new Date(ms);
            return `${d.toLocaleDateString("en-US")} ${d.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
            })}`;
        };

        res.json({
            total: results.length,
            items: results.map((f) => {
                // These flights depart FROM our airport (landingAt) TO departingTo.
                const destination = f.departingTo || "";
                return {
                    flight_id: f.flight_id || f.id,
                    flightNumber: f.flightNumber,
                    airline: f.airline,
                    from: f.landingAt || HOME_AIRPORT || "",
                    to: destination,
                    destination,
                    departFromReceiver: f.departFromReceiver,
                    departTime: fmtTime(f.departFromReceiver || f.arriveAtReceiver),
                    arriveAtReceiver: f.arriveAtReceiver,
                    gate: f.gate,
                    status: f.status,
                    seatPrice: f.seat_price ?? f.seatPrice ?? 0,
                };
            }),
        });
    } catch (e) {
        next(e);
    }
});

// ── GET /api/flights/home-airport ───────────────────────────────────────────
// The portal serves a single airport. The upstream feed is scoped to that
// airport by the bearer token, so every arrival's `landingAt` is our airport.
// We expose it (env override first, then derived from the feed) so the UI can
// tell guests which airport they're booking flights into. Cached in-memory.
let homeAirportCache = { code: null, at: 0 };

function deriveHomeAirport(flights) {
    const counts = {};
    for (const f of flights) {
        if (f.type !== "arrival") continue;
        const code = f.landingAt;
        if (!code) continue;
        counts[code] = (counts[code] || 0) + 1;
    }
    let best = null;
    let bestN = 0;
    for (const [code, n] of Object.entries(counts)) {
        if (n > bestN) {
            best = code;
            bestN = n;
        }
    }
    return best;
}

router.get("/home-airport", async (req, res, next) => {
    try {
        if (process.env.HOME_AIRPORT) {
            return res.json({ airport: process.env.HOME_AIRPORT });
        }
        const FRESH_MS = 5 * 60 * 1000;
        if (homeAirportCache.code && Date.now() - homeAirportCache.at < FRESH_MS) {
            return res.json({ airport: homeAirportCache.code });
        }
        let flights = [];
        try {
            const upstream = await api.get("/v1/flights/search?type=arrival&sort=desc");
            flights = upstream.flights || upstream || [];
        } catch {
            flights = db
                .prepare("SELECT payload_json FROM flight_cache")
                .all()
                .map((r) => JSON.parse(r.payload_json));
        }
        const code = deriveHomeAirport(flights);
        if (code) homeAirportCache = { code, at: Date.now() };
        res.json({ airport: code || null });
    } catch (e) {
        next(e);
    }
});

// ── GET /api/flights/:id ────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
    try {
        const cached = getCached(req.params.id);
        if (cached) return res.json(normalizeFlight(cached.payload));
        const data = await api.get(`/v1/flights/search?flight_id=${req.params.id}`);
        const flight = (data.flights || [])[0];
        if (!flight) return res.status(404).json({ error: "Flight not found" });
        putCached(req.params.id, flight);
        res.json(normalizeFlight(flight));
    } catch (e) {
        next(e);
    }
});

// ── GET /api/flights/:id/seats ──────────────────────────────────────────────
router.get("/:id/seats", (req, res) => {
    const flightId = req.params.id;
    const taken = new Set(
        db
            .prepare("SELECT seat FROM tickets WHERE flight_id=? AND status='active'")
            .all(flightId)
            .map((r) => r.seat)
    );
    db.prepare("DELETE FROM seat_locks WHERE locked_until < datetime('now')").run();
    const locks = db
        .prepare("SELECT seat, session_id FROM seat_locks WHERE flight_id=?")
        .all(flightId);
    const mySessionId = req.bookingSessionId;
    res.json({
        seats: SEATS.map((s) => {
            if (taken.has(s)) return { seat: s, state: "taken" };
            const lock = locks.find((l) => l.seat === s);
            if (lock)
                return {
                    seat: s,
                    state: lock.session_id === mySessionId ? "mine" : "locked",
                };
            return { seat: s, state: "available" };
        }),
    });
});

// ── POST /api/flights/:id/seats/lock ────────────────────────────────────────
// Requires a session: authenticated users use req.session.id; guests use the
// anonymous bsid set by the bookingSession middleware. If neither is present,
// the request is unauthenticated.
function lockSessionId(req) {
    return req.session?.id || req.bookingSessionId || null;
}

router.post("/:id/seats/lock", (req, res) => {
    const sessionId = lockSessionId(req);
    if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
    const { seat } = req.body;
    if (!SEATS.includes(seat)) {
        return res.status(400).json({ error: "Invalid seat" });
    }
    const expires = new Date(Date.now() + LOCK_MIN * 60_000).toISOString();
    db.prepare(
        "DELETE FROM seat_locks WHERE flight_id=? AND session_id=?"
    ).run(req.params.id, sessionId);
    try {
        db.prepare(
            `INSERT INTO seat_locks (flight_id, seat, session_id, locked_until)
       VALUES (?, ?, ?, ?)`
        ).run(req.params.id, seat, sessionId, expires);
        res.json({ ok: true, lockedUntil: expires });
    } catch {
        res.status(409).json({ error: "Seat already locked" });
    }
});

// ── DELETE /api/flights/:id/seats/lock ──────────────────────────────────────
router.delete("/:id/seats/lock", (req, res) => {
    const sessionId = lockSessionId(req);
    if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
    db.prepare(
        "DELETE FROM seat_locks WHERE flight_id=? AND session_id=?"
    ).run(req.params.id, sessionId);
    res.json({ ok: true });
});

module.exports = router;
