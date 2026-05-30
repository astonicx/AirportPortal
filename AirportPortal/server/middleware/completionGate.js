"use strict";

// Blocks API routes (other than /api/auth and /api/me/complete) when the
// authenticated user must change password or complete profile.
module.exports = function completionGate(req, res, next) {
    if (!req.user) return next();
    const blocked = req.user.must_change_password || req.user.must_complete_profile;
    if (!blocked) return next();
    const allowed =
        req.path.startsWith("/api/auth") ||
        req.path.startsWith("/api/me/complete") ||
        req.path === "/api/health";
    if (allowed) return next();
    return res.status(409).json({ error: "Must complete profile first" });
};
