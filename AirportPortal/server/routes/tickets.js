"use strict";
const router = require("express").Router();
const { db } = require("../db");
const api = require("../utils/apiClient");
const { getCached } = require("../utils/cache");
const ffm = require("../utils/ffm");

const CHECKIN_WINDOW_HOURS = 24;

function flightDepartMs(flight) {
    if (!flight) return 0;
    return new Date(
        flight.departFromReceiver ||
        flight.arriveAtReceiver ||
        flight.depart_time ||
        0
    ).getTime();
}

// Returns check-in eligibility info for a ticket relative to its flight.
function checkinInfo(ticket, flight) {
    const dep = flightDepartMs(flight);
    const windowMs = CHECKIN_WINDOW_HOURS * 3600 * 1000;
    const availableAt = dep ? new Date(dep - windowMs).toISOString() : null;
    const already = db
        .prepare("SELECT checked_in_at FROM checkin_records WHERE ticket_id=?")
        .get(ticket.id);
    const now = Date.now();
    const checkinEligible =
        !!dep &&
        ticket.status !== "cancelled" &&
        !already &&
        now >= dep - windowMs &&
        now < dep;
    return {
        checkinEligible,
        availableAt,
        checkedIn: !!already,
        checkedInAt: already?.checked_in_at || null,
        requiresCheckinFirst: !!checkinEligible,
    };
}

router.get("/by-confirmation", (req, res) => {
    const { lastName, code } = req.query;
    if (!lastName || !code) {
        return res.status(400).json({ error: "Missing params" });
    }
    const row = db
        .prepare(
            "SELECT * FROM tickets WHERE confirmation_code=? AND lower(passenger_last)=lower(?)"
        )
        .get(code, lastName);
    if (!row) return res.status(404).json({ error: "Not found" });
    const cached = getCached(row.flight_id);
    const flight = cached?.payload || null;
    const info = checkinInfo(row, flight);
    res.json({
        ticket: {
            ...row,
            checked_in_at: info.checkedInAt,
            requires_checkin_first: info.requiresCheckinFirst,
        },
        flight,
        checkin_eligible: info.checkinEligible,
        available_at: info.availableAt,
        checked_in_at: info.checkedInAt,
        requires_checkin_first: info.requiresCheckinFirst,
    });
});

router.get("/:id/checkin-eligible", (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare("SELECT * FROM tickets WHERE id=?").get(id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const flight = getCached(row.flight_id)?.payload || null;
    const info = checkinInfo(row, flight);
    res.json({
        ticketId: id,
        checkinEligible: info.checkinEligible,
        availableAt: info.availableAt,
        checkedInAt: info.checkedInAt,
        requiresCheckinFirst: info.requiresCheckinFirst,
    });
});

// ── POST /api/tickets/:id/checkin ───────────────────────────────────────────
// Check in for a flight within the 24h window before departure. Owners are
// authorized by session; guests supply the passenger last name.
router.post("/:id/checkin", (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const t = db.prepare("SELECT * FROM tickets WHERE id=?").get(id);
        if (!t) return res.status(404).json({ error: "Not found" });

        const isOwner = req.user && req.user.id === t.user_id;
        const { lastName } = req.body || {};
        const nameMatch =
            lastName &&
            String(lastName).toLowerCase() === String(t.passenger_last).toLowerCase();
        if (!isOwner && !nameMatch) {
            return res.status(403).json({ error: "Forbidden" });
        }
        if (t.status === "cancelled") {
            return res.status(409).json({ error: "Ticket cancelled" });
        }

        const flight = getCached(t.flight_id)?.payload || null;
        const dep = flightDepartMs(flight);
        if (!dep) return res.status(400).json({ error: "Flight time unavailable" });
        const windowMs = CHECKIN_WINDOW_HOURS * 3600 * 1000;
        const now = Date.now();
        if (now < dep - windowMs) {
            return res.status(400).json({
                error: "Check-in not open yet",
                code: "CHECKIN_NOT_OPEN",
                availableAt: new Date(dep - windowMs).toISOString(),
            });
        }
        if (now >= dep) {
            return res
                .status(400)
                .json({ error: "Check-in closed", code: "CHECKIN_CLOSED" });
        }

        const existing = db
            .prepare("SELECT * FROM checkin_records WHERE ticket_id=?")
            .get(id);
        if (existing) {
            return res.json({
                ok: true,
                alreadyCheckedIn: true,
                gate: existing.gate,
                seat: t.seat,
            });
        }
        const gate = flight?.gate || null;
        db.prepare(
            "INSERT INTO checkin_records (ticket_id, gate, status) VALUES (?, ?, 'checked_in')"
        ).run(id, gate);
        res.json({ ok: true, gate, seat: t.seat });
    } catch (e) {
        next(e);
    }
});

router.post("/:id/cancel", async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const t = db.prepare("SELECT * FROM tickets WHERE id=?").get(id);
        if (!t) return res.status(404).json({ error: "Not found" });
        if (t.status === "cancelled") {
            return res.status(409).json({ error: "Already cancelled" });
        }

        const isOwner = req.user && req.user.id === t.user_id;
        const isAdmin =
            req.user && (req.user.type === "admin" || req.user.type === "root");
        const { lastName, code } = req.body || {};
        const isGuest =
            lastName &&
            code &&
            String(code) === t.confirmation_code &&
            String(lastName).toLowerCase() === String(t.passenger_last).toLowerCase();
        if (!isOwner && !isAdmin && !isGuest) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const flight = getCached(t.flight_id)?.payload;
        if (flight) {
            const dep = new Date(
                flight.departFromSender || flight.depart_time || 0
            );
            if (dep.getTime() < Date.now()) {
                return res.status(409).json({ error: "Flight already departed" });
            }
        }

        try {
            await api.delete(`/v2/tickets/${t.id}`);
        } catch (e) {
            console.warn("[tickets] upstream cancel failed:", e.message);
        }

        db.prepare(
            "UPDATE tickets SET status='cancelled', cancelled_at=datetime('now') WHERE id=?"
        ).run(id);
        db.prepare("DELETE FROM seat_locks WHERE flight_id=? AND seat=?").run(
            t.flight_id,
            t.seat
        );

        // Fully reconcile FFM to pre-booking state for this ticket. Idempotent:
        // cancelled tickets return 409 above, so this runs at most once.
        let ffmBalance = null;
        if (t.user_id) {
            let spent = Number(t.ffm_spent || 0);
            // Backward-compatible fallback for pre-migration tickets.
            if (spent <= 0) {
                spent = Number(
                    db
                        .prepare(
                            "SELECT COALESCE(SUM(cost_ffm),0) AS ffm FROM ticket_extras WHERE ticket_id=?"
                        )
                        .get(id).ffm || 0
                );
            }
            const earned = Number(t.ffm_earned || 0);
            if (spent > 0) ffm.earn(t.user_id, spent);
            if (earned > 0) ffm.spend(t.user_id, earned);
            ffmBalance = ffm.getBalance(t.user_id).ffmBalance;
        }

        res.json({ ok: true, ffmBalance });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
