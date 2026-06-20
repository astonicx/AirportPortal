import { teardownTestDatabase } from "../../helpers/backend/sqliteTestEnv.mjs";

teardownTestDatabase();

console.log("test db teardown complete");
