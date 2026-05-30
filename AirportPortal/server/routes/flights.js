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
    return [...list].sort((a, b) => {
        const av = a[sortBy] ?? "";
        const bv = b[sortBy] ?? "";
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
    });
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
            const upstream = await api.get(`/v1/flights?type=${type}`);
            flights = upstream.flights || upstream || [];
        } catch (e) {
            // Fallback: serve from local cache if upstream is unreachable.
            flights = db
                .prepare("SELECT payload_json FROM flight_cache")
                .all()
                .map((r) => JSON.parse(r.payload_json));
        }

        flights = flights
            .filter((f) => f.status !== "past")
            .filter((f) => matchesQuery(f, q));

        for (const f of flights) putCached(f.flight_id || f.id, f);

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

// ── GET /api/flights/:id ────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
    try {
        const cached = getCached(req.params.id);
        if (cached) return res.json(cached.payload);
        const data = await api.get(`/v1/flights/${req.params.id}`);
        putCached(req.params.id, data);
        res.json(data);
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
