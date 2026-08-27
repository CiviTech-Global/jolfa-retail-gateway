import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0"),
  API_PREFIX: z.string().default("/api/v1"),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("24h"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("*"),

  // Rate limiting. The global bucket is generous enough that a real shopper
  // never sees it; the auth bucket is deliberately tight because those routes
  // guard credentials and, via password reset, spend real money on SMS.
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW: z.string().default("15 minutes"),

  APP_URL: z.string().default("http://localhost:3001"),
  UPLOAD_DIR: z.string().default("uploads"),
  PUBLIC_UPLOAD_PATH: z.string().default("/uploads"),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  ZARINPAL_MERCHANT_ID: z.string().optional(),
  ZARINPAL_SANDBOX: z.enum(["true", "false"]).default("true"),
  ZARINPAL_CALLBACK_URL: z.string().optional(),
  ZIBAL_MERCHANT_ID: z.string().optional(),
  ZIBAL_CALLBACK_URL: z.string().optional(),
  KAVENEGAR_API_KEY: z.string().optional(),
  SMS_IR_API_KEY: z.string().optional(),
  SMS_SENDER_NUMBER: z.string().optional(),

  ADMIN_SEED_EMAIL: z.string().email().optional(),
  ADMIN_SEED_PHONE: z.string().optional(),
  ADMIN_SEED_PASSWORD: z.string().min(1).optional(),

  USER_SEED_EMAIL: z.string().email().optional(),
  USER_SEED_PHONE: z.string().optional(),
  USER_SEED_PASSWORD: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
