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
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
