"use strict";
const router = require("express").Router();
const { z } = require("zod");
const { db } = require("../db");
const api = require("../utils/apiClient");
const { getCached, putCached } = require("../utils/cache");
const { confirmationCode } = require("../utils/pricing");
const flightV2 = require("../utils/flightV2");
const requireAttendant = require("../middleware/requireAttendant");

router.use(requireAttendant);

const ADVANCE_BOOKING_HOURS = 36;

async function getFlight(id) {
    const c = getCached(id);
    if (c) return c.payload;
    const r = await api.get(`/v2/flights?flight_id=${id}`);
    const f = (r.flights || [])[0];
    if (f) putCached(id, f);
    return f;
}

// Case-insensitive airline match against the attendant's assigned airline.
function airlineMatches(airline, attendantAirline) {
    return (
        String(airline || "").toLowerCase() ===
        String(attendantAirline || "").toLowerCase()
    );
}

const ticketSchema = z.object({
    flightId: z.string(),
    passenger: z.object({
        first: z.string(),
        middle: z.string().optional(),
        last: z.string(),
        dob: z.string(),
        gender: z.string(),
        email: z.string().email(),
        phone: z.string(),
    }),
    seat: z.string(),
    seatClass: z.string().optional(),
    extras: z.array(z.string()).optional(),
    carryOnCount: z.number().int().min(0).max(2).default(0),
    checkedCount: z.number().int().min(0).max(5).default(0),
});

