import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, LayoutDashboard, Palette, RotateCcw, ScanFace, Users, Wifi, WifiOff } from 'lucide-react';
import { useOnlinePlayers, useRoom } from '../hooks/useRoom';
import { displayRoom, joinUrl, newRoomCode } from '../lib/room';
import { newSession } from '../lib/sync/adapter';
import { MODALITY_LABELS } from '../data/stimuli';
import StatCard from '../components/StatCard';
import type { Modality, SessionStatus } from '../types/experiment';

const ROOM_KEY = 'sb:hostRoom';
const BASE_KEY = 'sb:baseUrl';

const MOD_META: Record<Modality, { icon: typeof Palette; sub: string }> = {
  dots: { icon: Palette, sub: 'Purple vs. Blue' },
  faces: { icon: ScanFace, sub: 'Neutral vs. Threatening' },
};

export default function Host() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState(() => {
    const saved = localStorage.getItem(ROOM_KEY) ?? newRoomCode();
    localStorage.setItem(ROOM_KEY, saved);
    return saved;
  });
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem(BASE_KEY) ?? window.location.origin);
  const { state, loaded, adapter } = useRoom(roomCode);
  const online = useOnlinePlayers(state?.players ?? {});

  // Create the room if it does not exist yet.
  useEffect(() => {
    if (loaded && !state) void adapter.createSession(newSession(roomCode));
  }, [loaded, state, adapter, roomCode]);

  const session = state?.session;
  const players = useMemo(() => Object.values(state?.players ?? {}), [state?.players]);
  const onlinePlayers = players.filter((p) => online.has(p.id));
  const mod = session?.selectedModality ?? null;
  const status: SessionStatus = session?.status ?? 'LOBBY';

  const total = onlinePlayers.length;
  const c1 = mod ? onlinePlayers.filter((p) => p.completed[mod][1]).length : 0;
  const c2 = mod ? onlinePlayers.filter((p) => p.completed[mod][2]).length : 0;
  const ready1 = total > 0 && c1 / total > 0.9;
  const ready2 = total > 0 && c2 / total > 0.9;

  const upd = (patch: Parameters<typeof adapter.updateSession>[1]) => adapter.updateSession(roomCode, patch);

  // Auto-advance when every connected player is done.
  useEffect(() => {
    if (status === 'ROUND_1_ACTIVE' && total > 0 && c1 === total) void upd({ status: 'ROUND_1_PAUSE' });
    if (status === 'ROUND_2_ACTIVE' && total > 0 && c2 === total) void upd({ status: 'ROUND_2_COMPLETE' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, total, c1, c2]);

  // Keep the synced counters up to date for any external consumer.
  useEffect(() => {
    if (!session) return;
    if (session.playersConnected !== total || session.round1CompletedCount !== c1 || session.round2CompletedCount !== c2)
      void upd({ playersConnected: total, round1CompletedCount: c1, round2CompletedCount: c2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, c1, c2, session?.playersConnected]);

  const goDashboard = () => navigate(`/dashboard?room=${roomCode}`);

  const newRoom = () => {
    if (!confirm('Start a brand-new session? All current data will be lost.')) return;
    const code = newRoomCode();
    localStorage.setItem(ROOM_KEY, code);
    setRoomCode(code);
  };

  // ── Primary action (state machine)
  let primary: { label: string; disabled?: boolean; onClick: () => void; pulse?: boolean } | null = null;
  let skip: (() => void) | null = null;
  switch (status) {
    case 'LOBBY':
      primary = { label: 'Choose the game →', onClick: () => upd({ status: 'GAME_SELECT' }) };
      break;
    case 'GAME_SELECT':
      primary = {
        label: 'Start Round 1 (Calibration)',
        disabled: !mod,
        onClick: () => upd({ status: 'ROUND_1_ACTIVE', round: 1, roundStartedAt: Date.now() }),
      };
      break;
    case 'ROUND_1_ACTIVE':
    case 'ROUND_1_PAUSE': {
      const go = () => upd({ status: 'ROUND_2_ACTIVE', round: 2, roundStartedAt: Date.now() });
      if (status === 'ROUND_1_PAUSE' || ready1) primary = { label: 'Launch Round 2 (The Transition)', onClick: go };
      else {
        primary = { label: 'Round 1 in Progress…', disabled: true, onClick: go, pulse: true };
        skip = go;
      }
      break;
    }
    case 'ROUND_2_ACTIVE':
    case 'ROUND_2_COMPLETE': {
      const go = () => {
        void upd({ status: 'DASHBOARD_VIEW' });
        goDashboard();
      };
      if (status === 'ROUND_2_COMPLETE' || ready2) primary = { label: 'Reveal Aggregate Results', onClick: go };
      else {
        primary = { label: 'Round 2 in Progress…', disabled: true, onClick: go, pulse: true };
        skip = go;
      }
      break;
    }
    case 'DASHBOARD_VIEW':
      primary = { label: 'Open Results Dashboard', onClick: goDashboard };
      break;
  }

  const otherMod: Modality | null = mod ? (mod === 'dots' ? 'faces' : 'dots') : null;
  const showQR = status === 'LOBBY' || status === 'GAME_SELECT';
  const url = joinUrl(baseUrl, roomCode);
  const steps: { s: SessionStatus[]; label: string }[] = [
    { s: ['LOBBY'], label: 'Lobby' },
    { s: ['GAME_SELECT'], label: 'Game' },
    { s: ['ROUND_1_ACTIVE', 'ROUND_1_PAUSE'], label: 'Round 1' },
    { s: ['ROUND_2_ACTIVE', 'ROUND_2_COMPLETE'], label: 'Round 2' },
    { s: ['DASHBOARD_VIEW'], label: 'Results' },
  ];

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-slate-900 px-4 py-2 text-2xl font-bold tracking-wider">{displayRoom(roomCode)}</div>
          {mod && (
            <div className="rounded-xl bg-indigo-600/20 px-4 py-2 font-medium text-indigo-300">
              {mod === 'dots' ? '[Dots: Blue/Purple]' : '[Faces: Threat/Neutral]'}
            </div>
          )}
          <div
            title={adapter.kind === 'local' ? 'Local sync: same browser only. Configure Firebase for phones.' : 'Firebase realtime'}
            className={`flex items-center gap-1 text-sm ${adapter.kind === 'local' ? 'text-amber-400' : 'text-emerald-400'}`}
          >
            {adapter.kind === 'local' ? <WifiOff size={16} /> : <Wifi size={16} />}
            {adapter.kind === 'local' ? 'Local sync' : 'Firebase'}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={newRoom} className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-3 text-sm hover:bg-slate-700" title="New session">
            <RotateCcw size={18} />
          </button>
          <button onClick={goDashboard} className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 font-semibold hover:bg-slate-700">
            <LayoutDashboard size={20} /> View Analytics &amp; Data
          </button>
        </div>
      </header>

      {/* Stepper */}
      <ol className="flex gap-2">
        {steps.map((st) => (
          <li key={st.label} className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${st.s.includes(status) ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-500'}`}>
            {st.label}
          </li>
        ))}
      </ol>

      {/* Live monitors */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Connected Players" icon={<Users size={20} />} value={total} sub="online" />
        <StatCard
          label="Round 1 Completion"
          value={`${c1} / ${total}`}
          accent={total > 0 && c1 === total ? 'text-emerald-400' : 'text-white'}
          icon={total > 0 && c1 === total ? <CheckCircle2 className="text-emerald-400" size={20} /> : undefined}
          sub={total > 0 && c1 === total ? 'all completed' : 'completed'}
        />
        <StatCard
          label="Round 2 Completion"
          value={`${c2} / ${total}`}
          accent={total > 0 && c2 === total ? 'text-emerald-400' : 'text-white'}
          icon={status === 'ROUND_2_ACTIVE' && c2 < total ? <span className="h-3 w-3 animate-ping rounded-full bg-indigo-400" /> : undefined}
          sub={status === 'ROUND_2_ACTIVE' && c2 < total ? 'active…' : 'completed'}
        />
      </section>

      {/* Game select */}
      {status === 'GAME_SELECT' && (
        <section className="grid gap-4 md:grid-cols-2">
          {(['dots', 'faces'] as Modality[]).map((m) => {
            const Icon = MOD_META[m].icon;
            const sel = mod === m;
            return (
              <button
                key={m}
                onClick={() => upd({ selectedModality: m })}
                className={`flex items-center gap-5 rounded-2xl border-2 p-6 text-left transition ${sel ? 'border-indigo-500 bg-indigo-600/20' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}
              >
                <Icon size={48} className={sel ? 'text-indigo-300' : 'text-slate-400'} />
                <div>
                  <div className="text-2xl font-bold">{m === 'dots' ? 'Game 1 — Colored Dots' : 'Game 2 — Faces'}</div>
                  <div className="text-slate-400">{MOD_META[m].sub}</div>
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* QR + lobby */}
      {showQR && (
        <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 md:grid-cols-[auto_1fr]">
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG value={url} size={status === 'LOBBY' ? 260 : 180} />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold">Scan to join</h2>
            <label className="text-sm text-slate-400">
              Base URL (use your public/LAN address so phones can reach it)
              <input
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  localStorage.setItem(BASE_KEY, e.target.value);
                }}
                className="mt-1 w-full rounded-lg bg-slate-800 p-2 text-slate-100"
              />
            </label>
            <div className="break-all text-sm text-indigo-300">{url}</div>
            <div className="flex flex-wrap gap-2">
              {onlinePlayers.map((p) => (
                <span key={p.id} className="rounded-full bg-slate-800 px-3 py-1 text-sm">{p.name}</span>
              ))}
              {total === 0 && <span className="text-slate-500">Waiting for players…</span>}
            </div>
          </div>
        </section>
      )}

      {/* Stage controls */}
      <section className="mt-auto flex flex-col items-center gap-3 pb-4">
        {primary && (
          <button
            disabled={primary.disabled}
            onClick={primary.onClick}
            className={`w-full max-w-xl rounded-2xl px-8 py-5 text-xl font-bold transition ${primary.disabled ? 'cursor-not-allowed bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500'} ${primary.pulse ? 'animate-pulse' : ''}`}
          >
            {primary.label}
          </button>
        )}
        {skip && (
          <button onClick={skip} className="text-sm text-slate-500 underline hover:text-slate-300">
            Skip the wait (advance anyway)
          </button>
        )}
        {status === 'DASHBOARD_VIEW' && otherMod && (
          <button
            onClick={() => upd({ status: 'GAME_SELECT', selectedModality: otherMod, round: null })}
            className="rounded-xl bg-slate-800 px-6 py-3 font-semibold hover:bg-slate-700"
          >
            Play the other game ({MODALITY_LABELS[otherMod].title})
          </button>
        )}
      </section>
    </div>
  );
}

