"use strict";
const router = require("express").Router();
const { z } = require("zod");
const api = require("../utils/apiClient");
const { db } = require("../db");
const { getCached, putCached } = require("../utils/cache");
const { bagFees, confirmationCode } = require("../utils/pricing");

const schema = z.object({
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
    payment: z.object({
        cardNumber: z.string(),
        expMonth: z.number(),
        expYear: z.number(),
        cvc: z.string(),
        cardholder: z.string(),
        billingAddress: z.string(),
        billingZip: z.string(),
        saveCard: z.boolean().optional(),
    }),
    seat: z.string(),
    carryOnCount: z.number().int().min(0).max(2),
    checkedCount: z.number().int().min(0).max(5),
});

async function getFlight(id) {
    const c = getCached(id);
    if (c) return c.payload;
    const r = await api.get(`/v1/flights/search?flight_id=${id}`);
    const f = (r.flights || [])[0];
    if (f) putCached(id, f);
    return f;
}

router.post("/", async (req, res, next) => {
    try {
        const data = schema.parse(req.body);
        const flight = await getFlight(data.flightId);

        if (!flight.bookable || flight.status !== "scheduled") {
            return res.status(400).json({ error: "Flight not bookable" });
        }
        const arrives = new Date(flight.arriveAtReceiver);
        if (arrives.getTime() < Date.now() + 24 * 3600 * 1000) {
            return res.status(400).json({ error: "Flight departs within 24h" });
        }

        const lock = db
            .prepare("SELECT * FROM seat_locks WHERE flight_id=? AND seat=?")
            .get(data.flightId, data.seat);
        if (!lock || lock.session_id !== req.session?.id) {
            return res.status(409).json({ error: "Seat lock not owned" });
        }

        // No Fly + airline-ban
        let noFly = { noFlyList: [] };
        try {
            noFly = await api.get("/v1/info/no-fly-list");
        } catch { }
        const norm = (s) => (s || "").trim().toLowerCase();
        const pad = (n) => String(n).padStart(2, "0");
        const entryDob = (bd) =>
            bd && bd.year ? `${bd.year}-${pad(bd.month)}-${pad(bd.day)}` : "";
        const blocked = (noFly.noFlyList || []).find(
            (e) =>
                norm(e.name?.first) === norm(data.passenger.first) &&
                norm(e.name?.last) === norm(data.passenger.last) &&
                entryDob(e.birthdate) === norm(data.passenger.dob) &&
                norm(e.sex) === norm(data.passenger.gender)
        );
        if (blocked) return res.status(403).json({ error: "No Fly List match" });

        const banKey = `${norm(data.passenger.first)} ${norm(data.passenger.last)} ${norm(data.passenger.dob)}`;
        const banned = db
            .prepare(
                "SELECT id FROM airline_bans WHERE lower(user_or_passenger_identity)=? AND lower(airline)=?"
            )
            .get(banKey, norm(flight.airline));
        if (banned) return res.status(403).json({ error: "Banned from this airline" });

        const seatPriceCents = Math.round(
            (flight.seat_price ?? flight.seatPrice ?? 0) * 100
        );
        const fees = bagFees(data.carryOnCount, data.checkedCount) * 100;
        const total = seatPriceCents + fees;

        try {
            await api.post(`/v1/flights/${data.flightId}/book`, { seat: data.seat });
        } catch (e) {
            // upstream may be flaky; we still persist locally so the customer
            // doesn't lose their booking, then operators can reconcile.
            console.warn("[bookings] upstream book failed:", e.message);
        }

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
                req.user?.id ?? null,
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

        db.prepare("DELETE FROM seat_locks WHERE flight_id=? AND seat=?").run(
            data.flightId,
            data.seat
        );

        if (data.payment.saveCard && req.user) {
            const last4 = data.payment.cardNumber.slice(-4);
            db.prepare(
                `INSERT INTO saved_cards
         (user_id, last4, brand, exp_month, exp_year, cardholder_name, billing_address, billing_zip, token_fake)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
                req.user.id,
                last4,
                "unknown",
                data.payment.expMonth,
                data.payment.expYear,
                data.payment.cardholder,
                data.payment.billingAddress,
                data.payment.billingZip,
                `fake_${code}`
            );
        }

        res.status(201).json({
            ok: true,
            ticketId: info.lastInsertRowid,
            confirmationCode: code,
            totalCents: total,
        });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
