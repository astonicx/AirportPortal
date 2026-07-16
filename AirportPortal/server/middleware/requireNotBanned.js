"use strict";

const { db } = require("../db");
const { COOKIE, destroy } = require("../utils/session");

module.exports = function requireNotBanned(req, res, next) {
    if (!req.user) return next();

    const row = db
        .prepare("SELECT is_banned, banned_reason FROM users WHERE id=?")
        .get(req.user.id);

    if (!row || Number(row.is_banned) !== 1) return next();

    if (req.session?.id) {
        destroy(req.session.id);
    }

    res.clearCookie(COOKIE, { path: "/" });
    return res.status(401).json({
        error: "Account banned. Contact support.",
        code: "ACCOUNT_BANNED",
        reason: row.banned_reason || null,
    });
};
