import { useEffect, useRef, useState } from 'react';
import type { Player, RoomState } from '../types/experiment';
import { getAdapter } from '../lib/sync';

/** Subscribes to a room. Updates are throttled (150 ms) to survive vote bursts. */
export function useRoom(roomCode: string | null) {
  const adapter = getAdapter();
  const [state, setState] = useState<RoomState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setState(null);
    setLoaded(false);
    if (!roomCode) return;
    let first = true;
    let latest: RoomState | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = adapter.subscribe(roomCode, (s) => {
      latest = s;
      if (first) {
        first = false;
        setState(s);
        setLoaded(true);
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          setState(latest);
        }, 150);
      }
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [roomCode, adapter]);

  return { state, loaded, adapter };
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

