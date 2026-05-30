"use strict";

function bagFees(carryOnCount, checkedCount) {
    const co = carryOnCount === 2 ? 30 : 0;
    let ch = 0;
    if (checkedCount === 2) ch = 50;
    else if (checkedCount >= 3) ch = 50 + 100 * (checkedCount - 2);
    return co + ch;
}

function confirmationCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const buf = require("crypto").randomBytes(8);
    let out = "";
    for (let i = 0; i < 8; i++) out += alphabet[buf[i] % alphabet.length];
    return out;
}

module.exports = { bagFees, confirmationCode };
