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

async function getFlight(id) {
    const c = getCached(id);
    if (c) return c.payload;
    const r = await api.get(`/v2/flights/search?flight_id=${id}`);
    const f = (r.flights || [])[0];
    if (f) putCached(id, f);
    return f;
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

module.exports = router;