// ── POST /api/attendant/tickets ─────────────────────────────────────────────
// An attendant books a ticket for a flight operated by their own airline.
// Attendant bookings skip the No Fly List check (staff-issued tickets).
router.post("/tickets", async (req, res, next) => {
    try {
        const data = ticketSchema.parse(req.body);
        const flight = await getFlight(data.flightId);
        if (!flight) return res.status(404).json({ error: "Flight not found" });

        if (
            String(flight.airline || "").toLowerCase() !==
            String(req.attendantAirline || "").toLowerCase()
        ) {
            return res.status(403).json({
                error: "Flight not operated by your airline",
                code: "AIRLINE_MISMATCH",
            });
        }

        // Enforce the 36-hour advance-booking rule (same as guest/customer
        // bookings) so attendants cannot issue tickets too close to departure.
        const arrives = new Date(flight.arriveAtReceiver || 0).getTime();
        if (arrives && arrives < Date.now() + ADVANCE_BOOKING_HOURS * 3600 * 1000) {
            return res.status(400).json({
                error: `Flight departs within ${ADVANCE_BOOKING_HOURS}h`,
                code: "BOOKING_TOO_CLOSE",
            });
        }

        const seatPriceCents =
            flightV2.seatClassPriceCents(flight, data.seatClass) ||
            Math.round((flight.seat_price ?? flight.seatPrice ?? 0) * 100);
        const fees = flightV2.baggageCostCents(
            flight,
            data.carryOnCount,
            data.checkedCount
        );
        const resolvedExtras = flightV2.resolveExtras(flight, data.extras || []);
        const total = seatPriceCents + fees + resolvedExtras.totalCents;

        const code = confirmationCode();
        const info = db
            .prepare(
                `INSERT INTO tickets
         (confirmation_code, user_id, flight_id, passenger_first, passenger_middle, passenger_last,
          passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
          carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
                code,
                null,
                data.flightId,
                data.passenger.first,
                data.passenger.middle || null,
                data.passenger.last,
                data.passenger.dob,
                data.passenger.gender,
                data.passenger.email,
                data.passenger.phone,
                data.seat,
                data.carryOnCount,
                data.checkedCount,
                seatPriceCents,
                fees,
                total
            );

        const ticketId = info.lastInsertRowid;
        for (const ex of resolvedExtras.items) {
            db.prepare(
                `INSERT INTO ticket_extras (ticket_id, extra_name, cost_cents, cost_ffm)
                 VALUES (?, ?, ?, ?)`
            ).run(ticketId, ex.name, ex.costCents || 0, ex.costFfm || 0);
        }
        db.prepare("DELETE FROM seat_locks WHERE flight_id=? AND seat=?").run(
            data.flightId,
            data.seat
        );

        res.status(201).json({
            ok: true,
            ticketId,
            confirmationCode: code,
            totalCents: total,
        });
    } catch (e) {
        next(e);
    }
});

// ── GET /api/attendant/flights/:flightId/tickets ────────────────────────────
// Paginated manifest of tickets for a flight operated by the attendant's
// airline.
router.get("/flights/:flightId/tickets", async (req, res, next) => {
    try {
        const flightId = req.params.flightId;
        let flight = getCached(flightId)?.payload;
        if (!flight) {
            try {
                flight = await getFlight(flightId);
            } catch {
                flight = null;
            }
        }
        if (
            flight &&
            String(flight.airline || "").toLowerCase() !==
            String(req.attendantAirline || "").toLowerCase()
        ) {
            return res.status(403).json({ error: "Flight not operated by your airline" });
        }

        const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
        const pageSize = Math.min(
            100,
            Math.max(1, parseInt(req.query.pageSize ?? "25", 10))
        );
        const total = db
            .prepare("SELECT COUNT(*) AS n FROM tickets WHERE flight_id=?")
            .get(flightId).n;
        const items = db
            .prepare(
                `SELECT t.*,
                        (SELECT id FROM checkin_records c WHERE c.ticket_id=t.id) IS NOT NULL AS checked_in
                 FROM tickets t WHERE t.flight_id=?
                 ORDER BY t.booked_at DESC LIMIT ? OFFSET ?`
            )
            .all(flightId, pageSize, (page - 1) * pageSize);

        res.json({ page, pageSize, total, items });
    } catch (e) {
        next(e);
    }
});

// ── GET /api/attendant/flights ──────────────────────────────────────────────
// Paginated list of flights operated by the attendant's own airline.
router.get("/flights", async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
        const pageSize = Math.min(
            50,
            Math.max(1, parseInt(req.query.pageSize ?? "20", 10))
        );
        const q = (req.query.q || "").trim().toLowerCase();

        let flights = [];
        try {
            const [dep, arr] = await Promise.all([
                api.get(`/v2/flights?type=departure&sort=desc`),
                api.get(`/v2/flights?type=arrival&sort=desc`),
            ]);
            flights = [...(dep.flights || dep || []), ...(arr.flights || arr || [])];
        } catch {
            // Fallback to local cache when upstream is unreachable.
            flights = db
                .prepare("SELECT payload_json FROM flight_cache")
                .all()
                .map((r) => {
                    try {
                        return JSON.parse(r.payload_json);
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean);
        }

        // De-dupe by flight id and cache for later detail/manifest lookups.
        const seen = new Set();
        const mine = [];
        for (const f of flights) {
            const id = f.flight_id || f.id;
            if (!id || seen.has(id)) continue;
            seen.add(id);
            if (!airlineMatches(f.airline, req.attendantAirline)) continue;
            if (f.status === "past") continue;
            putCached(id, f);
            const whenMs =
                f.departFromSender || f.arriveAtReceiver || f.departFromReceiver || 0;
            const item = {
                flight_id: id,
                flightNumber: f.flightNumber || f.flight_number || "",
                airline: f.airline || "",
                from: f.comingFrom || f.landingAt || "",
                to: f.departingTo || f.landingAt || "",
                gate: f.gate || "",
                status: f.status || "",
                time: whenMs
                    ? new Date(whenMs).toLocaleString("en-US")
                    : "",
                timeMs: whenMs,
            };
            mine.push(item);
        }

        const filtered = q
            ? mine.filter((f) =>
                ["flightNumber", "airline", "gate", "from", "to", "status"].some((k) =>
                    String(f[k] ?? "").toLowerCase().includes(q)
                )
            )
            : mine;
        filtered.sort((a, b) => a.timeMs - b.timeMs);

        const start = (page - 1) * pageSize;
        res.json({
            page,
            pageSize,
            total: filtered.length,
            items: filtered.slice(start, start + pageSize),
        });
    } catch (e) {
        next(e);
    }
});

// Decorates a ticket row with its parsed cached flight payload, or null.
function decorateTicket(row) {
    let flight = null;
    if (row.flight_json) {
        try {
            flight = JSON.parse(row.flight_json);
        } catch {
            /* ignore malformed cache */
        }
    }
    const { flight_json: _omit, ...rest } = row;
    return { ...rest, flight };
}

// ── GET /api/attendant/customers ────────────────────────────────────────────
// Search customers who have booked flights on the attendant's own airline.
// Returns contact info plus the count of tickets on that airline.
router.get("/customers", (req, res, next) => {
    try {
        const q = `%${(req.query.q || "").toLowerCase()}%`;
        const airline = String(req.attendantAirline || "").toLowerCase();
        const rows = db
            .prepare(
                `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.address1, u.city,
                        COUNT(t.id) AS ticket_count
                 FROM users u
                 JOIN tickets t ON t.user_id = u.id
                 JOIN flight_cache fc ON fc.flight_id = t.flight_id
                 WHERE u.type = 'customer'
                   AND lower(json_extract(fc.payload_json, '$.airline')) = ?
                   AND (lower(u.email) LIKE ? OR lower(u.first_name) LIKE ? OR lower(u.last_name) LIKE ?
                        OR lower(u.phone) LIKE ? OR lower(u.address1) LIKE ?)
                 GROUP BY u.id
                 ORDER BY ticket_count DESC`
            )
            .all(airline, q, q, q, q, q);
        res.json(rows);
    } catch (e) {
        next(e);
    }
});

// ── GET /api/attendant/tickets ──────────────────────────────────────────────
// Search tickets for flights operated by the attendant's own airline.
router.get("/tickets", (req, res, next) => {
    try {
        const q = (req.query.q || "").toLowerCase();
        const rows = db
            .prepare(
                `SELECT t.*, fc.payload_json AS flight_json
                 FROM tickets t
                 JOIN flight_cache fc ON fc.flight_id = t.flight_id
                 WHERE lower(json_extract(fc.payload_json, '$.airline')) = ?
                 ORDER BY t.booked_at DESC
                 LIMIT 500`
            )
            .all(String(req.attendantAirline || "").toLowerCase())
            .map(decorateTicket);

        const filtered = q
            ? rows.filter((r) => {
                const ticketHit = Object.values(r).some(
                    (v) =>
                        typeof v !== "object" &&
                        String(v ?? "").toLowerCase().includes(q)
                );
                const flightHit =
                    r.flight &&
                    Object.values(r.flight).some(
                        (v) =>
                            typeof v !== "object" &&
                            String(v ?? "").toLowerCase().includes(q)
                    );
                return ticketHit || flightHit;
            })
            : rows;
        res.json(filtered);
    } catch (e) {
        next(e);
    }
});

// ── GET /api/attendant/tickets/:id ──────────────────────────────────────────
// Ticket detail for confirmation, scoped to the attendant's own airline.
router.get("/tickets/:id", (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const row = db
            .prepare(
                `SELECT t.*, fc.payload_json AS flight_json
                 FROM tickets t
                 LEFT JOIN flight_cache fc ON fc.flight_id = t.flight_id
                 WHERE t.id = ?`
            )
            .get(id);
        if (!row) return res.status(404).json({ error: "Not found" });
        const decorated = decorateTicket(row);
        if (!airlineMatches(decorated.flight?.airline, req.attendantAirline)) {
            return res.status(403).json({ error: "Ticket not on your airline" });
        }
        const extras = db
            .prepare("SELECT extra_name, cost_cents, cost_ffm FROM ticket_extras WHERE ticket_id=?")
            .all(id);
        res.json({ ticket: decorated, flight: decorated.flight, extras });
    } catch (e) {
        next(e);
    }
});

// ── POST /api/attendant/tickets/:id/cancel ──────────────────────────────────
// Cancel an upcoming ticket for a flight operated by the attendant's airline.
router.post("/tickets/:id/cancel", (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const t = db.prepare("SELECT * FROM tickets WHERE id=?").get(id);
        if (!t) return res.status(404).json({ error: "Not found" });

        const flight = getCached(t.flight_id)?.payload || null;
        if (!airlineMatches(flight?.airline, req.attendantAirline)) {
            return res.status(403).json({ error: "Ticket not on your airline" });
        }
        if (t.status === "cancelled") {
            return res.status(409).json({ error: "Already cancelled" });
        }

        const dep = new Date(
            flight?.departFromSender || flight?.depart_time || flight?.arriveAtReceiver || 0
        ).getTime();
        if (dep && dep < Date.now()) {
            return res.status(409).json({ error: "Flight already departed" });
        }

        db.prepare(
            "UPDATE tickets SET status='cancelled', cancelled_at=datetime('now') WHERE id=?"
        ).run(id);
        db.prepare("DELETE FROM seat_locks WHERE flight_id=? AND seat=?").run(
            t.flight_id,
            t.seat
        );
        res.json({ ok: true });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
