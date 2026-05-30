"use strict";
const router = require("express").Router();
const { db } = require("../db");
const api = require("../utils/apiClient");
const { getCached } = require("../utils/cache");

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
    res.json({ ticket: row, flight: cached?.payload || null });
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
            await api.delete(`/v1/tickets/${t.id}`);
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

        res.json({ ok: true });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
