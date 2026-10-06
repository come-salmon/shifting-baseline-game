import { useSyncExternalStore } from 'react';

/** Tiny global store of sync problems (init, connection, permission, write failures). */
const errors = new Map<string, string>();
let snapshot: string[] = [];
const listeners = new Set<() => void>();

function emit() {
  snapshot = [...errors.values()];
  listeners.forEach((l) => l());
}

export function reportSyncError(key: string, message: string) {
  if (errors.get(key) === message) return;
  errors.set(key, message);
  console.error(`[sync:${key}] ${message}`);
  emit();
}

export function clearSyncError(key: string) {
  if (errors.delete(key)) emit();
}

export function useSyncErrors(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
  );
}

