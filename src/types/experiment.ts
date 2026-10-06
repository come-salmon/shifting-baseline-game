/**
 * Domain types for "The Shifting Baseline" (Prevalence-Induced Concept Change).
 * Shared by the Player (/play), Host (/host) and Dashboard (/dashboard) views
 * and by the sync layer (Firebase / Supabase / WebSocket).
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Stimuli
// ─────────────────────────────────────────────────────────────────────────────

/** Position on the standardized 1–10 spectrum. */
export type SpectrumValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type Modality = 'dots' | 'faces';

/** Round number: 1 = baseline (balanced), 2 = prevalence reduction. */
export type RoundNumber = 1 | 2;

/** A "target" (positive) item is spectrumValue >= TARGET_MIN_LEVEL (Blue / Threatening). */
export const TARGET_MIN_LEVEL = 6;

/** Binary answer. 1 = Target (Blue / Threatening), 0 = Base (Purple / Neutral). */
export type Response = 0 | 1;

export interface Stimulus {
  /** Unique id, e.g. "dots-r1-03" (modality-round-trialIndex, 1-based). */
  id: string;
  modality: Modality;
  spectrumValue: SpectrumValue;
  /** Round in which the item is shown. */
  round: RoundNumber;
  /** Position in the round (0-based, 0..19). */
  trialIndex: number;
  /** True if spectrumValue >= TARGET_MIN_LEVEL. */
  isTarget: boolean;
}

/** Visual definition of one dot level. */
export interface DotLevelDef {
  level: SpectrumValue;
  hue: number;
  hex: string;
}

