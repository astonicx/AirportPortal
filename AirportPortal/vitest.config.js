"use strict";
// NOTE: do NOT load dotenv here — letting .env (BDPA_BASE_URL, etc.) leak into
// the test environment breaks MSW interception in tests/setup/backend.setup.mjs.
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
    test: {
        name: "backend",
        environment: "node",
        globals: true,
        passWithNoTests: true,
        setupFiles: ["./tests/setup/backend.setup.mjs"],
        include: [
            "server/**/*.test.{js,mjs}",
            "tests/unit/server/**/*.test.{js,mjs}",
            "tests/integration/**/*.test.{js,mjs}",
        ],
        exclude: ["tests/frontend/**", "tests/e2e/**", "dist/**", "node_modules/**"],
        testTimeout: 10000,
        coverage: {
            provider: "v8",
            reportsDirectory: "./coverage/backend",
            reporter: ["text", "html", "lcov"],
            include: ["server/**/*.js"],
            exclude: [
                "server/**/*.test.{js,mjs}",
                "server/public/**",
                "server/data.sqlite*",
            ],
        },
    },
});
