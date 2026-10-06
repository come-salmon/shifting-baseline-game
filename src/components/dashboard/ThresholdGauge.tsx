import type { Modality } from '../../types/experiment';

function Bar({ label, value, color, note }: { label: string; value: number | null; color: string; note: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="text-3xl font-bold tabular-nums">{value !== null ? value.toFixed(1) : '–'} <span className="text-lg text-slate-500">/ 10</span></span>
      </div>
      <div className="relative h-8 overflow-hidden rounded-full bg-slate-800">
        {value !== null && <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${(value / 10) * 100}%` }} />}
        {[2, 4, 6, 8].map((t) => (
          <div key={t} className="absolute top-0 h-full w-px bg-slate-950/60" style={{ left: `${t * 10}%` }} />
        ))}
      </div>
      <div className="mt-1 text-sm text-slate-500">{note}</div>
    </div>
  );
}

export default function ThresholdGauge({
  theta1,
  theta2,
  modality,
}: {
  theta1: number | null;
  theta2: number | null;
  modality: Modality;
}) {
  const delta = theta1 !== null && theta2 !== null ? theta2 - theta1 : null;
  const what = modality === 'faces' ? 'mild stimuli re-coded as threats' : 'purple shades re-coded as blue';
  return (
    <div className="flex flex-col gap-6">
      <Bar label="Round 1 Boundary" value={theta1} color="bg-slate-400" note="Strict criterion" />
      <Bar label="Round 2 Boundary" value={theta2} color="bg-indigo-500" note="Dilated criterion" />
      {delta !== null && (
        <div className={`rounded-xl p-4 text-lg font-medium ${delta < 0 ? 'bg-indigo-600/20 text-indigo-200' : 'bg-slate-800 text-slate-300'}`}>
          {delta < 0
            ? `Boundary dropped by ${Math.abs(delta).toFixed(1)} levels: ${what}.`
            : `Boundary moved by ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} levels: no concept creep.`}
        </div>
      )}
    </div>
  );
}

