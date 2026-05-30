"use strict";
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
    windowMs: 60_000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many auth attempts, slow down." },
});

const bookingLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many booking attempts." },
});

module.exports = { authLimiter, bookingLimiter };
