"use strict";
const router = require("express").Router();
const { z } = require("zod");
const { db } = require("../db");
const { hashPassword } = require("../utils/password");
const { requireRoot } = require("../middleware/auth");

router.use(requireRoot);

const createAdmin = z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(11),
});

function audit(req, action, targetId, payload) {
    db.prepare(
        `INSERT INTO admin_audit (admin_id, action, target_type, target_id, payload_json)
     VALUES (?, ?, 'admin', ?, ?)`
    ).run(req.user.id, action, String(targetId), JSON.stringify(payload || {}));
}

router.get("/", (_req, res) => {
    const rows = db
        .prepare(
            "SELECT id, first_name, last_name, email, type FROM users WHERE type IN ('admin','root') ORDER BY id"
        )
        .all();
    res.json(rows);
});

router.post("/", async (req, res, next) => {
    try {
        const data = createAdmin.parse(req.body);
        const hash = await hashPassword(data.password);
        const info = db
            .prepare(
                `INSERT INTO users (type, first_name, last_name, email, password_hash, user_type)
         VALUES ('admin', ?, ?, ?, ?, 'admin')`
            )
            .run(data.first_name, data.last_name, data.email, hash);
        audit(req, "create", info.lastInsertRowid, { email: data.email });
        res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) {
        next(e);
    }
});

router.patch("/:id", (req, res) => {
    const id = Number(req.params.id);
    const target = db.prepare("SELECT type FROM users WHERE id=?").get(id);
    if (!target) return res.status(404).json({ error: "Not found" });
    if (target.type === "root") {
        return res.status(403).json({ error: "Cannot modify root" });
    }
    const { first_name, last_name, email } = req.body;
    db.prepare(
        "UPDATE users SET first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name), email=COALESCE(?,email) WHERE id=?"
    ).run(first_name, last_name, email, id);
    audit(req, "update", id, req.body);
    res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    const target = db.prepare("SELECT type FROM users WHERE id=?").get(id);
    if (!target) return res.status(404).json({ error: "Not found" });
    if (target.type === "root") {
        return res.status(403).json({ error: "Cannot delete root" });
    }
    db.prepare("DELETE FROM users WHERE id=?").run(id);
    audit(req, "delete", id, {});
    res.json({ ok: true });
});

module.exports = router;
