/**
 * Where the session lives on the client.
 *
 * Kept in one module so the API client and the auth context cannot disagree
 * about the storage keys, which is how a "logged out but still authenticated"
 * state gets created.
 */

const ACCESS_KEY = 'token'
const REFRESH_KEY = 'refreshToken'

/** localStorage throws in private-mode Safari and when site data is blocked. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // A session that cannot be persisted still works for this page view.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing to do — the token was never stored.
  }
}

export function getAccessToken(): string | null {
  return read(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return read(REFRESH_KEY)
}

export function setTokens(tokens: { accessToken: string; refreshToken?: string }): void {
  write(ACCESS_KEY, tokens.accessToken)
  if (tokens.refreshToken) write(REFRESH_KEY, tokens.refreshToken)
}

export function clearTokens(): void {
  remove(ACCESS_KEY)
  remove(REFRESH_KEY)
}
