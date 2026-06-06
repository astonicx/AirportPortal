"use strict";
const router = require("express").Router();
const { z } = require("zod");
const api = require("../utils/apiClient");

const schema = z.object({
    first: z.string(),
    middle: z.string().optional(),
    last: z.string(),
    dob: z.string(),
    gender: z.string(),
});

function norm(s) {
    return (s || "").trim().toLowerCase();
}

function pad(n) {
    return String(n).padStart(2, "0");
}

// Build a YYYY-MM-DD string from the upstream {day,month,year} birthdate.
function entryDob(bd) {
    if (!bd || !bd.year) return "";
    return `${bd.year}-${pad(bd.month)}-${pad(bd.day)}`;
}

router.post("/check", async (req, res, next) => {
    try {
        const p = schema.parse(req.body);
        const list = await api.get("/v1/info/no-fly-list");
        const entries = list.noFlyList || [];
        const hit = entries.find(
            (e) =>
                norm(e.name?.first) === norm(p.first) &&
                norm(e.name?.last) === norm(p.last) &&
                entryDob(e.birthdate) === norm(p.dob) &&
                norm(e.sex) === norm(p.gender)
        );
        res.json({ blocked: !!hit, reason: hit ? "Match on No Fly List" : null });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
