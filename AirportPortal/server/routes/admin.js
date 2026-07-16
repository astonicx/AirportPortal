"use strict";
const router = require("express").Router();
const { z } = require("zod");
const { db } = require("../db");
const { hashPassword } = require("../utils/password");
const { requireAdmin } = require("../middleware/auth");

router.use(requireAdmin);

function audit(req, action, targetId, payload) {
    try {
        db.prepare(
            `INSERT INTO admin_audit (admin_id, action, target_type, target_id, payload_json)
             VALUES (?, ?, 'customer', ?, ?)`
        ).run(req.user.id, action, String(targetId), JSON.stringify(payload || {}));
    } catch {
        /* audit best-effort */
    }
}

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
            `SELECT id, first_name, last_name, email, phone, address1, city, is_banned, banned_reason
       FROM users
       WHERE type='customer'
         AND (lower(email) LIKE ? OR lower(first_name) LIKE ? OR lower(last_name) LIKE ?
              OR lower(phone) LIKE ? OR lower(address1) LIKE ?)`
        )
        .all(q, q, q, q, q);
    res.json(rows);
});

const banSchema = z.object({
    reason: z.string().min(1),
});

router.post("/customers/:id/ban", (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const data = banSchema.parse(req.body || {});
        const target = db.prepare("SELECT id, type FROM users WHERE id=?").get(id);
        if (!target) return res.status(404).json({ error: "Not found" });
        if (target.type !== "customer") {
            return res.status(403).json({ error: "Only customers can be banned" });
        }
        db.prepare(
            "UPDATE users SET is_banned=1, banned_reason=? WHERE id=?"
        ).run(data.reason, id);
        audit(req, "ban_customer", id, { reason: data.reason });
        const row = db
            .prepare("SELECT id, email, is_banned, banned_reason FROM users WHERE id=?")
            .get(id);
        res.json(row);
    } catch (e) {
        next(e);
    }
});

router.post("/customers/:id/unban", (req, res) => {
    const id = Number(req.params.id);
    const target = db.prepare("SELECT id, type FROM users WHERE id=?").get(id);
    if (!target) return res.status(404).json({ error: "Not found" });
    if (target.type !== "customer") {
        return res.status(403).json({ error: "Only customers can be unbanned" });
    }
    db.prepare("UPDATE users SET is_banned=0, banned_reason=NULL WHERE id=?").run(id);
    audit(req, "unban_customer", id, {});
    const row = db
        .prepare("SELECT id, email, is_banned, banned_reason FROM users WHERE id=?")
        .get(id);
    res.json(row);
});

const createCust = z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().email(),
    password: z.string().min(11),
});

const createAttendant = z.object({
    email: z.string().email(),
    password: z.string().min(11),
    airline: z.string().min(1),
});

function requireRootUser(req, res) {
    const role = req.user?.user_type || req.user?.type;
    if (role !== "root") {
        res.status(403).json({ error: "Root only" });
        return false;
    }
    return true;
}

