import { useEffect, useRef, useState } from 'react';
import type { Player, RoomState } from '../types/experiment';
import { getAdapter } from '../lib/sync';

const FIRST_SNAPSHOT_TIMEOUT_MS = 10000;

/** Subscribes to a room. Updates are throttled (150 ms) to survive vote bursts. */
export function useRoom(roomCode: string | null) {
  const adapter = getAdapter();
  const [state, setState] = useState<RoomState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(null);
    setLoaded(false);
    setError(null);
    if (!roomCode) return;
    let first = true;
    let latest: RoomState | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Never wait forever for the first snapshot.
    const watchdog = setTimeout(() => {
      if (first) {
        const msg = `No answer from the sync backend (${adapter.kind}) after ${FIRST_SNAPSHOT_TIMEOUT_MS / 1000}s for room ${roomCode}. Check the Firebase variables, database URL, rules and network.`;
        console.error('[useRoom] ' + msg);
        setError(msg);
      }
    }, FIRST_SNAPSHOT_TIMEOUT_MS);
    const unsub = adapter.subscribe(
      roomCode,
      (s) => {
        latest = s;
        if (first) {
          first = false;
          clearTimeout(watchdog);
          setError(null);
          setState(s);
          setLoaded(true);
        } else if (!timer) {
          timer = setTimeout(() => {
            timer = null;
            setState(latest);
          }, 150);
        }
      },
      (e) => {
        clearTimeout(watchdog);
        setError(e.message);
      },
    );
    return () => {
      unsub();
      clearTimeout(watchdog);
      if (timer) clearTimeout(timer);
    };
  }, [roomCode, adapter]);

  return { state, loaded, adapter, error };
}


/**
 * Clock-skew-free presence: a player is "online" if its heartbeat value changed
 * within the last 15 s, measured on THIS machine's clock.
 */
export function useOnlinePlayers(players: Record<string, Player>): Set<string> {
  const seen = useRef(new Map<string, { beat: number; at: number }>());
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2000);
    return () => clearInterval(t);
  }, []);
  const now = Date.now();
  const online = new Set<string>();
  for (const p of Object.values(players)) {
    const prev = seen.current.get(p.id);
    if (!prev || prev.beat !== p.lastSeenAt) seen.current.set(p.id, { beat: p.lastSeenAt, at: now });
    if (now - seen.current.get(p.id)!.at < 15000) online.add(p.id);
  }
  return online;
}

