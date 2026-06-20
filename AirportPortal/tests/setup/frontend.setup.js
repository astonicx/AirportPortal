import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { frontendServer } from "./msw/frontend-server.js";

beforeAll(() => {
    frontendServer.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
    cleanup();
    frontendServer.resetHandlers();
    vi.restoreAllMocks();
});

afterAll(() => {
    frontendServer.close();
});
