import { useState } from 'react';
import type { Modality, SpectrumValue } from '../types/experiment';
import { DOT_LEVELS, faceDataUri } from '../data/stimuli';

/**
 * Instant-swap stimulus (no transition delay).
 * - 'dots': dynamic SVG glowing circle with tightened HSL palette (268° -> 240°).
 * - 'faces': loaded from /faces/level_${level}.jpg (local images), with styled fallback to procedural faceDataUri.
 */
export default function StimulusView({
  modality,
  level,
  size = 240,
}: {
  modality: Modality;
  level: SpectrumValue;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (modality === 'dots') {
    const hex = DOT_LEVELS[level].hex;
    return (
      <svg
        viewBox="0 0 240 240"
        width={size}
        height={size}
        style={{ filter: `drop-shadow(0 0 24px ${hex}88)` }}
      >
        <circle cx="120" cy="120" r="100" fill={hex} />
      </svg>
    );
  }

  // Modality: 'faces'
  // Image path directly served from public/faces/
  const imageSrc = `/faces/level_${level}.jpg`;

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-full shadow-2xl ring-2 ring-slate-800"
      style={{ width: size, height: size }}
    >
      <img
        key={`${level}-${imgFailed}`}
        src={imgFailed ? faceDataUri(level) : imageSrc}
        onError={() => setImgFailed(true)}
        width={size}
        height={size}
        alt={`Face level ${level}`}
        draggable={false}
        className="h-full w-full select-none object-cover rounded-full"
      />
    </div>
  );
}
