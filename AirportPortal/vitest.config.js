"use strict";
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
