import { setupServer } from "msw/node";
import { successHandlers, errorHandlers } from "./frontend-handlers.js";

/**
 * MSW server instance for frontend component tests.
 * Exported so tests can override handlers as needed.
 */
export const frontendServer = setupServer(...successHandlers);

export * from "./frontend-handlers.js";
