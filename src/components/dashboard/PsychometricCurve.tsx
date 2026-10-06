import { CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LevelDetectionRate } from '../../types/experiment';
import { fitProbability } from '../../lib/stats';

interface Props {
  rates1: LevelDetectionRate[];
  rates2: LevelDetectionRate[];
  theta1: number | null;
  theta2: number | null;
  targetLabel: string;
}

export default function PsychometricCurve({ rates1, rates2, theta1, theta2, targetLabel }: Props) {
  const f1 = fitProbability(rates1);
  const f2 = fitProbability(rates2);
  const data = Array.from({ length: 91 }, (_, k) => {
    const x = Math.round((1 + k * 0.1) * 10) / 10;
    const int = Number.isInteger(x);
    return {
      x,
      fit1: f1 ? f1(x) : null,
      fit2: f2 ? f2(x) : null,
      obs1: int ? rates1[x - 1]?.rate ?? null : null,
      obs2: int ? rates2[x - 1]?.rate ?? null : null,
    };
  });
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={data} margin={{ top: 10, right: 24, bottom: 24, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis
          dataKey="x"
          type="number"
          domain={[1, 10]}
          ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
          stroke="#94a3b8"
          label={{ value: 'Stimulus intensity (1–10)', position: 'insideBottom', offset: -12, fill: '#94a3b8' }}
        />
        <YAxis
          domain={[0, 1]}
          tickFormatter={pct}
          stroke="#94a3b8"
          label={{ value: `P(${targetLabel})`, angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
        />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
          formatter={(v: number) => (typeof v === 'number' ? pct(v) : v)}
          labelFormatter={(l) => `Level ${l}`}
        />
        <Legend verticalAlign="top" />
        <ReferenceLine y={0.5} stroke="#475569" strokeDasharray="2 4" />
        {theta1 !== null && (
          <ReferenceLine x={theta1} stroke="#9ca3af" strokeDasharray="6 4" label={{ value: `θ₁ ${theta1.toFixed(1)}`, fill: '#cbd5e1', position: 'top' }} />
        )}
        {theta2 !== null && (
          <ReferenceLine x={theta2} stroke="#818cf8" strokeDasharray="6 4" label={{ value: `θ₂ ${theta2.toFixed(1)}`, fill: '#a5b4fc', position: 'top' }} />
        )}
        <Line name="Round 1 (fit)" dataKey="fit1" stroke="#9ca3af" strokeWidth={3} dot={false} isAnimationActive={false} />
        <Line name="Round 2 (fit)" dataKey="fit2" stroke="#6366f1" strokeWidth={4} dot={false} isAnimationActive={false} />
        <Line name="Round 1 (observed)" dataKey="obs1" stroke="none" dot={{ r: 5, fill: '#9ca3af' }} isAnimationActive={false} legendType="circle" />
        <Line name="Round 2 (observed)" dataKey="obs2" stroke="none" dot={{ r: 5, fill: '#6366f1' }} isAnimationActive={false} legendType="circle" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

