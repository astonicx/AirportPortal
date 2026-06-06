"use strict";
const router = require("express").Router();
const api = require("../utils/apiClient");
const { getCached, putCached } = require("../utils/cache");
const { db } = require("../db");
const { SEATS } = require("../utils/seats");
const { requireAuth } = require("../middleware/auth");

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
        time,
        timeMs: whenMs || 0,
        seatPrice: f.seatPrice ?? f.seat_price ?? 0,
    };
}

function matchesQuery(f, q) {
    if (!q) return true;
    const needle = q.toLowerCase();
    return ["flightNumber", "airline", "airport", "city", "gate"].some((k) =>
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
        // arrivals and departures), so filter locally as well.
        flights = flights
            .filter((f) => f.type === type)
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
// Booking search: user picks where they want to ARRIVE (city/state/country/
// airport) and the departure DATE. They always depart from our airport, so we
// only search departures. Results are limited to flights that can actually be
// booked (bookable, scheduled, > 24h away) and include the seat price.
function flightDestinationMatches(f, needle) {
    if (!needle) return true;
    const n = needle.toLowerCase();
    return ["city", "state", "country", "airport", "receiver", "to"].some((k) =>
        String(f[k] ?? "")
            .toLowerCase()
            .includes(n)
    );
}

function flightDepartDate(f) {
    const d = f.departFromSender || f.departAtSender || f.time || "";
    return String(d).slice(0, 10); // YYYY-MM-DD
}

router.get("/search", async (req, res, next) => {
    try {
        const destination = (req.query.destination || "").trim();
        const date = (req.query.date || "").trim();

        let flights = [];
        try {
            const upstream = await api.get("/v1/flights/search?type=departure");
            flights = upstream.flights || upstream || [];
        } catch (e) {
            flights = db
                .prepare("SELECT payload_json FROM flight_cache")
                .all()
                .map((r) => JSON.parse(r.payload_json));
        }

        const cutoff = Date.now() + 24 * 3600 * 1000;
        const results = flights.filter((f) => {
            if (!f.bookable || f.status !== "scheduled") return false;
            if (new Date(f.arriveAtReceiver || 0).getTime() <= cutoff) return false;
            if (!flightDestinationMatches(f, destination)) return false;
            if (date && flightDepartDate(f) !== date) return false;
            return true;
        });

        for (const f of results) putCached(f.flight_id || f.id, f);

        res.json({
            total: results.length,
            items: results.map((f) => ({
                flight_id: f.flight_id || f.id,
                flightNumber: f.flightNumber,
                airline: f.airline,
                city: f.city,
                state: f.state,
                country: f.country,
                airport: f.airport,
                receiver: f.receiver,
                departFromSender: f.departFromSender,
                arriveAtReceiver: f.arriveAtReceiver,
                gate: f.gate,
                status: f.status,
                seatPrice: f.seat_price ?? f.seatPrice ?? 0,
            })),
        });
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
    const mySessionId = req.session?.id;
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
router.post("/:id/seats/lock", requireAuth, (req, res) => {
    const { seat } = req.body;
    if (!SEATS.includes(seat)) {
        return res.status(400).json({ error: "Invalid seat" });
    }
    const expires = new Date(Date.now() + LOCK_MIN * 60_000).toISOString();
    db.prepare(
        "DELETE FROM seat_locks WHERE flight_id=? AND session_id=?"
    ).run(req.params.id, req.session.id);
    try {
        db.prepare(
            `INSERT INTO seat_locks (flight_id, seat, session_id, locked_until)
       VALUES (?, ?, ?, ?)`
        ).run(req.params.id, seat, req.session.id, expires);
        res.json({ ok: true, lockedUntil: expires });
    } catch {
        res.status(409).json({ error: "Seat already locked" });
    }
});

// ── DELETE /api/flights/:id/seats/lock ──────────────────────────────────────
router.delete("/:id/seats/lock", requireAuth, (req, res) => {
    db.prepare(
        "DELETE FROM seat_locks WHERE flight_id=? AND session_id=?"
    ).run(req.params.id, req.session.id);
    res.json({ ok: true });
});

module.exports = router;
