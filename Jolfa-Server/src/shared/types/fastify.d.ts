import "@fastify/jwt";
import type { UserRole } from "@prisma/client";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: {
      id: string;
      email: string;
      phone: string;
      role: UserRole;
    };
  }
}
