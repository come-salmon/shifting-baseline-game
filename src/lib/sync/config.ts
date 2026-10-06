/**
 * Single source of truth for every environment variable the app reads.
 * (Vite inlines VITE_* variables at BUILD time: after changing them on Vercel you must REDEPLOY.)
 */
const env = {
  VITE_SYNC_BACKEND: import.meta.env.VITE_SYNC_BACKEND as string | undefined,
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  VITE_FIREBASE_DATABASE_URL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const REQUIRED_FIREBASE_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export interface FirebaseConfig {
  apiKey: string;
  authDomain?: string;
  databaseURL: string;
  projectId: string;
  appId: string;
}

export type BackendKind = 'firebase' | 'local';

export interface SyncConfig {
  backend: BackendKind;
  firebase?: FirebaseConfig;
  /** Human-readable, multi-line description of every problem (empty if OK). */
  problems: string[];
}

const clean = (v: string | undefined) => (v ?? '').trim();

export function resolveSyncConfig(): SyncConfig {
  const explicit = clean(env.VITE_SYNC_BACKEND).toLowerCase();
  const problems: string[] = [];

  // Backend selection: explicit > (Firebase URL present or production build => firebase) > local.
  let backend: BackendKind;
  if (explicit === 'firebase' || explicit === 'local') backend = explicit;
  else {
    if (explicit) problems.push(`VITE_SYNC_BACKEND="${explicit}" is invalid (use "firebase" or "local").`);
    backend = clean(env.VITE_FIREBASE_DATABASE_URL) || import.meta.env.PROD ? 'firebase' : 'local';
  }

  if (backend === 'local') {
    if (import.meta.env.PROD)
      console.warn('[sync] LOCAL backend in production: phones will NOT see the host (same-browser only).');
    return { backend, problems };
  }

  const missing = REQUIRED_FIREBASE_VARS.filter((k) => !clean(env[k]));
  if (missing.length) {
    problems.push(`Missing or empty environment variable(s): ${missing.join(', ')}.`);
  }

  for (const k of REQUIRED_FIREBASE_VARS) {
    const v = clean(env[k]);
    if (v && /^["'`]|["'`]$/.test(v)) problems.push(`${k} contains quotes: remove them (paste the raw value only).`);
  }

  const url = clean(env.VITE_FIREBASE_DATABASE_URL).replace(/\/+$/, '');
  if (url && !/^https:\/\/[^/]+\.(firebaseio\.com|firebasedatabase\.app)$/.test(url))
    problems.push(
      `VITE_FIREBASE_DATABASE_URL looks malformed ("${url}"). Expected https://<db>.firebaseio.com or https://<db>.<region>.firebasedatabase.app`,
    );

  if (problems.length) {
    console.error(
      '[sync] Firebase configuration invalid:\n - ' +
        problems.join('\n - ') +
        '\nRequired: ' +
        REQUIRED_FIREBASE_VARS.join(', '),
    );
    return { backend, problems };
  }

  return {
    backend,
    problems,
    firebase: {
      apiKey: clean(env.VITE_FIREBASE_API_KEY),
      authDomain: clean(env.VITE_FIREBASE_AUTH_DOMAIN) || undefined,
      databaseURL: url,
      projectId: clean(env.VITE_FIREBASE_PROJECT_ID),
      appId: clean(env.VITE_FIREBASE_APP_ID),
    },
  };
}

