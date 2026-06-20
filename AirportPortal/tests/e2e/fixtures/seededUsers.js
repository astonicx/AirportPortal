import { TEST_USER_PASSWORD, TEST_USERS_BY_KEY } from "../../db/seeds/testUsers.mjs";

function toSeededUser(user) {
    return {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: TEST_USER_PASSWORD,
        role: user.role,
        status: user.status,
        purpose: user.purpose,
        provisionedBy: user.provisionedBy,
        mustCompleteProfile: user.mustCompleteProfile,
        mustChangePassword: user.mustChangePassword,
    };
}

const selfRegisteredCustomer = toSeededUser(TEST_USERS_BY_KEY.selfRegisteredCustomer);

export const seededUsers = {
    // Backward-compatible aliases used in existing tests.
    customer: selfRegisteredCustomer,
    admin: toSeededUser(TEST_USERS_BY_KEY.admin),
    root: toSeededUser(TEST_USERS_BY_KEY.root),

    // Competition-required reusable test users.
    selfRegisteredCustomer,
    adminCreatedCustomer: toSeededUser(TEST_USERS_BY_KEY.adminCreatedCustomer),
    inactiveCustomer: toSeededUser(TEST_USERS_BY_KEY.inactiveCustomer),
    suspendedCustomer: toSeededUser(TEST_USERS_BY_KEY.suspendedCustomer),
};
