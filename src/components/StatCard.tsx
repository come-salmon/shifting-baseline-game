import type { ReactNode } from 'react';

export default function StatCard({
  label,
  value,
  sub,
  accent = 'text-white',
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-center justify-between text-sm font-medium uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`mt-2 text-4xl font-bold tabular-nums ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-sm text-slate-400">{sub}</div>}
    </div>
  );
}

