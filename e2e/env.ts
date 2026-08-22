import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const REPO_ROOT = path.resolve(here, '..')
export const SERVER_DIR = path.join(REPO_ROOT, 'Jolfa-Server')
export const WEB_DIR = path.join(REPO_ROOT, 'Jolfa-web')

/**
 * Ports deliberately differ from the dev defaults (3001 / 5173) so an e2e run
 * never collides with — or silently talks to — a dev server the developer
 * already has running.
 */
export const API_PORT = 3101
export const WEB_PORT = 5174
export const API_BASE_URL = `http://localhost:${API_PORT}/api/v1`
export const WEB_BASE_URL = `http://localhost:${WEB_PORT}`

/** Accounts the API server seeds on boot from the env below. */
export const ADMIN = { phone: '09120000000', password: 'admin123' }
export const CUSTOMER = { phone: '09121111111', password: 'customer123' }

/**
 * Reads one key out of a dotenv-style file without pulling in a dotenv
 * dependency for this package.
 */
function readEnvValue(file: string, key: string): string | undefined {
  if (!fs.existsSync(file)) return undefined
  const match = fs.readFileSync(file, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match?.[1]?.trim()
}

/**
 * Derives the e2e database URL from Jolfa-Server/.env.test by swapping only
 * the database name. That keeps the local Postgres credentials in exactly one
 * gitignored place instead of duplicating them here. In CI, DATABASE_URL is
 * supplied directly by the workflow.
 */
export function resolveDatabaseUrl(): string {
  const fromEnv = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL
  const source = fromEnv ?? readEnvValue(path.join(SERVER_DIR, '.env.test'), 'DATABASE_URL')

  if (!source) {
    throw new Error(
      'Cannot resolve an e2e database URL. Create Jolfa-Server/.env.test (see .env.test.example) ' +
        'or set E2E_DATABASE_URL.',
    )
  }

  const url = new URL(source)
  url.pathname = '/jolfa_e2e'
  return url.toString()
}

/** The environment both servers are booted with. */
export function serverEnv(): Record<string, string> {
  return {
    ...(process.env as Record<string, string>),
    NODE_ENV: 'test',
    PORT: String(API_PORT),
    HOST: '127.0.0.1',
    API_PREFIX: '/api/v1',
    DATABASE_URL: resolveDatabaseUrl(),
    JWT_SECRET: 'e2e-secret-at-least-16-characters-long',
    JWT_ACCESS_EXPIRES_IN: '24h',
    JWT_REFRESH_EXPIRES_IN: '7d',
    CORS_ORIGIN: '*',
    APP_URL: `http://localhost:${API_PORT}`,
    UPLOAD_DIR: 'uploads-e2e',
    PUBLIC_UPLOAD_PATH: '/uploads',
    MAX_FILE_SIZE: '5242880',
    ZARINPAL_SANDBOX: 'true',
    ADMIN_SEED_PHONE: ADMIN.phone,
    ADMIN_SEED_PASSWORD: ADMIN.password,
    USER_SEED_PHONE: CUSTOMER.phone,
    USER_SEED_PASSWORD: CUSTOMER.password,
  }
}
