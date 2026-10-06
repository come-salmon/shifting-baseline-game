import type { PlayerMetrics } from '../../types/experiment';

interface Props {
  metrics: PlayerMetrics[];
  names: Record<string, string>;
  selected: string; // 'ROOM' or playerId
  onSelect: (id: string) => void;
  meanTheta1: number | null;
  meanTheta2: number | null;
}

const W = 560, H = 400, PT = 30, PB = 30, XL = 150, XR = 410;
const y = (v: number) => PT + ((10 - v) / 9) * (H - PT - PB);

/** Paired plot θ1 → θ2 per player, with arrows. */
export default function SlopeChart({ metrics, names, selected, onSelect, meanTheta1, meanTheta2 }: Props) {
  const rows = metrics.filter((m) => m.round1?.threshold.theta != null && m.round2?.threshold.theta != null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        {[['neg', '#818cf8'], ['pos', '#64748b'], ['sel', '#fbbf24']].map(([id, c]) => (
          <marker key={id} id={`arrow-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={c} />
          </marker>
        ))}
      </defs>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => (
        <g key={t}>
          <line x1={90} x2={W - 60} y1={y(t)} y2={y(t)} stroke="#1e293b" />
          <text x={78} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#64748b">{t}</text>
        </g>
      ))}
      <text x={XL} y={16} textAnchor="middle" fontSize="14" fill="#cbd5e1">θ₁ Round 1</text>
      <text x={XR} y={16} textAnchor="middle" fontSize="14" fill="#a5b4fc">θ₂ Round 2</text>
      {rows.map((m) => {
        const t1 = m.round1!.threshold.theta as number;
        const t2 = m.round2!.threshold.theta as number;
        const isSel = selected === m.playerId;
        const kind = isSel ? 'sel' : t2 < t1 ? 'neg' : 'pos';
        const color = { neg: '#818cf8', pos: '#64748b', sel: '#fbbf24' }[kind];
        return (
          <g key={m.playerId} onClick={() => onSelect(isSel ? 'ROOM' : m.playerId)} className="cursor-pointer">
            <title>{`${names[m.playerId] ?? m.playerId}: ${t1.toFixed(1)} → ${t2.toFixed(1)}`}</title>
            <line x1={XL} y1={y(t1)} x2={XR - 6} y2={y(t2)} stroke={color} strokeWidth={isSel ? 3.5 : 1.5} opacity={selected !== 'ROOM' && !isSel ? 0.25 : 0.75} markerEnd={`url(#arrow-${kind})`} />
            <circle cx={XL} cy={y(t1)} r={isSel ? 5 : 3} fill={color} />
            {/* wide invisible hit area */}
            <line x1={XL} y1={y(t1)} x2={XR} y2={y(t2)} stroke="transparent" strokeWidth={10} />
          </g>
        );
      })}
      {meanTheta1 !== null && meanTheta2 !== null && (
        <g>
          <line x1={XL} y1={y(meanTheta1)} x2={XR - 6} y2={y(meanTheta2)} stroke="#fff" strokeWidth={5} markerEnd="url(#arrow-neg)" />
          <text x={XL - 14} y={y(meanTheta1) + 4} textAnchor="end" fontSize="13" fontWeight="bold" fill="#fff">{meanTheta1.toFixed(1)}</text>
          <text x={XR + 14} y={y(meanTheta2) + 4} fontSize="13" fontWeight="bold" fill="#fff">{meanTheta2.toFixed(1)}</text>
        </g>
      )}
    </svg>
  );
}

