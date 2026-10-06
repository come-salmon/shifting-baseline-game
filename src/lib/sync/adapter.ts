import type { Modality, Player, RoomState, RoundNumber, Session, TrialResponse } from '../../types/experiment';
import { DEFAULT_SEED } from '../../data/stimuli';

/** Backend-agnostic sync contract (Firebase RTDB, local BroadcastChannel, …). */
export interface SyncAdapter {
  readonly kind: 'firebase' | 'local';
  /** cb receives null when the room does not exist. Returns unsubscribe. */
  subscribe(room: string, cb: (state: RoomState | null) => void): () => void;
  /** (Re)creates the room: wipes players & votes. */
  createSession(session: Session): Promise<void>;
  updateSession(room: string, patch: Partial<Session>): Promise<void>;
  /** A player owns and writes its own record (no concurrent writers). */
  setPlayer(room: string, player: Player): Promise<void>;
  addVote(room: string, vote: TrialResponse): Promise<void>;
}

// ── Helpers shared by the adapters ───────────────────────────────────────────

const MODS: Modality[] = ['dots', 'faces'];
const ROUNDS: RoundNumber[] = [1, 2];

export function newSession(roomCode: string): Session {
  return {
    roomCode,
    status: 'LOBBY',
    selectedModality: null,
    round: null,
    playersConnected: 0,
    round1CompletedCount: 0,
    round2CompletedCount: 0,
    seed: DEFAULT_SEED + Math.floor(Math.random() * 100000),
    createdAt: Date.now(),
  };
}

export function createPlayer(id: string, name: string, isAnonymous: boolean): Player {
  const per = <T,>(v: T): Record<Modality, Record<RoundNumber, T>> => ({
    dots: { 1: v, 2: v },
    faces: { 1: v, 2: v },
  });
  return {
    id,
    name,
    isAnonymous,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    online: true,
    progress: per(0),
    completed: per(false),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizePlayer(id: string, raw: any): Player {
  const base = createPlayer(id, raw?.name ?? 'Player', !!raw?.isAnonymous);
  for (const m of MODS)
    for (const r of ROUNDS) {
      base.progress[m][r] = Number(raw?.progress?.[m]?.[r] ?? 0);
      base.completed[m][r] = !!raw?.completed?.[m]?.[r];
    }
  base.joinedAt = raw?.joinedAt ?? base.joinedAt;
  base.lastSeenAt = raw?.lastSeenAt ?? 0;
  base.online = raw?.online ?? true;
  return base;
}

export function normalizeRoom(raw: any): RoomState | null {
  if (!raw?.session) return null;
  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(raw.players ?? {})) players[id] = normalizePlayer(id, p);
  const votes: Record<string, TrialResponse> = {};
  for (const [id, v] of Object.entries(raw.votes ?? {})) votes[id] = { ...(v as TrialResponse), id };
  return { session: raw.session as Session, players, votes };
}

