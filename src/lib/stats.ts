import type {
  LevelDetectionRate,
  Modality,
  PlayerMetrics,
  RoomAggregate,
  RoundMetrics,
  RoundNumber,
  ThresholdResult,
  TrialResponse,
} from '../types/experiment';
import { LEVELS } from '../data/stimuli';

/** Minimum answers in a round to attempt a θ estimate. */
export const MIN_TRIALS_FOR_THETA = 10;
const CENTER = 5.5;

export const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─────────────────────────────────────────────────────────────────────────────
// Detection rate per spectrum level
// ─────────────────────────────────────────────────────────────────────────────

export function levelRates(
  votes: Pick<TrialResponse, 'stimulusLevel' | 'response'>[],
): LevelDetectionRate[] {
  const n = new Array(11).fill(0) as number[];
  const k = new Array(11).fill(0) as number[];
  for (const v of votes) {
    n[v.stimulusLevel]++;
    k[v.stimulusLevel] += v.response;
  }
  return LEVELS.map((level) => ({
    level,
    n: n[level],
    positives: k[level],
    rate: n[level] > 0 ? k[level] / n[level] : null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Logistic fit  logit(P) = β0 + β1·level   (grouped binomial, Newton–Raphson,
// small ridge on the slope so perfectly separable data still gives a finite θ)
// ─────────────────────────────────────────────────────────────────────────────

interface CenteredFit {
  b0: number; // intercept for (level - 5.5)
  b1: number;
}

export function fitLogistic(rates: LevelDetectionRate[], ridge = 0.1): CenteredFit | null {
  const g = rates.filter((r) => r.n > 0);
  if (g.length < 2) return null;
  let b0 = 0;
  let b1 = 0.5;
  for (let it = 0; it < 100; it++) {
    let g0 = 0, g1 = 0, h00 = 1e-9, h01 = 0, h11 = ridge;
    for (const r of g) {
      const x = r.level - CENTER;
      const p = sigmoid(b0 + b1 * x);
      const res = r.positives - r.n * p;
      const w = r.n * p * (1 - p);
      g0 += res;
      g1 += x * res;
      h00 += w;
      h01 += w * x;
      h11 += w * x * x;
    }
    g1 -= ridge * b1;
    const det = h00 * h11 - h01 * h01;
    if (Math.abs(det) < 1e-12) break;
    const d0 = clamp((h11 * g0 - h01 * g1) / det, -2, 2);
    const d1 = clamp((-h01 * g0 + h00 * g1) / det, -2, 2);
    b0 = clamp(b0 + d0, -30, 30);
    b1 = clamp(b1 + d1, -30, 30);
    if (Math.max(Math.abs(d0), Math.abs(d1)) < 1e-7) break;
  }
  return Number.isFinite(b0) && Number.isFinite(b1) ? { b0, b1 } : null;
}

/** Returns P(target | level) from the logistic fit, or null if not fittable. */
export function fitProbability(rates: LevelDetectionRate[]): ((x: number) => number) | null {
  const f = fitLogistic(rates);
  return f ? (x: number) => sigmoid(f.b0 + f.b1 * (x - CENTER)) : null;
}

function interpolatedThreshold(rates: LevelDetectionRate[]): number {
  const pts = rates.filter((r) => r.rate !== null);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const ra = a.rate as number, rb = b.rate as number;
    if (ra < 0.5 && rb >= 0.5) return a.level + ((0.5 - ra) / (rb - ra)) * (b.level - a.level);
  }
  const total = rates.reduce((s, r) => s + r.n, 0);
  const pos = rates.reduce((s, r) => s + r.positives, 0);
  return total > 0 && pos / total >= 0.5 ? 1 : 10;
}

/** θ = level where P(target) = 0.5. */
export function computeThreshold(rates: LevelDetectionRate[]): ThresholdResult {
  const total = rates.reduce((s, r) => s + r.n, 0);
  if (total < MIN_TRIALS_FOR_THETA) return { theta: null, method: 'insufficient' };
  const fit = fitLogistic(rates);
  if (fit && fit.b1 > 0.05) {
    const theta = clamp(CENTER - fit.b0 / fit.b1, 1, 10);
    return { theta, method: 'logistic', beta0: fit.b0 - CENTER * fit.b1, beta1: fit.b1 };
  }
  const theta = clamp(interpolatedThreshold(rates), 1, 10);
  return { theta, method: 'fallback' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per player / per round
// ─────────────────────────────────────────────────────────────────────────────

export function computeRoundMetrics(votes: TrialResponse[], round: RoundNumber): RoundMetrics | null {
  if (votes.length === 0) return null;
  const rates = levelRates(votes);
  return {
    round,
    threshold: computeThreshold(rates),
    detectionByLevel: rates,
    positiveRate: votes.reduce((s, v) => s + v.response, 0) / votes.length,
    meanReactionTimeMs: votes.reduce((s, v) => s + v.reactionTimeMs, 0) / votes.length,
    trialsAnswered: votes.length,
  };
}

export function computePlayerMetrics(
  playerId: string,
  modality: Modality,
  allVotes: TrialResponse[],
): PlayerMetrics {
  const mine = allVotes.filter((v) => v.playerId === playerId && v.modality === modality);
  const round1 = computeRoundMetrics(mine.filter((v) => v.round === 1), 1);
  const round2 = computeRoundMetrics(mine.filter((v) => v.round === 2), 2);
  const t1 = round1?.threshold.theta ?? null;
  const t2 = round2?.threshold.theta ?? null;
  return {
    playerId,
    modality,
    round1,
    round2,
    delta: t1 !== null && t2 !== null ? t2 - t1 : null,
    conceptCreepPct: t1 !== null && t2 !== null && t1 > 0 ? ((t1 - t2) / t1) * 100 : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Room aggregate + paired t-test
// ─────────────────────────────────────────────────────────────────────────────

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

function lgamma(xx: number): number {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = xx;
  let tmp = xx + 5.5;
  tmp -= (xx + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / xx);
}

function betacf(a: number, b: number, x: number): number {
  const FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}

function ibeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(a, b, x)) / a
    : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value of Student's t. */
export function studentTwoTailP(t: number, df: number): number {
  return ibeta(df / (df + t * t), df / 2, 0.5);
}

export function computeRoomAggregate(
  modality: Modality,
  metrics: PlayerMetrics[],
  votes: TrialResponse[],
): RoomAggregate {
  const paired = metrics.filter(
    (m) => m.round1?.threshold.theta != null && m.round2?.threshold.theta != null,
  );
  const t1 = paired.map((m) => m.round1!.threshold.theta as number);
  const t2 = paired.map((m) => m.round2!.threshold.theta as number);
  const d = t1.map((v, i) => t2[i] - v);
  const n = paired.length;

  const agg: RoomAggregate = {
    modality,
    nPlayers: n,
    meanTheta1: n ? mean(t1) : null,
    meanTheta2: n ? mean(t2) : null,
    meanDelta: n ? mean(d) : null,
    sdDelta: n > 1 ? sd(d) : null,
    shareNegativeDelta: n ? d.filter((x) => x < 0).length / n : null,
    pooledDetection: {
      1: levelRates(votes.filter((v) => v.round === 1)),
      2: levelRates(votes.filter((v) => v.round === 2)),
    },
  };
  if (n > 2) {
    const s = sd(d);
    if (s > 1e-9) {
      const t = mean(d) / (s / Math.sqrt(n));
      agg.pairedT = { t, df: n - 1, pValue: studentTwoTailP(t, n - 1), cohensD: mean(d) / s };
    }
  }
  return agg;
}

