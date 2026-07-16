import { createRequire } from "node:module";
import { TEST_USER_PASSWORD, TEST_USERS, TEST_USERS_BY_KEY } from "./testUsers.mjs";

const require = createRequire(import.meta.url);
const { hashPassword } = require("../../../server/utils/password");

export async function seedDeterministicData(db) {
    const passwordHash = await hashPassword(TEST_USER_PASSWORD);

    db.exec("BEGIN");
    try {
        const insertUser = db.prepare(
            `INSERT INTO users
             (id, type, user_type, first_name, last_name, email, password_hash, must_complete_profile, must_change_password, auto_logout_minutes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        for (const user of TEST_USERS) {
            insertUser.run(
                user.id,
                user.role,
                user.role,
                user.firstName,
                user.lastName,
                user.email,
                passwordHash,
                user.mustCompleteProfile ? 1 : 0,
                user.mustChangePassword ? 1 : 0,
                user.autoLogoutMinutes
            );
        }

        const insertQuestion = db.prepare(
            `INSERT INTO security_questions (user_id, question, answer_hash)
             VALUES (?, ?, ?)`
        );
        const recoveryQuestions = ["Favorite color?", "City born?", "Best friend?"];
        for (const user of TEST_USERS) {
            if (user.role !== "customer") continue;
            for (const question of recoveryQuestions) {
                insertQuestion.run(user.id, question, passwordHash);
            }
        }

        db.prepare(
            `INSERT INTO tickets
             (id, confirmation_code, user_id, flight_id, passenger_first, passenger_last, passenger_dob, passenger_gender,
              passenger_email, passenger_phone, seat, carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents, status)
             VALUES
             (1, 'SEED01', ?, 'SEED-FLIGHT-1', 'Seed', 'Customer', '1990-01-01', 'male',
              'seed.customer@test.local', '555-0001', '1A', 1, 0, 25000, 3000, 28000, 'active')`
        ).run(TEST_USERS_BY_KEY.selfRegisteredCustomer.id);

        const suspendedUser = TEST_USERS_BY_KEY.suspendedCustomer;
        if (suspendedUser?.lockout) {
            db.prepare(
                `INSERT INTO user_lockouts (user_id, locked_until, failed_count)
                 VALUES (?, datetime('now', ?), ?)`
            ).run(
                suspendedUser.id,
                `+${suspendedUser.lockout.lockHours} hour`,
                suspendedUser.lockout.failedCount
            );
        }

        db.prepare(
            `INSERT INTO flight_cache (flight_id, payload_json)
             VALUES (?, ?)`
        ).run(
            "SEED-FLIGHT-1",
            JSON.stringify({
                id: "SEED-FLIGHT-1",
                flight_id: "SEED-FLIGHT-1",
                flightNumber: "SD100",
                status: "scheduled",
                bookable: true,
                seat_price: 250,
                airline: "SeedAir",
                landingAt: "MWK",
                departFromSender: "2030-01-01T12:00:00.000Z",
                arriveAtReceiver: "2030-01-01T16:00:00.000Z",
            })
        );

        db.prepare(
            `INSERT INTO airline_bans (id, user_or_passenger_identity, airline)
             VALUES (1, 'seed customer 1990-01-01', 'seedair')`
        ).run();

        db.prepare(
            `INSERT INTO _test_seed_log (key, value, updated_at)
               VALUES ('deterministic_seed_version', 'v2', datetime('now'))
             ON CONFLICT(key)
             DO UPDATE SET value=excluded.value, updated_at=datetime('now')`
        ).run();

        db.exec("COMMIT");
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }
}
