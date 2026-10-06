import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Database, Palette, ScanFace, Trash2 } from 'lucide-react';
import { useRoom } from '../hooks/useRoom';
import { computePlayerMetrics, computeRoomAggregate } from '../lib/stats';
import { generateSampleDataset, type SampleDataset } from '../data/sampleDataset';
import { MODALITY_LABELS } from '../data/stimuli';
import { displayRoom } from '../lib/room';
import StatCard from '../components/StatCard';
import { SyncErrorScreen } from '../components/SyncError';
import PsychometricCurve from '../components/dashboard/PsychometricCurve';
import ThresholdGauge from '../components/dashboard/ThresholdGauge';
import SlopeChart from '../components/dashboard/SlopeChart';
import type { Modality, TrialResponse } from '../types/experiment';

const fmt = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '–' : v.toFixed(d));
const fmtP = (p: number) => (p < 0.001 ? 'p < .001' : `p = ${p.toFixed(3)}`);

export default function Dashboard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const room = params.get('room') ?? localStorage.getItem('sb:hostRoom');
  const [sample, setSample] = useState<SampleDataset | null>(null);
  const { state, error } = useRoom(sample ? null : room);

  const [modality, setModality] = useState<Modality>(state?.session.selectedModality ?? 'dots');
  const [scope, setScope] = useState<string>('ROOM');

  const dataset = useMemo(() => {
    if (sample) return { players: sample.players, votes: sample.votes };
    return { players: state?.players ?? {}, votes: Object.values(state?.votes ?? {}) as TrialResponse[] };
  }, [sample, state]);

  const modVotes = useMemo(() => dataset.votes.filter((v) => v.modality === modality), [dataset, modality]);
  const playerIds = useMemo(() => [...new Set(modVotes.map((v) => v.playerId))], [modVotes]);
  const names = useMemo(() => {
    const o: Record<string, string> = {};
    playerIds.forEach((id) => (o[id] = dataset.players[id]?.name ?? id));
    return o;
  }, [playerIds, dataset]);
  const metrics = useMemo(() => playerIds.map((id) => computePlayerMetrics(id, modality, modVotes)), [playerIds, modality, modVotes]);
  const agg = useMemo(() => computeRoomAggregate(modality, metrics, modVotes), [modality, metrics, modVotes]);

  const selected = scope !== 'ROOM' ? metrics.find((m) => m.playerId === scope) : undefined;
  const isRoom = !selected;

  const rates1 = selected ? selected.round1?.detectionByLevel ?? [] : agg.pooledDetection[1];
  const rates2 = selected ? selected.round2?.detectionByLevel ?? [] : agg.pooledDetection[2];
  const theta1 = selected ? selected.round1?.threshold.theta ?? null : agg.meanTheta1;
  const theta2 = selected ? selected.round2?.threshold.theta ?? null : agg.meanTheta2;
  const delta = theta1 !== null && theta2 !== null ? theta2 - theta1 : null;
  const creep = theta1 && theta2 !== null ? ((theta1 - theta2) / theta1) * 100 : null;
  const labels = MODALITY_LABELS[modality];

  const seg = (m: Modality, Icon: typeof Palette, text: string) => (
    <button
      onClick={() => {
        setModality(m);
        setScope('ROOM');
      }}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold ${modality === m ? 'bg-indigo-600' : 'text-slate-300 hover:bg-slate-800'}`}
    >
      <Icon size={18} /> {text}
    </button>
  );

  const nTotal = playerIds.length;
  if (error && !sample) {
    return (
      <div>
        <SyncErrorScreen message={error} />
        <div className="fixed bottom-4 right-4">
          <button onClick={() => setSample(generateSampleDataset())} className="rounded-xl bg-amber-600/20 px-4 py-3 text-amber-300">Load sample dataset instead</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/host')} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-slate-300 hover:bg-slate-800">
            <ArrowLeft size={18} /> Host
          </button>
          <h1 className="text-2xl font-extrabold">Results Dashboard</h1>
          <span className="rounded-lg bg-slate-900 px-3 py-1 text-sm text-slate-400">
            {sample ? 'SAMPLE DATASET' : room ? displayRoom(room) : 'no room'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-slate-900 p-1">
            {seg('dots', Palette, 'Dots Experiment')}
            {seg('faces', ScanFace, 'Faces Experiment')}
          </div>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="rounded-xl bg-slate-900 px-4 py-3 text-slate-100 outline-none"
          >
            <option value="ROOM">👥 Whole Room (Room Average, N = {agg.nPlayers})</option>
            {playerIds.map((id, i) => (
              <option key={id} value={id}>
                Player #{i + 1} ({names[id]})
              </option>
            ))}
          </select>
          {sample ? (
            <button onClick={() => { setSample(null); setScope('ROOM'); }} className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 hover:bg-slate-700">
              <Trash2 size={16} /> Back to live data
            </button>
          ) : (
            <button onClick={() => { setSample(generateSampleDataset()); setScope('ROOM'); }} className="flex items-center gap-2 rounded-xl bg-amber-600/20 px-4 py-3 text-amber-300 hover:bg-amber-600/30">
              <Database size={16} /> Load sample dataset
            </button>
          )}
        </div>
      </header>

      {nTotal === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-16 text-center text-slate-400">
          No answers yet for <b>{labels.title}</b>. Wait for the players or load the sample dataset.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Round 1 threshold θ₁" value={fmt(theta1)} sub={isRoom ? `mean of ${agg.nPlayers} players` : names[scope]} accent="text-slate-200" />
            <StatCard label="Round 2 threshold θ₂" value={fmt(theta2)} sub="after prevalence drop" accent="text-indigo-300" />
            <StatCard label="Shift Δθ" value={delta !== null ? (delta > 0 ? '+' : '') + delta.toFixed(1) : '–'} sub={creep !== null ? `Concept creep ${creep > 0 ? '+' : ''}${creep.toFixed(0)}%` : undefined} accent={delta !== null && delta < 0 ? 'text-rose-400' : 'text-slate-200'} />
            {isRoom ? (
              <StatCard
                label="Players with Δ < 0"
                value={agg.shareNegativeDelta !== null ? `${Math.round(agg.shareNegativeDelta * 100)}%` : '–'}
                sub={agg.pairedT ? `paired t(${agg.pairedT.df}) = ${agg.pairedT.t.toFixed(2)}, ${fmtP(agg.pairedT.pValue)}, d = ${Math.abs(agg.pairedT.cohensD).toFixed(2)}` : undefined}
                accent="text-emerald-400"
              />
            ) : (
              <StatCard
                label="Positive rate R1 → R2"
                value={`${Math.round((selected?.round1?.positiveRate ?? 0) * 100)}% → ${Math.round((selected?.round2?.positiveRate ?? 0) * 100)}%`}
                sub={`share of “${labels.target}” answers`}
              />
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 lg:col-span-3">
              <h2 className="mb-2 text-lg font-bold">Psychometric curve — {isRoom ? 'whole room (pooled fit)' : names[scope]}</h2>
              <PsychometricCurve rates1={rates1} rates2={rates2} theta1={theta1} theta2={theta2} targetLabel={labels.target.toLowerCase()} />
              <p className="px-2 text-xs text-slate-500">
                θ = level at which P({labels.target.toLowerCase()}) = 50 % (logistic fit). Dashed lines: {isRoom ? 'mean of individual θ' : 'individual θ'}.
              </p>
            </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 lg:col-span-2">
              <h2 className="mb-4 text-lg font-bold">Threshold comparison</h2>
              <ThresholdGauge theta1={theta1} theta2={theta2} modality={modality} />
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 lg:col-span-2">
              <h2 className="mb-2 text-lg font-bold">Individual shifts (θ₁ → θ₂)</h2>
              <SlopeChart metrics={metrics} names={names} selected={scope} onSelect={setScope} meanTheta1={agg.meanTheta1} meanTheta2={agg.meanTheta2} />
              <p className="px-2 text-xs text-slate-500">Click a line to isolate a player. White = room mean.</p>
            </section>
            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-5 lg:col-span-3">
              <h2 className="mb-2 text-lg font-bold">Players</h2>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-left text-sm tabular-nums">
                  <thead className="sticky top-0 bg-slate-900 text-slate-400">
                    <tr><th className="p-2">#</th><th>Name</th><th>θ₁</th><th>θ₂</th><th>Δθ</th><th>RT R1</th><th>RT R2</th></tr>
                  </thead>
                  <tbody>
                    {metrics.map((m, i) => (
                      <tr key={m.playerId} onClick={() => setScope(m.playerId === scope ? 'ROOM' : m.playerId)} className={`cursor-pointer border-t border-slate-800 hover:bg-slate-800 ${m.playerId === scope ? 'bg-amber-500/10' : ''}`}>
                        <td className="p-2 text-slate-500">{i + 1}</td>
                        <td>{names[m.playerId]}</td>
                        <td>{fmt(m.round1?.threshold.theta)}</td>
                        <td>{fmt(m.round2?.threshold.theta)}</td>
                        <td className={m.delta !== null && m.delta < 0 ? 'text-rose-400' : 'text-slate-300'}>{m.delta !== null ? (m.delta > 0 ? '+' : '') + m.delta.toFixed(1) : '–'}</td>
                        <td className="text-slate-400">{m.round1 ? Math.round(m.round1.meanReactionTimeMs) : '–'} ms</td>
                        <td className="text-slate-400">{m.round2 ? Math.round(m.round2.meanReactionTimeMs) : '–'} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

