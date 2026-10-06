/** Room code / identity helpers (persisted in localStorage). */

export function newRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export const displayRoom = (code: string) => `ROOM-${code}`;

/** Accepts "8821", "ROOM-8821", " room-8821 ". */
export function cleanRoom(input: string): string {
  return input.trim().replace(/^room-?/i, '').trim();
}

export function getPlayerId(): string {
  let id = localStorage.getItem('sb:playerId');
  if (!id) {
    id = 'usr_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('sb:playerId', id);
  }
  return id;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function joinUrl(base: string, room: string): string {
  return `${base.replace(/\/$/, '')}/play?room=${room}`;
}

