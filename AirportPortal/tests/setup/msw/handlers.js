// Import API mock handlers for external API calls
// These are re-exported as ESM from an MJS module to avoid import issues
let apiHandlers = [];

// Load API handlers synchronously for compatibility with CommonJS test files
try {
    // In test environments, API mocks are added dynamically per test file
    // This empty default allows tests to override handlers as needed
} catch (e) {
    // Fallback if import fails
}

export const handlers = [...apiHandlers];
