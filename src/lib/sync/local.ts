import type { RoomState } from '../../types/experiment';
import type { SyncAdapter } from './adapter';
import { normalizeRoom } from './adapter';

/**
 * Local adapter: localStorage + BroadcastChannel.
 * Works across tabs/windows of the SAME browser (demo / offline fallback).
 */
const key = (room: string) => `sb:room:${room}`;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('shifting-baseline') : null;
const listeners = new Map<string, Set<(s: RoomState | null) => void>>();

function read(room: string): RoomState | null {
  try {
    const raw = localStorage.getItem(key(room));
    return raw ? normalizeRoom(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function notify(room: string) {
  const s = read(room);
  listeners.get(room)?.forEach((cb) => cb(s));
}

function write(room: string, state: RoomState) {
  localStorage.setItem(key(room), JSON.stringify(state));
  notify(room);
  channel?.postMessage(room);
}

channel?.addEventListener('message', (e) => notify(e.data as string));
window.addEventListener('storage', (e) => {
  if (e.key?.startsWith('sb:room:')) notify(e.key.slice('sb:room:'.length));
});

export const localAdapter: SyncAdapter = {
  kind: 'local',
  subscribe(room, cb) {
    if (!listeners.has(room)) listeners.set(room, new Set());
    listeners.get(room)!.add(cb);
    cb(read(room));
    return () => listeners.get(room)?.delete(cb);
  },
  async createSession(session) {
    write(session.roomCode, { session, players: {}, votes: {} });
  },
  async updateSession(room, patch) {
    const s = read(room);
    if (s) write(room, { ...s, session: { ...s.session, ...patch } });
  },
  async setPlayer(room, player) {
    const s = read(room);
    if (s) write(room, { ...s, players: { ...s.players, [player.id]: player } });
  },
  async addVote(room, vote) {
    const s = read(room);
    if (s) write(room, { ...s, votes: { ...s.votes, [vote.id]: vote } });
  },
};

