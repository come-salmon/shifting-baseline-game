import type {
  DotLevelDef,
  FaceParams,
  LevelCounts,
  Modality,
  PrevalenceConfig,
  RoundNumber,
  SpectrumValue,
  Stimulus,
} from '../types/experiment';
import { TARGET_MIN_LEVEL } from '../types/experiment';

export const LEVELS: readonly SpectrumValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const ROUND_TRIALS: Record<RoundNumber, number> = {
  1: 20,
  2: 30, // 10 tours supplémentaires au Round 2 pour stabiliser l'adaptation
};
export const TRIALS_PER_ROUND = 20; // Fallback / baseline
export const DEFAULT_SEED = 20180608; // Levari et al., Science, 29 Jun 2018 (arbitrary but fixed)

// ─────────────────────────────────────────────────────────────────────────────
// Prevalence schedules
// R1: 20 essais, 50% de stimuli >= 6 (10 cibles / 10 non-cibles).
// R2: 30 essais (+10 tours), 10% de stimuli >= 6 (exactement 3 cibles sur 30).
//     Forte prévalence sur les niveaux ambigus 3, 4 et 5 pour forcer
//     l'élargissement de la catégorie ("concept creep").
// ─────────────────────────────────────────────────────────────────────────────

const counts = (c: number[]): LevelCounts =>
  Object.fromEntries(c.map((n, i) => [i + 1, n])) as LevelCounts;

