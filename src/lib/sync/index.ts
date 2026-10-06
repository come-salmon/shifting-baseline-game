import type { SyncAdapter } from './adapter';
import { localAdapter } from './local';
import { createFirebaseAdapter } from './firebase';

let adapter: SyncAdapter | null = null;

/** Firebase if VITE_FIREBASE_DATABASE_URL is configured, otherwise the local adapter. */
export function getAdapter(): SyncAdapter {
  if (!adapter) {
    const hasFirebase = !!import.meta.env.VITE_FIREBASE_DATABASE_URL;
    try {
      adapter = hasFirebase ? createFirebaseAdapter() : localAdapter;
    } catch (e) {
      console.error('Firebase init failed, falling back to local adapter', e);
      adapter = localAdapter;
    }
  }
  return adapter;
}

