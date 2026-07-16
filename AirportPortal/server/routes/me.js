"use strict";
const router = require("express").Router();
const { z } = require("zod");
const { db } = require("../db");
const { getCached } = require("../utils/cache");
const { requireAuth } = require("../middleware/auth");
const { hashPassword, passwordPolicy } = require("../utils/password");
const ffm = require("../utils/ffm");

router.use(requireAuth);

router.get("/dashboard", (req, res) => {
    const u = req.user;
    const tickets = db
        .prepare("SELECT * FROM tickets WHERE user_id=? ORDER BY booked_at DESC")
        .all(u.id);
    const now = Date.now();
    const upcoming = [];
    const past = [];
    for (const t of tickets) {
        const flight = getCached(t.flight_id)?.payload || null;
        const dep = flight
            ? new Date(flight.departFromSender || flight.depart_time || 0).getTime()
            : 0;
        (dep > now && t.status === "active" ? upcoming : past).push({
            ...t,
            flight,
        });
    }
    res.json({
        profile: {
            id: u.id,
            firstName: u.first_name,
            lastName: u.last_name,
            email: u.email,
            lastLoginIp: u.last_login_ip,
            lastLoginDatetime: u.last_login_datetime,
            defaultSort: u.default_sort,
            autoLogoutMinutes: u.auto_logout_minutes,
        },
        upcoming,
        past,
    });
});

// ── GET /api/me/ffm ─────────────────────────────────────────────────────────
// Frequent flier balance for the signed-in customer. Non-customers (and any
// account without an FFM row) report zeroes.
router.get("/ffm", (req, res) => {
    const role = req.user.user_type || req.user.type || "guest";
    if (role !== "customer") {
        return res.json({ ffmBalance: 0, lifetimeEarned: 0, lifetimeSpent: 0 });
    }
    res.json(ffm.getBalance(req.user.id));
});

const patchSchema = z.object({
    title: z.string().optional(),
    middle_name: z.string().optional(),
    suffix: z.string().optional(),
    address1: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    default_sort: z.string().optional(),
    auto_logout_minutes: z.number().int().optional(),
});

router.patch("/", (req, res, next) => {
    try {
        const data = patchSchema.parse(req.body);
        if (data.email !== undefined) {
            return res.status(400).json({
                error: "Email updates require verification and are not supported here.",
                code: "EMAIL_CHANGE_REQUIRES_VERIFICATION",
                issues: [{ path: ["email"], message: "Email change requires verification" }],
            });
        }
        const sets = [];
        const vals = [];
        for (const [k, v] of Object.entries(data)) {
            sets.push(`${k}=?`);
            vals.push(v);
        }
        if (!sets.length) return res.json({ ok: true });
        vals.push(req.user.id);
        db.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).run(...vals);
        res.json({ ok: true });
    } catch (e) {
        next(e);
    }
});

router.delete("/", (req, res) => {
    db.prepare("UPDATE tickets SET user_id=NULL WHERE user_id=?").run(req.user.id);
    db.prepare("DELETE FROM users WHERE id=?").run(req.user.id);
    res.json({ ok: true });
});

// Saved cards
router.post("/cards", (req, res) => {
    const {
        cardNumber,
        expMonth,
        expYear,
        cardholder,
        billingAddress,
        billingZip,
    } = req.body;
    const last4 = String(cardNumber).slice(-4);
    const info = db
        .prepare(
            `INSERT INTO saved_cards
       (user_id, last4, brand, exp_month, exp_year, cardholder_name, billing_address, billing_zip, token_fake)
       VALUES (?, ?, 'unknown', ?, ?, ?, ?, ?, ?)`
        )
        .run(
            req.user.id,
            last4,
            expMonth,
            expYear,
            cardholder,
            billingAddress,
            billingZip,
            `fake_${Date.now()}`
        );
    res.status(201).json({ id: info.lastInsertRowid, last4 });
});

router.delete("/cards/:id", (req, res) => {
    db.prepare("DELETE FROM saved_cards WHERE id=? AND user_id=?").run(
        Number(req.params.id),
        req.user.id
    );
    res.json({ ok: true });
});

router.get("/cards", (req, res) => {
    const rows = db
        .prepare(
            "SELECT id, last4, brand, exp_month, exp_year, cardholder_name FROM saved_cards WHERE user_id=?"
        )
        .all(req.user.id);
    res.json(rows);
});

// Claim a guest ticket by last name + confirmation code
router.post("/claim-ticket", (req, res) => {
    const { lastName, confirmation } = req.body;
    const t = db
        .prepare(
            "SELECT * FROM tickets WHERE confirmation_code=? AND lower(passenger_last)=lower(?)"
        )
        .get(confirmation, lastName);
    if (!t) return res.status(404).json({ error: "Not found" });
    if (t.user_id && t.user_id !== req.user.id) {
        return res.status(409).json({ error: "Already claimed" });
    }
    db.prepare("UPDATE tickets SET user_id=? WHERE id=?").run(req.user.id, t.id);
    res.json({ ok: true });
});

// Admin-created customer first-login completion
const completeSchema = z.object({
    password: z.string().optional(),
    profile: z
        .object({
            phone: z.string().optional(),
            address1: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            zip: z.string().optional(),
            country: z.string().optional(),
            dob: z.string().optional(),
            gender: z.string().optional(),
        })
        .optional(),
});

router.post("/complete", async (req, res, next) => {
    try {
        const data = completeSchema.parse(req.body);
        const sets = [];
        const vals = [];
        if (data.password) {
            const pol = passwordPolicy(data.password);
            if (!pol.ok) return res.status(400).json({ error: pol.reason });
            sets.push("password_hash=?", "must_change_password=0");
            vals.push(await hashPassword(data.password));
        }
        if (data.profile) {
            for (const [k, v] of Object.entries(data.profile)) {
                if (v !== undefined && v !== "") {
                    sets.push(`${k}=?`);
                    vals.push(v);
                }
            }
            sets.push("must_complete_profile=0");
        }
        if (!sets.length) return res.json({ ok: true });
        vals.push(req.user.id);
        db.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).run(...vals);
        res.json({ ok: true });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
