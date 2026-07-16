"use strict";

const { db } = require("../db");

module.exports = function requireAttendant(req, res, next) {
    const role = req.user?.user_type || req.user?.type;
    if (!req.user || role !== "attendant") {
        return res.status(403).json({ error: "Attendant only" });
    }

    const assignment = db
        .prepare("SELECT airline FROM attendant_assignments WHERE attendant_id=? ORDER BY id DESC LIMIT 1")
        .get(req.user.id);

    if (!assignment) {
        return res.status(403).json({ error: "Attendant assignment required" });
    }

    req.attendantAirline = assignment.airline;
    return next();
};
