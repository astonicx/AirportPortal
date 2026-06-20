import { resetTestDatabase } from "../../helpers/backend/sqliteTestEnv.mjs";

await resetTestDatabase({ withSeed: true });

console.log("test db reset complete");
