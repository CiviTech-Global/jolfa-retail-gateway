import type { FastifyInstance } from "fastify";
import type { UserRole, User } from "@prisma/client";
export interface CreateTestUserOptions {
    phone?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    isActive?: boolean;
    firstName?: string;
    lastName?: string;
}
export declare function createTestUser(options?: CreateTestUserOptions): Promise<{
    user: User;
    password: string;
}>;
export declare function getAuthToken(app: FastifyInstance, user: User): string;
export declare function createTestAdmin(options?: Omit<CreateTestUserOptions, "role">): Promise<{
    user: User;
    password: string;
}>;
//# sourceMappingURL=factories.d.ts.map