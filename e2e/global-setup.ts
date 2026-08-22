import { execSync } from 'node:child_process'
import { serverEnv, SERVER_DIR } from './env'

/**
 * Runs once before the whole e2e suite, before either server boots.
 *
 * Creates/migrates/truncates/seeds the e2e database by shelling out to
 * Jolfa-Server/test/e2e/prepare-database.ts, which lives in that package so
 * Prisma resolves from its own node_modules.
 *
 * Note Playwright starts `webServer` BEFORE this hook, so the API server is
 * already up (and has already run its own boot seed) by the time this runs.
 * The prepare script therefore re-seeds after truncating; see its header.
 * The full server env is passed because the script imports the server's
 * `seedDefaults()`, which validates the whole env schema on load.
 */
export default function globalSetup(): void {
  execSync('npx tsx test/e2e/prepare-database.ts', {
    cwd: SERVER_DIR,
    env: serverEnv(),
    stdio: 'inherit',
  })
}
