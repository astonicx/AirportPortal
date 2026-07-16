"use strict";

// External account verification against the BDPA V2 API.
//
// STATUS: PENDING — awaiting the V2 API contract from the team.
//
// Once the V2 endpoint is provided, implement `verifyAgainstBdpa` to call it
// (via ../utils/apiClient) and return whether the account maps to a real,
// verifiable identity. Until then this is intentionally inert: it reports
// `pending` and never blocks account creation.
//
// Wiring point: server/routes/admin.js -> POST /api/admin/customers.

/**
 * Verify a customer account against the external BDPA V2 API.
 * @param {{ email: string, first_name: string, last_name: string }} account
 * @returns {Promise<{ verified: boolean, pending: boolean, reason?: string }>}
 */
async function verifyAgainstBdpa(account) {
    // TODO(v2-api): replace stub once the V2 verification endpoint is available.
    // Example (pseudo):
    //   const api = require("./apiClient");
    //   const r = await api.get(`/v2/accounts/verify?email=${encodeURIComponent(account.email)}`);
    //   return { verified: !!r.verified, pending: false };
    void account;
    return { verified: false, pending: true };
}

module.exports = { verifyAgainstBdpa };
