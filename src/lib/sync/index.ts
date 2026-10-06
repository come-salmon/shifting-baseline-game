import type { SyncAdapter } from './adapter';
import { localAdapter } from './local';
import { createFirebaseAdapter } from './firebase';
import { resolveSyncConfig } from './config';
import { reportSyncError } from './errors';

let adapter: SyncAdapter | null = null;

/** Adapter that fails loudly instead of hanging: used when config/init is broken. */
function brokenAdapter(message: string): SyncAdapter {
  const fail = async () => {};
  return {
    kind: 'none',
    subscribe(_room, _cb, onError) {
      queueMicrotask(() => onError?.(new Error(message)));
      return () => {};
    },
    createSession: fail,
    updateSession: fail,
    setPlayer: fail,
    addVote: fail,
  };
}

/** Never throws. Production builds never silently fall back to the local adapter. */
export function getAdapter(): SyncAdapter {
  if (adapter) return adapter;
  const cfg = resolveSyncConfig();
  if (cfg.problems.length) {
    const msg = cfg.problems.join('\n');
    reportSyncError('config', msg);
    return (adapter = brokenAdapter(msg));
  }
  if (cfg.backend === 'local') return (adapter = localAdapter);
  try {
    return (adapter = createFirebaseAdapter(cfg.firebase!));
  } catch (e) {
    const msg = `Firebase initialisation failed: ${e instanceof Error ? e.message : String(e)}`;
    reportSyncError('init', msg);
    return (adapter = brokenAdapter(msg));
  }
}
