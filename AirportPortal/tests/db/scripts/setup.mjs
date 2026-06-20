import { setupTestDatabase, resetTestDatabase } from "../../helpers/backend/sqliteTestEnv.mjs";

await setupTestDatabase({ clean: true, withSeed: false });
await resetTestDatabase({ withSeed: true });

console.log("test db setup complete");
