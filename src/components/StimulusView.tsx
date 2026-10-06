import type { Modality, SpectrumValue } from '../types/experiment';
import { DOT_LEVELS, faceDataUri } from '../data/stimuli';

/** Instant-swap stimulus (no transition). */
export default function StimulusView({
  modality,
  level,
  size = 240,
}: {
  modality: Modality;
  level: SpectrumValue;
  size?: number;
}) {
  if (modality === 'dots') {
    const hex = DOT_LEVELS[level].hex;
    return (
      <svg viewBox="0 0 240 240" width={size} height={size} style={{ filter: `drop-shadow(0 0 24px ${hex}88)` }}>
        <circle cx="120" cy="120" r="100" fill={hex} />
      </svg>
    );
  }
  return (
    <img
      src={faceDataUri(level)}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className="select-none rounded-full"
      style={{ width: size, height: size }}
    />
  );
}
