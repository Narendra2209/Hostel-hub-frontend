/**
 * Where the session token lives.
 *
 * The API sets an HttpOnly cookie *and* returns the token. The cookie is the
 * safer of the two, but it only travels when the SPA and the API share a site -
 * and the production layout deliberately does not: the app is served from
 * CloudFront and the API from API Gateway, two different domains. So the token
 * is also kept here and sent as an `Authorization: Bearer` header, which works
 * regardless of origin.
 *
 * Keeping a token in localStorage means an XSS bug could steal it. That risk is
 * accepted knowingly and mitigated: the app renders no user-supplied HTML, the
 * CloudFront response-headers policy sets a strict `script-src 'self'` CSP, and
 * the token is short-lived (12 hours by default) and revocable server-side by
 * bumping the user's `tokenValidFrom`. The alternative - cookie only - would
 * simply not authenticate across the two origins.
 *
 * This is a credential cache, not application data. No hostel record is ever
 * stored in the browser.
 */

const STORAGE_KEY = 'hostel.session';

interface StoredSession {
  token: string;
  expiresAt: string;
}

/**
 * The in-memory copy is authoritative for this tab. localStorage is only there
 * so a refresh does not sign you out, and every read is wrapped because a
 * private window or a browser set to block site data throws on access.
 */
let current: StoredSession | null = null;
let loaded = false;

function readStorage(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.expiresAt) return null;
    // Discard an expired token rather than sending one we know is dead.
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (!loaded) {
    current = readStorage();
    loaded = true;
  }
  if (!current) return null;
  if (new Date(current.expiresAt).getTime() <= Date.now()) {
    clearSession();
    return null;
  }
  return current.token;
}

export function setSession(token: string, expiresAt: string): void {
  current = { token, expiresAt };
  loaded = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage unavailable - the in-memory copy still serves this tab.
  }
}

export function clearSession(): void {
  current = null;
  loaded = true;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

export const hasSession = (): boolean => getToken() !== null;
