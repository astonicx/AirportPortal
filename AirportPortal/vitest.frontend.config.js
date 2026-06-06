"use strict";
const path = require("path");
const { defineConfig } = require("vitest/config");
const react = require("@vitejs/plugin-react-swc").default;

module.exports = defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        name: "frontend",
        environment: "jsdom",
        globals: true,
        passWithNoTests: true,
        css: true,
        setupFiles: ["./tests/setup/frontend.setup.js"],
        include: [
            "tests/frontend/**/*.test.{js,jsx}",
            "tests/unit/src/**/*.test.{js,jsx}",
        ],
        exclude: ["tests/e2e/**", "dist/**", "node_modules/**"],
        coverage: {
            provider: "v8",
            reportsDirectory: "./coverage/frontend",
            reporter: ["text", "html", "lcov"],
            include: ["src/**/*.{js,jsx}"],
            exclude: [
                "src/**/*.test.{js,jsx}",
                "src/main.jsx",
                "src/index.js",
            ],
        },
    },
});
