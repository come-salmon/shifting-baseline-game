import { initializeApp } from 'firebase/app';
import { getDatabase, onValue, ref, set, update } from 'firebase/database';
import type { SyncAdapter } from './adapter';
import { normalizeRoom } from './adapter';

/** Firebase Realtime Database adapter. Data lives under `rooms/<code>/{session,players,votes}`. */
export function createFirebaseAdapter(): SyncAdapter {
  const env = import.meta.env;
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const db = getDatabase(app);
  // Firebase rejects `undefined`; strip it.
  const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

  return {
    kind: 'firebase',
    subscribe(room, cb) {
      return onValue(ref(db, `rooms/${room}`), (snap) => cb(normalizeRoom(snap.val())));
    },
    async createSession(session) {
      await set(ref(db, `rooms/${session.roomCode}`), { session: clean(session) });
    },
    async updateSession(room, patch) {
      await update(ref(db, `rooms/${room}/session`), clean(patch));
    },
    async setPlayer(room, player) {
      await set(ref(db, `rooms/${room}/players/${player.id}`), clean(player));
    },
    async addVote(room, vote) {
      await set(ref(db, `rooms/${room}/votes/${vote.id}`), clean(vote));
    },
  };
}

