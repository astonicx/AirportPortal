"use strict";

const { db } = require("../db");

function getAttendantAirline(attendantId) {
    const row = db
        .prepare("SELECT airline FROM attendant_assignments WHERE attendant_id=? ORDER BY id DESC LIMIT 1")
        .get(attendantId);
    return row?.airline || null;
}

module.exports = { getAttendantAirline };
