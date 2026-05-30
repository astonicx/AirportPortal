"use strict";
const router = require("express").Router();
const { z } = require("zod");
const { db } = require("../db");
const { hashPassword } = require("../utils/password");
const { requireAdmin } = require("../middleware/auth");

router.use(requireAdmin);

function statsWindow(label, sinceModifier) {
    const where = sinceModifier
        ? `WHERE booked_at >= datetime('now', '${sinceModifier}')`
        : "";
    const row = db
        .prepare(
            `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents),0) AS gross FROM tickets ${where}`
        )
        .get();
    return { window: label, tickets: row.n, grossCents: row.gross };
}

router.get("/stats", (_req, res) => {
    res.json({
        windows: [
            statsWindow("1d", "-1 day"),
            statsWindow("7d", "-7 days"),
            statsWindow("30d", "-30 days"),
            statsWindow("365d", "-365 days"),
            statsWindow("all", null),
        ],
    });
});

// ── Customers ───────────────────────────────────────────────────────────────
router.get("/customers", (req, res) => {
    const q = `%${(req.query.q || "").toLowerCase()}%`;
    const rows = db
        .prepare(
            `SELECT id, first_name, last_name, email, phone, address1, city
       FROM users
       WHERE type='customer'
         AND (lower(email) LIKE ? OR lower(first_name) LIKE ? OR lower(last_name) LIKE ?
              OR lower(phone) LIKE ? OR lower(address1) LIKE ?)`
        )
        .all(q, q, q, q, q);
    res.json(rows);
});

const createCust = z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().email(),
    password: z.string().min(11),
});

router.post("/customers", async (req, res, next) => {
    try {
        const data = createCust.parse(req.body);
        const hash = await hashPassword(data.password);
        const info = db
            .prepare(
                `INSERT INTO users
         (type, first_name, last_name, email, password_hash, must_change_password, must_complete_profile)
         VALUES ('customer', ?, ?, ?, ?, 1, 1)`
            )
            .run(data.first_name, data.last_name, data.email, hash);
        res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) {
        next(e);
    }
});

router.patch("/customers/:id", (req, res) => {
    const id = Number(req.params.id);
    const target = db.prepare("SELECT type FROM users WHERE id=?").get(id);
    if (!target) return res.status(404).json({ error: "Not found" });
    if (target.type !== "customer") {
        return res.status(403).json({ error: "Admins are managed by root" });
    }
    const fields = [
        "first_name",
        "last_name",
        "email",
        "phone",
        "address1",
        "city",
        "state",
        "zip",
        "country",
    ];
    const sets = [];
    const vals = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) {
            sets.push(`${f}=?`);
            vals.push(req.body[f]);
        }
    }
    if (!sets.length) return res.json({ ok: true });
    vals.push(id);
    db.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).run(...vals);
    res.json({ ok: true });
});

router.delete("/customers/:id", (req, res) => {
    const id = Number(req.params.id);
    const target = db.prepare("SELECT type FROM users WHERE id=?").get(id);
    if (!target || target.type !== "customer") {
        return res.status(403).json({ error: "Forbidden" });
    }
    db.prepare("UPDATE tickets SET user_id=NULL WHERE user_id=?").run(id);
    db.prepare("DELETE FROM users WHERE id=?").run(id);
    res.json({ ok: true });
});

// ── Tickets ─────────────────────────────────────────────────────────────────
router.get("/tickets", (req, res) => {
    const q = (req.query.q || "").toLowerCase();
    const rows = db
        .prepare("SELECT * FROM tickets ORDER BY booked_at DESC LIMIT 500")
        .all();
    const filtered = q
        ? rows.filter((r) =>
            Object.values(r).some((v) =>
                String(v ?? "")
                    .toLowerCase()
                    .includes(q)
            )
        )
        : rows;
    res.json(filtered);
});

router.post("/tickets/:id/cancel", (req, res) => {
    const id = Number(req.params.id);
    const t = db.prepare("SELECT * FROM tickets WHERE id=?").get(id);
    if (!t) return res.status(404).json({ error: "Not found" });
    db.prepare(
        "UPDATE tickets SET status='cancelled', cancelled_at=datetime('now') WHERE id=?"
    ).run(id);
    db.prepare("DELETE FROM seat_locks WHERE flight_id=? AND seat=?").run(
        t.flight_id,
        t.seat
    );
    res.json({ ok: true });
});

// ── Airline bans ────────────────────────────────────────────────────────────
router.get("/airline-bans", (_req, res) => {
    res.json(db.prepare("SELECT * FROM airline_bans ORDER BY id DESC").all());
});

router.post("/airline-bans", (req, res) => {
    const { identity, airline } = req.body;
    if (!identity || !airline) {
        return res.status(400).json({ error: "identity and airline required" });
    }
    const info = db
        .prepare(
            "INSERT INTO airline_bans (user_or_passenger_identity, airline) VALUES (?, ?)"
        )
        .run(identity, airline);
    res.status(201).json({ id: info.lastInsertRowid });
});

router.delete("/airline-bans/:id", (req, res) => {
    db.prepare("DELETE FROM airline_bans WHERE id=?").run(Number(req.params.id));
    res.json({ ok: true });
});

module.exports = router;
