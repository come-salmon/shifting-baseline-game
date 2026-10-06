import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Wifi } from 'lucide-react';
import { useRoom } from '../hooks/useRoom';
import { cleanRoom, displayRoom, getPlayerId, hashString } from '../lib/room';
import { createPlayer } from '../lib/sync/adapter';
import { buildRoundStimuli, MODALITY_LABELS } from '../data/stimuli';
import StimulusView from '../components/StimulusView';
import { SyncErrorScreen } from '../components/SyncError';
import type { Modality, Player, Response, RoundNumber, Stimulus, TrialResponse } from '../types/experiment';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950 p-5 text-center">{children}</div>
);

const Message = ({ icon, title, text }: { icon?: React.ReactNode; title: string; text?: string }) => (
  <Shell>
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      {icon}
      <h1 className="text-2xl font-bold">{title}</h1>
      {text && <p className="max-w-xs text-slate-400">{text}</p>}
    </div>
  </Shell>
);

// ─────────────────────────────────────────────────────────────────────────────
// Trial runner: 20 trials, instant swap, answers on pointerdown
// ─────────────────────────────────────────────────────────────────────────────
function TrialRunner({
  modality,
  round,
  seed,
  startIndex,
  onAnswer,
}: {
  modality: Modality;
  round: RoundNumber;
  seed: number;
  startIndex: number;
  onAnswer: (stim: Stimulus, response: Response, rtMs: number, isLast: boolean) => void;
}) {
  const stimuli = useMemo(() => buildRoundStimuli(modality, round, seed), [modality, round, seed]);
  const totalTrials = stimuli.length;
  const [idx, setIdx] = useState(Math.min(startIndex, totalTrials - 1));
  const [blank, setBlank] = useState(false);
  const [isMasked, setIsMasked] = useState(false);
  const shownAt = useRef(performance.now());
  const locked = useRef(false);
  const maskTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labels = MODALITY_LABELS[modality];
  // 1.0s (1000ms) pour les couleurs (dots), 1.75s (1750ms) pour les visages (faces)
  const exposureDurationMs = modality === 'faces' ? 1750 : 1000;

  // Gestion du timer d'exposition max par stimulus (1s dots, 1.75s faces)
  useEffect(() => {
    if (maskTimerRef.current) {
      clearTimeout(maskTimerRef.current);
      maskTimerRef.current = null;
    }

    if (!blank) {
      shownAt.current = performance.now();
      locked.current = false;
      setIsMasked(false);

      // Masquer le stimulus dès l'écoulement du cooldown
      maskTimerRef.current = setTimeout(() => {
        setIsMasked(true);
      }, exposureDurationMs);
    }

    return () => {
      if (maskTimerRef.current) {
        clearTimeout(maskTimerRef.current);
      }
    };
  }, [idx, blank, exposureDurationMs]);

  const answer = (response: Response) => {
    if (locked.current || blank) return;
    locked.current = true;
    if (maskTimerRef.current) {
      clearTimeout(maskTimerRef.current);
      maskTimerRef.current = null;
    }

    const rt = Math.round(performance.now() - shownAt.current);
    const isLast = idx + 1 >= totalTrials;
    onAnswer(stimuli[idx], response, rt, isLast);

    if (!isLast) {
      setBlank(true); // 180 ms inter-trial blank so the new stimulus is clearly a new event
      setTimeout(() => {
        setIdx((i) => i + 1);
        setBlank(false);
      }, 180);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') answer(0);
      if (e.key === 'ArrowRight') answer(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const btn =
    'h-[68px] flex-1 touch-none select-none rounded-2xl bg-slate-800 text-lg font-bold tracking-wide active:bg-indigo-600 transition-colors shadow-lg';

  const stimSize = modality === 'faces' ? 260 : 240;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950 p-4">
      {/* Barre de progression de la manche */}
      <div className="text-center text-sm font-medium tabular-nums text-slate-400">
        {idx + 1} / {totalTrials}
        <div className="mx-auto mt-2 h-1 w-40 overflow-hidden rounded bg-slate-800">
          <div className="h-full bg-indigo-500" style={{ width: `${((idx + 1) / totalTrials) * 100}%` }} />
        </div>
      </div>

      {/* Jauge d'exposition du stimulus (1.0s dots / 1.75s faces) */}
      <div className="mx-auto mt-4 h-1.5 w-64 overflow-hidden rounded-full bg-slate-900 border border-slate-800/80">
        {!blank && (
          <div
            key={`${modality}-${idx}`}
            className="h-full bg-amber-400/90 rounded-full"
            style={{
              animation: `countdown-timer ${exposureDurationMs}ms linear forwards`,
            }}
          />
        )}
      </div>

      {/* Zone centrale du stimulus ou masque neutre */}
      <div className="flex flex-1 items-center justify-center">
        {!blank && (
          isMasked ? (
            /* Masque visuel neutre après 1s pour empêcher l'analyse prolongée */
            <div
              className="flex items-center justify-center rounded-full bg-slate-900 border-2 border-slate-800 text-slate-600 shadow-2xl transition-all"
              style={{ width: stimSize, height: stimSize }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-800/80 animate-pulse" />
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Mémorisé</span>
              </div>
            </div>
          ) : (
            <StimulusView modality={modality} level={stimuli[idx].spectrumValue} size={stimSize} />
          )
        )}
      </div>

      {/* Boutons de réponse toujours disponibles */}
      <div className="flex gap-3 pb-2">
        <button className={btn} onPointerDown={() => answer(0)}>{labels.base}</button>
        <button className={btn} onPointerDown={() => answer(1)}>{labels.target}</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Play() {
  const [params] = useSearchParams();
  const playerId = useMemo(getPlayerId, []);
  const [roomInput, setRoomInput] = useState(params.get('room') ?? localStorage.getItem('sb:playRoom') ?? '');
  const [nameInput, setNameInput] = useState(localStorage.getItem('sb:playerName') ?? '');
  const [roomCode, setRoomCode] = useState<string | null>(() =>
    localStorage.getItem('sb:joinedRoom') === cleanRoom(params.get('room') ?? '') ? cleanRoom(params.get('room')!) : null,
  );
  const { state, loaded, adapter, error } = useRoom(roomCode);

  const [me, setMe] = useState<Player | null>(null);
  const meRef = useRef<Player | null>(null);
  const push = (p: Player) => {
    meRef.current = p;
    setMe(p);
    if (roomCode) void adapter.setPlayer(roomCode, p);
  };

  // Register / resume once the room is loaded.
  useEffect(() => {
    if (!roomCode || !loaded || !state || meRef.current) return;
    const name = localStorage.getItem('sb:playerName') || 'Anonymous';
    const base = state.players[playerId] ?? createPlayer(playerId, name, name === 'Anonymous');
    push({ ...base, name, online: true, lastSeenAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, loaded, state]);

  // Heartbeat.
  useEffect(() => {
    if (!roomCode) return;
    const t = setInterval(() => {
      if (meRef.current) push({ ...meRef.current, lastSeenAt: Date.now() });
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const join = (anonymous: boolean) => {
    const code = cleanRoom(roomInput);
    if (!code) return;
    const name = anonymous || !nameInput.trim() ? 'Anonymous' : nameInput.trim();
    localStorage.setItem('sb:playerName', name);
    localStorage.setItem('sb:playRoom', code);
    localStorage.setItem('sb:joinedRoom', code);
    meRef.current = null;
    setMe(null);
    setRoomCode(code);
  };

  // ── Join screen
  if (!roomCode) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col justify-center gap-4">
          <h1 className="text-3xl font-extrabold">Join the experiment</h1>
          <input
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            inputMode="numeric"
            placeholder="Room code (e.g. 8821)"
            className="rounded-xl bg-slate-800 p-4 text-center text-lg outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your name / nickname"
            maxLength={20}
            className="rounded-xl bg-slate-800 p-4 text-center text-lg outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button onClick={() => join(false)} className="rounded-xl bg-indigo-600 p-4 text-lg font-semibold active:bg-indigo-500">
            Join
          </button>
          <button onClick={() => join(true)} className="rounded-xl bg-slate-800 p-3 text-slate-300 active:bg-slate-700">
            Join anonymously
          </button>
        </div>
      </Shell>
    );
  }

  if (error) return <SyncErrorScreen message={error} />;
  if (loaded && !state) {
    return (
      <Message
        title="Room not found"
        text={`No active session for ${displayRoom(roomCode)}. Check the code.`}
        icon={
          <button
            className="rounded-xl bg-slate-800 px-4 py-2"
            onClick={() => {
              localStorage.removeItem('sb:joinedRoom');
              setRoomCode(null);
            }}
          >
            Back
          </button>
        }
      />
    );
  }
  if (!state || !me) {
    return <Message icon={<Loader2 className="animate-spin text-slate-400" />} title="Connecting…" />;
  }

  const { session } = state;
  const mod = session.selectedModality;
  const status = session.status;
  const waiting = (
    <Message
      icon={<Wifi className="text-emerald-400" size={36} />}
      title={`Connected, ${me.name}`}
      text="Waiting for the host to launch…"
    />
  );
  if (!mod) return waiting;

  const seed = (hashString(playerId) ^ session.seed) >>> 0;
  const c1 = me.completed[mod][1];
  const c2 = me.completed[mod][2];

  const commitAnswer = (round: RoundNumber) => (stim: Stimulus, response: Response, rt: number, isLast: boolean) => {
    const vote: TrialResponse = {
      id: `${playerId}_${mod}_r${round}_${stim.trialIndex}`,
      playerId,
      modality: mod,
      round,
      trialIndex: stim.trialIndex,
      stimulusId: stim.id,
      stimulusLevel: stim.spectrumValue,
      response,
      reactionTimeMs: rt,
      answeredAt: Date.now(),
    };
    void adapter.addVote(roomCode, vote);
    const cur = meRef.current!;
    push({
      ...cur,
      progress: { ...cur.progress, [mod]: { ...cur.progress[mod], [round]: stim.trialIndex + 1 } },
      completed: isLast ? { ...cur.completed, [mod]: { ...cur.completed[mod], [round]: true } } : cur.completed,
    });
  };

  if (!c1) {
    if (status === 'ROUND_1_ACTIVE' || status === 'ROUND_2_ACTIVE') {
      return (
        <TrialRunner key={`${mod}-1`} modality={mod} round={1} seed={seed} startIndex={me.progress[mod][1]} onAnswer={commitAnswer(1)} />
      );
    }
    return waiting;
  }
  if (!c2) {
    if (status === 'ROUND_2_ACTIVE') {
      return (
        <TrialRunner key={`${mod}-2`} modality={mod} round={2} seed={seed} startIndex={me.progress[mod][2]} onAnswer={commitAnswer(2)} />
      );
    }
    return (
      <Message
        icon={<CheckCircle2 className="text-emerald-400" size={44} />}
        title="Round 1 complete!"
        text="Wait for the host's instructions before Round 2."
      />
    );
  }
  return (
    <Message
      icon={<CheckCircle2 className="text-indigo-400" size={44} />}
      title="All trials completed!"
      text="Look up at the main screen to see how your brain adapted."
    />
  );
}

