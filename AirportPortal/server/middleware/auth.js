"use strict";
const { db } = require("../db");
const { readCookie, slide } = require("../utils/session");

function attachUser(req, _res, next) {
    const session = readCookie(req);
    if (session) {
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id);
        if (user) {
            slide(session, user.auto_logout_minutes);
            req.user = user;
            req.session = session;
        }
    }
    next();
}

function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Auth required" });
    next();
}

function requireAdmin(req, res, next) {
    const role = req.user?.user_type || req.user?.type;
    if (!req.user || (role !== "admin" && role !== "root")) {
        return res.status(403).json({ error: "Admin only" });
    }
    next();
}

function requireRoot(req, res, next) {
    const role = req.user?.user_type || req.user?.type;
    if (!req.user || role !== "root") {
        return res.status(403).json({ error: "Root only" });
    }
    next();
}

module.exports = { attachUser, requireAuth, requireAdmin, requireRoot };