/** Parameters driving the procedural SVG face (see buildFaceSvg). */
export interface FaceParams {
  level: SpectrumValue;
  /** Eyebrow inner-end drop in px (0 = relaxed/raised, >0 = furrowed/angry). */
  browAngle: number;
  /** Eyebrow vertical offset (negative = raised). */
  browY: number;
  /** Eye opening ratio 0..1 (1 = wide open, 0.3 = squint). */
  eyeOpen: number;
  /** Mouth curvature: >0 smile, 0 flat, <0 frown. */
  mouthCurve: number;
  /** Mouth width in px. */
  mouthWidth: number;
  /** 0..1 amount of bared teeth. */
  teeth: number;
  /** 0..1 jaw tension (clenched jaw lines). */
  jawTension: number;
  /** Skin tint (hex) — gets a bit redder as threat increases. */
  skin: string;
  /** Optional path to a real photo to replace the SVG placeholder. */
  photoUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Rounds, prevalence & sessions
// ─────────────────────────────────────────────────────────────────────────────

/** How many trials of each spectrum level appear in a round. */
export type LevelCounts = Record<SpectrumValue, number>;

export interface PrevalenceConfig {
  round: RoundNumber;
  label: string;
  trialsPerRound: number;
  /** Count of trials per spectrum level (sums to trialsPerRound). */
  levelCounts: LevelCounts;
  /** Share of trials with level >= TARGET_MIN_LEVEL (0.5 in R1, 0.1 in R2). */
  targetPrevalence: number;
}

/** Global session states (state machine driven by the Host). */
export type SessionStatus =
  | 'LOBBY'
  | 'GAME_SELECT'
  | 'ROUND_1_ACTIVE'
  | 'ROUND_1_PAUSE'
  | 'ROUND_2_ACTIVE'
  | 'ROUND_2_COMPLETE'
  | 'DASHBOARD_VIEW';

// ─────────────────────────────────────────────────────────────────────────────
// 3. Responses & computed metrics
// ─────────────────────────────────────────────────────────────────────────────

/** One answer (a "vote" in the DB). */
export interface TrialResponse {
  id: string;
  playerId: string;
  modality: Modality;
  round: RoundNumber;
  trialIndex: number;
  stimulusId: string;
  stimulusLevel: SpectrumValue;
  response: Response;
  reactionTimeMs: number;
  /** Timestamp (ms epoch). */
  answeredAt: number;
}

/** Detection rate at one spectrum level (the psychometric curve points). */
export interface LevelDetectionRate {
  level: SpectrumValue;
  /** Number of trials shown at this level. */
  n: number;
  /** Number of "Target" answers. */
  positives: number;
  /** positives / n, or null if n === 0. */
  rate: number | null;
}

/** How θ was obtained (logistic fit may fail on degenerate data). */
export type ThresholdMethod = 'logistic' | 'interpolation' | 'fallback' | 'insufficient';

export interface ThresholdResult {
  /** θ on the 1–10 scale (P(target) = 0.5), clamped to [1, 10]; null if unavailable. */
  theta: number | null;
  method: ThresholdMethod;
  /** Logistic coefficients when method === 'logistic'. */
  beta0?: number;
  beta1?: number;
}

/** Metrics of one player, for one modality, for one round. */
export interface RoundMetrics {
  round: RoundNumber;
  threshold: ThresholdResult;
  /** Always 10 entries (levels 1..10). */
  detectionByLevel: LevelDetectionRate[];
  /** Overall share of "Target" answers. */
  positiveRate: number;
  meanReactionTimeMs: number;
  trialsAnswered: number;
}

/** Round 1 vs Round 2 comparison for a player in one modality. */
export interface PlayerMetrics {
  playerId: string;
  modality: Modality;
  round1: RoundMetrics | null;
  round2: RoundMetrics | null;
  /** θ2 − θ1 (negative = concept creep). null if one threshold is missing. */
  delta: number | null;
  /** Concept creep = (θ1 − θ2) / θ1 in %, null if unavailable. */
  conceptCreepPct: number | null;
}

/** Room-level aggregate for one modality. */
export interface RoomAggregate {
  modality: Modality;
  /** Players with valid θ1 and θ2. */
  nPlayers: number;
  meanTheta1: number | null;
  meanTheta2: number | null;
  meanDelta: number | null;
  sdDelta: number | null;
  /** Share of players with delta < 0. */
  shareNegativeDelta: number | null;
  /** Pooled detection curve (all players' answers). */
  pooledDetection: Record<RoundNumber, LevelDetectionRate[]>;
  /** Paired-sample t-test on θ1 vs θ2 (optional, for the dashboard). */
  pairedT?: { t: number; df: number; pValue: number; cohensD: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Synchronized room / session state
// ─────────────────────────────────────────────────────────────────────────────

export interface Session {
  roomCode: string;
  status: SessionStatus;
  selectedModality: Modality | null;
  /** Current round (null before the game starts). */
  round: RoundNumber | null;
  playersConnected: number;
  round1CompletedCount: number;
  round2CompletedCount: number;
  /** Seed for trial sequences, so that all clients derive the same order if needed. */
  seed: number;
  createdAt: number;
  /** Set by Host when a round is launched (client sync reference). */
  roundStartedAt?: number;
}

export interface Player {
  id: string;
  name: string;
  isAnonymous: boolean;
  joinedAt: number;
  lastSeenAt: number;
  online: boolean;
  /** Progress per modality and round (number of answers). */
  progress: Record<Modality, Record<RoundNumber, number>>;
  /** Per-modality completion flags. */
  completed: Record<Modality, Record<RoundNumber, boolean>>;
  /** Precomputed metrics (optional cache; the dashboard may recompute from votes). */
  metrics?: Partial<Record<Modality, PlayerMetrics>>;
}

/** Full room snapshot (what the sync layer exposes to the clients). */
export interface RoomState {
  session: Session;
  players: Record<string, Player>;
  /** All answers, by id. */
  votes: Record<string, TrialResponse>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Dashboard filters
// ─────────────────────────────────────────────────────────────────────────────

export type PlayerScope = 'ROOM' | (string & {}); // 'ROOM' or a playerId

export interface DashboardFilters {
  modality: Modality;
  playerScope: PlayerScope;
}

