import { buildRoundStimuli } from './stimuli';
import type { Modality, Player, RoundNumber, SpectrumValue, TrialResponse } from '../types/experiment';
import { createPlayer } from '../lib/sync/adapter';
import { sigmoid } from '../lib/stats';

/**
 * Synthetic "Harvard-like" dataset for the offline / emergency demo mode.
 * Mirrors the spec's expected result: θ1 ≈ 5.8, θ2 ≈ 3.4, >85% of players with negative Δ.
 * Responses are sampled from each simulated player's own logistic curve over the real stimulus sequence.
 */

const NAMES = [
  'Alex', 'Sam', 'Léa', 'Hugo', 'Emma', 'Lucas', 'Chloé', 'Nathan', 'Inès', 'Louis', 'Jade', 'Arthur',
  'Manon', 'Jules', 'Camille', 'Tom', 'Sarah', 'Paul', 'Zoé', 'Adam', 'Lina', 'Noah', 'Eva', 'Maxime',
  'Clara', 'Théo', 'Anna', 'Enzo', 'Lola', 'Rayan', 'Alice', 'Victor', 'Yasmine', 'Antoine',
];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SampleDataset {
  players: Record<string, Player>;
  votes: TrialResponse[];
}

export function generateSampleDataset(nPlayers = 34, seed = 42): SampleDataset {
  const rnd = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const players: Record<string, Player> = {};
  const votes: TrialResponse[] = [];
  const mods: Modality[] = ['dots', 'faces'];
  const rounds: RoundNumber[] = [1, 2];

  for (let i = 0; i < nPlayers; i++) {
    const id = `demo_${String(i + 1).padStart(2, '0')}`;
    const p = createPlayer(id, NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${i}` : ''), false);
    for (const m of mods) {
      const theta1 = Math.min(8, Math.max(4, (m === 'dots' ? 5.9 : 5.7) + 0.55 * gauss()));
      const shift = (m === 'dots' ? 2.2 : 2.5) + 1.0 * gauss();
      const theta2 = Math.max(1.5, theta1 - shift);
      const slope = Math.max(0.8, 1.7 + 0.3 * gauss());
      for (const r of rounds) {
        const theta = r === 1 ? theta1 : theta2;
        const stims = buildRoundStimuli(m, r, 1000 + i * 17);
        stims.forEach((s) => {
          const response = rnd() < sigmoid(slope * (s.spectrumValue - theta)) ? 1 : 0;
          votes.push({
            id: `${id}_${m}_r${r}_${s.trialIndex}`,
            playerId: id,
            modality: m,
            round: r,
            trialIndex: s.trialIndex,
            stimulusId: s.id,
            stimulusLevel: s.spectrumValue as SpectrumValue,
            response,
            reactionTimeMs: Math.round(450 + 350 * rnd() + (s.spectrumValue >= 4 && s.spectrumValue <= 7 ? 150 : 0)),
            answeredAt: 0,
          });
        });
        p.progress[m][r] = 20;
        p.completed[m][r] = true;
      }
    }
    players[id] = p;
  }
  return { players, votes };
}