export const PREVALENCE_CONFIGS: Record<RoundNumber, PrevalenceConfig> = {
  1: {
    round: 1,
    label: 'Baseline calibration (balanced)',
    trialsPerRound: ROUND_TRIALS[1], // 20
    //                 L1 L2 L3 L4 L5 L6 L7 L8 L9 L10
    levelCounts: counts([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]), // 10 low (1–5) / 10 high (6–10)
    targetPrevalence: 0.5,
  },
  2: {
    round: 2,
    label: 'Prevalence reduction (rare targets - extended)',
    trialsPerRound: ROUND_TRIALS[2], // 30
    //                 L1 L2 L3 L4 L5  L6 L7 L8 L9 L10
    // Somme = 30 : 27 stimuli <= 5, et 3 cibles >= 6 (10% de cibles exactement)
    levelCounts: counts([2, 3, 5, 8, 9,  2, 0, 0, 1, 0]),
    targetPrevalence: 0.1,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic generation (seeded shuffle, no 3 identical levels in a row)
// ─────────────────────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function levelPool(levelCounts: LevelCounts): SpectrumValue[] {
  return LEVELS.flatMap((l) => Array<SpectrumValue>(levelCounts[l]).fill(l));
}

function hasTriple(seq: SpectrumValue[]): boolean {
  return seq.some((v, i) => i >= 2 && v === seq[i - 1] && v === seq[i - 2]);
}

/** Builds the ordered list of levels of a round (seeded, reproducible). */
export function buildLevelSequence(round: RoundNumber, seed: number): SpectrumValue[] {
  const rnd = mulberry32(seed + round * 7919);
  const pool = levelPool(PREVALENCE_CONFIGS[round].levelCounts);
  let seq = shuffle(pool, rnd);
  for (let tries = 0; tries < 50 && hasTriple(seq); tries++) seq = shuffle(pool, rnd);
  return seq;
}

/** Builds the 20 Stimulus items of one round for one modality. */
export function buildRoundStimuli(
  modality: Modality,
  round: RoundNumber,
  seed: number = DEFAULT_SEED,
): Stimulus[] {
  return buildLevelSequence(round, seed).map((spectrumValue, trialIndex) => ({
    id: `${modality}-r${round}-${String(trialIndex + 1).padStart(2, '0')}`,
    modality,
    spectrumValue,
    round,
    trialIndex,
    isTarget: spectrumValue >= TARGET_MIN_LEVEL,
  }));
}

/**
 * Full 40-trial sequences. Pass a per-player seed to get a different order
 * per participant (same level counts), or use the default fixed sequence.
 */
export function buildModalityStimuli(
  modality: Modality,
  seed: number = DEFAULT_SEED,
): Record<RoundNumber, Stimulus[]> {
  return { 1: buildRoundStimuli(modality, 1, seed), 2: buildRoundStimuli(modality, 2, seed) };
}

/** Default (fixed-seed) pre-generated stimuli: 20 + 20 per modality = 80 items. */
export const STIMULI: Record<Modality, Record<RoundNumber, Stimulus[]>> = {
  dots: buildModalityStimuli('dots'),
  faces: buildModalityStimuli('faces'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Modality 1: dots (Ultra-narrow HSL scale: 258° → 240°, S 68%, L 52%)
// Différence de nuance extrêmement subtile (~2° par palier) :
// les niveaux 1 à 10 forment un dégradé continu et subtil où les
// niveaux 4, 5 et 6 sont indiscernables sans repère absolu.
// ─────────────────────────────────────────────────────────────────────────────

export const DOT_LEVELS: Record<SpectrumValue, DotLevelDef> = {
  1: { level: 1, hue: 258, hex: '#6331D8' }, // violet bleuté très subtil
  2: { level: 2, hue: 256, hex: '#5E31D8' },
  3: { level: 3, hue: 254, hex: '#5831D8' },
  4: { level: 4, hue: 252, hex: '#5331D8' }, // zone d'indécision totale
  5: { level: 5, hue: 250, hex: '#4D31D8' }, // frontière 50%
  6: { level: 6, hue: 248, hex: '#4831D8' }, // quasi identique aux niveaux 4 et 5
  7: { level: 7, hue: 246, hex: '#4231D8' },
  8: { level: 8, hue: 244, hex: '#3C31D8' },
  9: { level: 9, hue: 242, hex: '#3731D8' },
  10: { level: 10, hue: 240, hex: '#3131D8' }, // bleu franc
};

export const DOT_RADIUS_PX = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Modality 2: faces (parametric SVG placeholders; swap in photos later)
// ─────────────────────────────────────────────────────────────────────────────

const face = (
  level: SpectrumValue,
  browAngle: number,
  browY: number,
  eyeOpen: number,
  mouthCurve: number,
  mouthWidth: number,
  teeth: number,
  jawTension: number,
  skin: string,
): FaceParams => ({
  level, browAngle, browY, eyeOpen, mouthCurve, mouthWidth, teeth, jawTension, skin,
  photoUrl: `/faces/level_${level}.jpg`,
});

export const FACE_PARAMS: Record<SpectrumValue, FaceParams> = {
  //      lvl brwAng brwY eyeOpen curve width teeth jaw  skin
  1: face(1, 0, -6, 1.0, 14, 56, 0, 0, '#F6D7B8'), // warm smile
  2: face(2, 0, -4, 1.0, 9, 54, 0, 0, '#F5D4B4'),
  3: face(3, 0, 0, 0.9, 2, 48, 0, 0, '#F3D0AE'), // deadpan
  4: face(4, 1, 0, 0.85, 0, 46, 0, 0, '#F2CDAA'),
  5: face(5, 3, 2, 0.6, -2, 46, 0, 0.3, '#F0C9A4'), // ambiguous: squint, flat
  6: face(6, 5, 3, 0.55, -4, 46, 0, 0.5, '#EEC4A0'), // ambiguous: clenched jaw
  7: face(7, 8, 4, 0.5, -7, 50, 0, 0.6, '#ECBE98'), // hostile stare
  8: face(8, 11, 5, 0.45, -9, 52, 0.2, 0.75, '#EAB790'),
  9: face(9, 14, 6, 0.4, -4, 58, 0.8, 0.9, '#E7AE88'), // scowl, teeth
  10: face(10, 17, 7, 0.35, -2, 62, 1, 1, '#E4A480'), // grimace, bared teeth
};

/** Generates the SVG markup of a face (viewBox 0 0 280 280). */
export function buildFaceSvg(level: SpectrumValue): string {
  const p = FACE_PARAMS[level];
  const cx = 140;
  const eyeY = 120;
  const eyeRx = 16;
  const eyeRy = 11 * p.eyeOpen + 2;
  const browBaseY = eyeY - 26 + p.browY;
  const mouthY = 200;
  const mw = p.mouthWidth / 2;
  const curve = p.mouthCurve;

  // Brows: inner end lowered by browAngle (angry V shape).
  const brow = (side: -1 | 1) => {
    const outerX = cx + side * 52;
    const innerX = cx + side * 14;
    return `<line x1="${outerX}" y1="${browBaseY - p.browAngle * 0.2}" x2="${innerX}" y2="${browBaseY + p.browAngle}" stroke="#3a2a20" stroke-width="7" stroke-linecap="round"/>`;
  };
  const eye = (side: -1 | 1) =>
    `<ellipse cx="${cx + side * 33}" cy="${eyeY}" rx="${eyeRx}" ry="${eyeRy}" fill="#fff" stroke="#3a2a20" stroke-width="2"/>` +
    `<circle cx="${cx + side * 33}" cy="${eyeY}" r="${Math.min(7, eyeRy - 1)}" fill="#2b1d14"/>`;

  const mouthPath = `M ${cx - mw} ${mouthY} Q ${cx} ${mouthY + curve * 2} ${cx + mw} ${mouthY}`;
  const teethSvg =
    p.teeth > 0
      ? `<path d="M ${cx - mw * 0.8} ${mouthY + 1} Q ${cx} ${mouthY + curve * 2 + 1} ${cx + mw * 0.8} ${mouthY + 1} L ${cx + mw * 0.8} ${mouthY + 3 + 12 * p.teeth} Q ${cx} ${mouthY + curve * 2 + 3 + 12 * p.teeth} ${cx - mw * 0.8} ${mouthY + 3 + 12 * p.teeth} Z" fill="#fff" stroke="#3a2a20" stroke-width="2" opacity="${Math.min(1, p.teeth + 0.2)}"/>`
      : '';
  const jaw =
    p.jawTension > 0
      ? `<line x1="${cx - 92}" y1="190" x2="${cx - 80}" y2="${200 + p.jawTension * 8}" stroke="#a5724e" stroke-width="3" opacity="${p.jawTension}"/>` +
        `<line x1="${cx + 92}" y1="190" x2="${cx + 80}" y2="${200 + p.jawTension * 8}" stroke="#a5724e" stroke-width="3" opacity="${p.jawTension}"/>`
      : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" width="280" height="280">` +
    `<defs><clipPath id="c"><circle cx="140" cy="140" r="140"/></clipPath></defs>` +
    `<g clip-path="url(#c)"><rect width="280" height="280" fill="#d9dde3"/>` +
    `<ellipse cx="140" cy="150" rx="100" ry="118" fill="${p.skin}" stroke="#a5724e" stroke-width="3"/>` +
    jaw + brow(-1) + brow(1) + eye(-1) + eye(1) +
    `<path d="M 140 130 L 134 165 L 146 165" fill="none" stroke="#a5724e" stroke-width="3" stroke-linecap="round"/>` +
    `${teethSvg}<path d="${mouthPath}" fill="none" stroke="#6b2d2d" stroke-width="5" stroke-linecap="round"/></g></svg>`
  );
}

/** data: URI usable directly as <img src>. */
export function faceDataUri(level: SpectrumValue): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildFaceSvg(level))}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Labels (binary choice)
// ─────────────────────────────────────────────────────────────────────────────

export const MODALITY_LABELS: Record<
  Modality,
  { title: string; base: string; target: string; lowEnd: string; highEnd: string }
> = {
  dots: { title: 'Dots', base: 'PURPLE', target: 'BLUE', lowEnd: 'Violet', highEnd: 'Blue' },
  faces: { title: 'Faces', base: 'NEUTRAL', target: 'THREATENING', lowEnd: 'Serene', highEnd: 'Threatening' },
};

