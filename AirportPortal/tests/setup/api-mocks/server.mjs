import { setupServer } from "msw/node";
import { successHandlers } from "./handlers.mjs";

// Shared MSW server instance for API mocking in tests.
// Tests can use server.use() to override handlers as needed.
export const apiMockServer = setupServer(...successHandlers);

// Start server before tests, reset handlers between tests, stop after all tests.
export function setupApiMocks() {
    return {
        beforeAll: () => {
            apiMockServer.listen({ onUnhandledRequest: "error" });
        },
        afterEach: () => {
            apiMockServer.resetHandlers();
        },
        afterAll: () => {
            apiMockServer.close();
        },
    };
}
