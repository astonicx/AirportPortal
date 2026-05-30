"use strict";
const { randomUUID } = require("crypto");

module.exports = function requestId(req, _res, next) {
    req.id = req.headers["x-request-id"] || randomUUID();
    next();
};
