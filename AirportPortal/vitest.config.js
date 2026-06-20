"use strict";
module.exports = {
    test: {
        environment: "node",
        include: ["server/**/*.test.{js,mjs}"],
        setupFiles: ["server/tests/setup.mjs"],
        globals: true,
        testTimeout: 10000,
    },
};
