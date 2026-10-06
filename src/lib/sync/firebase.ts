import { initializeApp } from 'firebase/app';
import { getDatabase, onValue, ref, set, update } from 'firebase/database';
import type { SyncAdapter } from './adapter';
import { normalizeRoom } from './adapter';
import type { FirebaseConfig } from './config';
import { clearSyncError, reportSyncError } from './errors';

const CONNECT_TIMEOUT_MS = 8000;

const hint = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code ?? '';
  if (/permission[_ ]denied/i.test(code + msg))
    return `Firebase refused access (PERMISSION_DENIED). Check Realtime Database → Rules (test-mode rules expire after 30 days). Rules needed: {"rules":{".read":true,".write":true}}`;
  return msg;
};

/** Firebase Realtime Database adapter. Data lives under `rooms/<code>/{session,players,votes}`. */
export function createFirebaseAdapter(cfg: FirebaseConfig): SyncAdapter {
  const app = initializeApp(cfg);
  const db = getDatabase(app);
  console.info(`[sync] Firebase initialised (project=${cfg.projectId}, db=${cfg.databaseURL})`);

  // Connection watchdog: onValue/set never reject while offline, they just wait forever.
  let connected = false;
  const timer = setTimeout(() => {
    if (!connected)
      reportSyncError(
        'connection',
        `Cannot reach Firebase Realtime Database after ${CONNECT_TIMEOUT_MS / 1000}s. Check VITE_FIREBASE_DATABASE_URL (${cfg.databaseURL}), the network, and that the database exists.`,
      );
  }, CONNECT_TIMEOUT_MS);
  onValue(
    ref(db, '.info/connected'),
    (snap) => {
      connected = snap.val() === true;
      if (connected) {
        clearTimeout(timer);
        clearSyncError('connection');
      }
    },
    (e) => reportSyncError('connection', hint(e)),
  );

  const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o)); // Firebase rejects `undefined`
  const guard = async (label: string, p: Promise<unknown>) => {
    try {
      await p;
      clearSyncError('write');
    } catch (e) {
      reportSyncError('write', `${label} failed: ${hint(e)}`);
    }
  };

  return {
    kind: 'firebase',
    subscribe(room, cb, onError) {
      return onValue(
        ref(db, `rooms/${room}`),
        (snap) => cb(normalizeRoom(snap.val())),
        (e) => {
          reportSyncError('read', `Read of rooms/${room} failed: ${hint(e)}`);
          onError?.(e);
        },
      );
    },
    createSession: (session) => guard('Create session', set(ref(db, `rooms/${session.roomCode}`), { session: clean(session) })),
    updateSession: (room, patch) => guard('Update session', update(ref(db, `rooms/${room}/session`), clean(patch))),
    setPlayer: (room, player) => guard('Write player', set(ref(db, `rooms/${room}/players/${player.id}`), clean(player))),
    addVote: (room, vote) => guard('Write vote', set(ref(db, `rooms/${room}/votes/${vote.id}`), clean(vote))),
  };
}
