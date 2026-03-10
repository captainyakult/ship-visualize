'use client';

import { Ship } from '@/types/ship';
import { VESSEL_TYPE_COLORS } from '@/utils/vesselTypes';

interface ShipMarkerProps {
  ship: Ship;
  isSelected: boolean;
}

export function ShipMarker({ ship, isSelected }: ShipMarkerProps) {
  const color = VESSEL_TYPE_COLORS[ship.type] ?? VESSEL_TYPE_COLORS.other;
  const size = isSelected ? 32 : 24;

  return (
    <div
      style={{
        transform: `rotate(${ship.heading}deg)`,
        width: size,
        height: size,
        transition: 'transform 0.5s ease, width 0.2s, height 0.2s',
        cursor: 'pointer',
        filter: isSelected ? `drop-shadow(0 0 6px ${color})` : 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Arrow/ship shape pointing up (north = 0°) */}
        <path
          d="M12 2 L20 20 L12 16 L4 20 Z"
          fill={color}
          stroke={isSelected ? 'white' : 'rgba(0,0,0,0.6)'}
          strokeWidth={isSelected ? 1.5 : 1}
          strokeLinejoin="round"
        />
        {/* Speed indicator dot - filled more when faster */}
        {ship.speed > 8 && (
          <circle cx="12" cy="12" r="2" fill="rgba(255,255,255,0.8)" />
        )}
      </svg>
    </div>
  );
}
