"use strict";
const { randomBytes } = require("crypto");

const COOKIE = "bsid";

// Ensures every request has a stable booking-session identifier used to track
// seat-lock ownership. Authenticated users reuse their auth session id; guests
// (unauthenticated users, who are allowed to book) get an anonymous id that is
// persisted in a cookie so their seat locks survive the multi-step booking flow.
module.exports = function bookingSession(req, res, next) {
    if (req.session?.id) {
        req.bookingSessionId = req.session.id;
        return next();
    }
    let id = req.cookies?.[COOKIE];
    if (!id || !/^[a-f0-9]{32}$/.test(id)) {
        id = randomBytes(16).toString("hex");
        res.cookie(COOKIE, id, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 1000 * 60 * 60 * 24, // 24h — ample for a single booking flow
            path: "/",
        });
    }
    req.bookingSessionId = id;
    next();
};
