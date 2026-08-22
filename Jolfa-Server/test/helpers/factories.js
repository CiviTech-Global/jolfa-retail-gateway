import bcrypt from "bcrypt";
import { prisma } from "../../src/shared/prisma.js";
import { generateTokens } from "../../src/modules/auth/auth.service.js";
let counter = 0;
function uniquePhone() {
    counter += 1;
    // 11 digits total, well within the 10-15 char phone validation range.
    return `09${String(100000000 + counter).padStart(9, "0")}`;
}
export async function createTestUser(options = {}) {
    const password = options.password ?? "password123";
    // Low bcrypt cost factor keeps the test suite fast; the hash format is
    // identical to production, so bcrypt.compare() behaves the same either way.
    const passwordHash = await bcrypt.hash(password, 4);
    const user = await prisma.user.create({
        data: {
            phone: options.phone ?? uniquePhone(),
            email: options.email,
            passwordHash,
            role: options.role ?? "CUSTOMER",
            isActive: options.isActive ?? true,
            firstName: options.firstName,
            lastName: options.lastName,
        },
    });
    return { user, password };
}
export function getAuthToken(app, user) {
    return generateTokens(user, app).accessToken;
}
export async function createTestAdmin(options = {}) {
    return createTestUser({ ...options, role: "ADMIN" });
}
//# sourceMappingURL=factories.js.map