router.post("/customers", async (req, res, next) => {
    try {
        const data = createCust.parse(req.body);
        const hash = await hashPassword(data.password);
        const info = db
            .prepare(
                `INSERT INTO users
         (type, first_name, last_name, email, password_hash, must_change_password, must_complete_profile, user_type)
         VALUES ('customer', ?, ?, ?, ?, 1, 1, 'customer')`
            )
            .run(data.first_name, data.last_name, data.email, hash);
        audit(req, "create", info.lastInsertRowid, { email: data.email });
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
    audit(req, "update", id, req.body);
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
    audit(req, "delete", id, {});
    res.json({ ok: true });
});

router.post("/attendants", async (req, res, next) => {
    try {
        if (!requireRootUser(req, res)) return;
        const data = createAttendant.parse(req.body || {});
        const hash = await hashPassword(data.password);

        const insertUser = db.prepare(
            `INSERT INTO users (type, first_name, last_name, email, password_hash, user_type)
             VALUES ('attendant', 'Airline', 'Attendant', ?, ?, 'attendant')`
        );
        const insertAssignment = db.prepare(
            `INSERT INTO attendant_assignments (attendant_id, airline)
             VALUES (?, ?)`
        );

        const tx = db.transaction(() => {
            const info = insertUser.run(data.email, hash);
            const attendantId = Number(info.lastInsertRowid);
            insertAssignment.run(attendantId, data.airline);
            return attendantId;
        });

        const attendantId = tx();
        audit(req, "attendant_create", attendantId, {
            email: data.email,
            airline: data.airline,
        });

        res.status(201).json({ attendantId, email: data.email, airline: data.airline });
    } catch (e) {
        next(e);
    }
});

router.delete("/attendants/:id", (req, res) => {
    if (!requireRootUser(req, res)) return;
    const id = Number(req.params.id);
    const attendant = db
        .prepare("SELECT id, type, user_type, email FROM users WHERE id=?")
        .get(id);
    if (!attendant) return res.status(404).json({ error: "Not found" });
    const role = attendant.user_type || attendant.type;
    if (role !== "attendant") {
        return res.status(403).json({ error: "Target is not an attendant" });
    }

    const tx = db.transaction(() => {
        db.prepare("DELETE FROM attendant_assignments WHERE attendant_id=?").run(id);
        db.prepare("DELETE FROM users WHERE id=?").run(id);
    });
    tx();

    audit(req, "attendant_delete", id, { email: attendant.email });
    res.json({ ok: true });
});

// ── Airline restrictions (v2) ─────────────────────────────────────────────
const airlineRestrictionSchema = z.object({
    user_id: z.number().int().positive(),
    airline: z.string().min(1),
    reason: z.string().min(1),
});

router.post("/airline-restrictions", (req, res, next) => {
    try {
        const data = airlineRestrictionSchema.parse(req.body || {});
        const target = db.prepare("SELECT id, type FROM users WHERE id=?").get(data.user_id);
        if (!target) return res.status(404).json({ error: "User not found" });
        if (target.type !== "customer") {
            return res.status(403).json({ error: "Only customers can be restricted" });
        }

        const info = db
            .prepare(
                `INSERT INTO airline_restrictions (user_id, airline, reason)
                 VALUES (?, ?, ?)`
            )
            .run(data.user_id, data.airline, data.reason);

        audit(req, "airline_restriction_add", data.user_id, {
            airline: data.airline,
            reason: data.reason,
            restrictionId: info.lastInsertRowid,
        });

        const row = db
            .prepare("SELECT * FROM airline_restrictions WHERE id=?")
            .get(info.lastInsertRowid);
        res.status(201).json(row);
    } catch (e) {
        next(e);
    }
});

router.delete("/airline-restrictions/:id", (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare("SELECT * FROM airline_restrictions WHERE id=?").get(id);
    if (!row) return res.status(404).json({ error: "Not found" });
    db.prepare("DELETE FROM airline_restrictions WHERE id=?").run(id);
    audit(req, "airline_restriction_remove", row.user_id, {
        airline: row.airline,
        restrictionId: id,
    });
    res.json({ ok: true });
});

router.get("/airline-restrictions", (req, res) => {
    const userId = req.query.user_id ? Number(req.query.user_id) : null;
    if (userId) {
        const rows = db
            .prepare("SELECT * FROM airline_restrictions WHERE user_id=? ORDER BY id DESC")
            .all(userId);
        return res.json(rows);
    }
    const rows = db
        .prepare("SELECT * FROM airline_restrictions ORDER BY id DESC")
        .all();
    return res.json(rows);
});

// ── Tickets ─────────────────────────────────────────────────────────────────
// Search across ticket fields AND the joined cached flight payload so admins
// can filter by airline, flight number, route, gate, etc.
router.get("/tickets", (req, res) => {
    const q = (req.query.q || "").toLowerCase();
    const rows = db
        .prepare(
            `SELECT t.*, fc.payload_json AS flight_json
             FROM tickets t
             LEFT JOIN flight_cache fc ON fc.flight_id = t.flight_id
             ORDER BY t.booked_at DESC
             LIMIT 500`
        )
        .all();
    const decorated = rows.map((r) => {
        let flight = null;
        if (r.flight_json) {
            try {
                flight = JSON.parse(r.flight_json);
            } catch {
                /* ignore */
            }
        }
        const { flight_json: _omit, ...rest } = r;
        return { ...rest, flight };
    });
    const filtered = q
        ? decorated.filter((r) => {
            const ticketHit = Object.values(r).some(
                (v) => typeof v !== "object" && String(v ?? "").toLowerCase().includes(q)
            );
            const flightHit =
                r.flight &&
                Object.values(r.flight).some(
                    (v) => typeof v !== "object" && String(v ?? "").toLowerCase().includes(q)
                );
            return ticketHit || flightHit;
        })
        : decorated;
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
