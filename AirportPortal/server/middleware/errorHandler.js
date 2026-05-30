"use strict";
// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, _next) {
    const status = err.status || (err.name === "ZodError" ? 400 : 500);
    const payload = {
        error: err.publicMessage || (status >= 500 ? "Internal server error" : err.message),
        requestId: req.id,
    };
    if (err.name === "ZodError") payload.issues = err.issues;
    if (process.env.NODE_ENV !== "production") payload.stack = err.stack;
    console.error(`[${req.id}]`, err);
    res.status(status).json(payload);
};
