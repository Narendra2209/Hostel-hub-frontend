/**
 * Public runtime configuration.
 *
 * Everything here is compiled into the JavaScript bundle and is therefore
 * public by definition. The database URL, the JWT signing secret and any other
 * secret live only on the server and must never appear in a VITE_* variable.
 */

const readEnv = (key: string, fallback = ''): string => {
  const value = import.meta.env[key as keyof ImportMetaEnv];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

export const config = {
  apiBaseUrl: readEnv('VITE_API_BASE_URL', 'http://localhost:4000/api').replace(/\/$/, ''),
} as const;
