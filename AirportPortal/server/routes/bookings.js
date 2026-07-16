"use strict";
const router = require("express").Router();
const { z } = require("zod");
const api = require("../utils/apiClient");
const { db } = require("../db");
const { getCached, putCached } = require("../utils/cache");
const { confirmationCode } = require("../utils/pricing");
const flightV2 = require("../utils/flightV2");
const ffm = require("../utils/ffm");

// A flight may only be booked here if it is landing at the airport this portal
// serves. The upstream `type` field is not authoritative, so we match on
// `landingAt === HOME_AIRPORT`.
const HOME_AIRPORT = (process.env.HOME_AIRPORT || "").trim();

// V2 raises the legacy 24h no-booking window to 36h.
const ADVANCE_BOOKING_HOURS = 36;

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
        method: z.enum(["money", "ffm", "mixed"]).optional(),
        ffmToApply: z.number().int().min(0).optional(),
    }),
    seat: z.string(),
    seatClass: z.string().optional(),
    extras: z.array(z.string()).optional(),
    carryOnCount: z.number().int().min(0).max(2),
    checkedCount: z.number().int().min(0).max(5),
});

async function getFlight(id) {
    const c = getCached(id);
    if (c) return c.payload;
    const r = await api.get(`/v2/flights?flight_id=${id}`);
    const f = (r.flights || [])[0];
    if (f) putCached(id, f);
    return f;
}

router.post("/", async (req, res, next) => {
    try {
        const data = schema.parse(req.body);

        if (req.user && Number(req.user.is_banned) === 1) {
            return res.status(403).json({
                error: "You are not permitted to book",
                code: "CUSTOMER_BANNED",
            });
        }

        const flight = await getFlight(data.flightId);

        if (req.user) {
            const restricted = db
                .prepare(
                    `SELECT id FROM airline_restrictions
                     WHERE user_id=? AND lower(airline)=lower(?)`
                )
                .get(req.user.id, flight.airline || "");
            if (restricted) {
                return res.status(403).json({
                    error: `You are not permitted to book with ${flight.airline}`,
                    code: "AIRLINE_RESTRICTED",
                });
            }
        }

        if (!flight.bookable || flight.status !== "scheduled") {
            return res.status(400).json({ error: "Flight not bookable" });
        }
        // Only flights landing at our airport may be booked.
        if (HOME_AIRPORT && flight.landingAt !== HOME_AIRPORT) {
            return res
                .status(400)
                .json({ error: "Only flights landing at this airport can be booked" });
        }
        const arrives = new Date(flight.arriveAtReceiver);
        if (arrives.getTime() < Date.now() + ADVANCE_BOOKING_HOURS * 3600 * 1000) {
            return res.status(400).json({
                error: `Flight departs within ${ADVANCE_BOOKING_HOURS}h`,
                code: "BOOKING_TOO_CLOSE",
            });
        }

        const lock = db
            .prepare("SELECT * FROM seat_locks WHERE flight_id=? AND seat=?")
            .get(data.flightId, data.seat);
        const ownerId = req.session?.id || req.bookingSessionId || null;
        if (!lock || !ownerId || lock.session_id !== ownerId) {
            return res.status(409).json({ error: "Seat lock not owned" });
        }

        // No Fly + airline-ban
        let noFly = { noFlyList: [] };
        try {
            noFly = await api.get("/v2/info/no-fly-list");
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

        const seatPriceCents = flightV2.seatClassPriceCents(flight, data.seatClass) ||
            Math.round((flight.seat_price ?? flight.seatPrice ?? 0) * 100);
        const fees = flightV2.baggageCostCents(
            flight,
            data.carryOnCount,
            data.checkedCount
        );
        const resolvedExtras = flightV2.resolveExtras(flight, data.extras || []);
        const extrasMoneyCents = resolvedExtras.totalCents;
        const extrasFfm = resolvedExtras.totalFfm;

        // FFM (points) are only available to logged-in customers.
        const ffmToApply = req.user ? Math.max(0, data.payment.ffmToApply || 0) : 0;
        if (req.user && (ffmToApply > 0 || extrasFfm > 0)) {
            const { ffmBalance } = ffm.getBalance(req.user.id);
            if (ffmBalance < ffmToApply + extrasFfm) {
                return res.status(400).json({
                    error: "Insufficient frequent flier miles",
                    code: "INSUFFICIENT_FFM",
                });
            }
        }

        // 1 FFM point discounts 1 cent of the money total.
        const grossMoney = seatPriceCents + fees + extrasMoneyCents;
        const total = Math.max(0, grossMoney - ffmToApply);

        try {
            await api.post(`/v2/flights/${data.flightId}/book`, { seat: data.seat });
        } catch (e) {
            // upstream may be flaky; we still persist locally so the customer
            // doesn't lose their booking, then operators can reconcile.
            console.warn("[bookings] upstream book failed:", e.message);
        }

        const code = confirmationCode();
        const spentFfm = ffmToApply + extrasFfm;
        const earnedFfm = req.user && total > 0 ? Math.max(0, flightV2.ffmCredit(flight)) : 0;

        const info = db
            .prepare(
                `INSERT INTO tickets
         (confirmation_code, user_id, flight_id, passenger_first, passenger_middle, passenger_last,
          passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
          seat_class, carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents,
          ffm_spent, ffm_earned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
                data.seatClass || null,
                data.carryOnCount,
                data.checkedCount,
                seatPriceCents,
                fees,
                total,
                req.user ? spentFfm : 0,
                req.user ? earnedFfm : 0
            );

        db.prepare("DELETE FROM seat_locks WHERE flight_id=? AND seat=?").run(
            data.flightId,
            data.seat
        );

        // Persist extras and settle FFM (points spent + earned) for customers.
        const ticketId = info.lastInsertRowid;
        for (const ex of resolvedExtras.items) {
            db.prepare(
                `INSERT INTO ticket_extras (ticket_id, extra_name, cost_cents, cost_ffm)
                 VALUES (?, ?, ?, ?)`
            ).run(ticketId, ex.name, ex.costCents || 0, ex.costFfm || 0);
        }
        let ffmBalance = null;
        if (req.user) {
            const spent = spentFfm;
            if (spent > 0) ffm.spend(req.user.id, spent);
            const credit = earnedFfm;
            if (total > 0 && credit > 0) ffm.earn(req.user.id, credit);
            ffmBalance = ffm.getBalance(req.user.id).ffmBalance;
        }

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
            ffmBalance,
        });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
