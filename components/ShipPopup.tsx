'use client';

import { Ship } from '@/types/ship';
import { VESSEL_TYPE_COLORS, getVesselCategory } from '@/utils/vesselTypes';

interface ShipPopupProps {
  ship: Ship;
  onClose: () => void;
}

function InfoRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <div className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-white text-sm font-medium">{value}</div>
    </div>
  );
}

export function ShipPopup({ ship, onClose }: ShipPopupProps) {
  const color = VESSEL_TYPE_COLORS[ship.type] ?? VESSEL_TYPE_COLORS.other;
  const category = getVesselCategory(ship.type);
  const lastSeen = new Date(ship.timestamp).toLocaleTimeString();

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden w-64">
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between" style={{ borderBottom: `2px solid ${color}30` }}>
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="font-bold text-white text-sm leading-tight truncate">{ship.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${color}25`, color }}
            >
              {category}
            </span>
            {ship.speed > 0.5 && (
              <span className="text-xs text-gray-400">{ship.speed.toFixed(1)} kn</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-xl leading-none flex-shrink-0 mt-0.5"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Details grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        <InfoRow label="MMSI" value={ship.id.startsWith('demo') ? 'Demo vessel' : ship.id} />
        {ship.callsign && <InfoRow label="Call Sign" value={ship.callsign} />}
        <InfoRow label="Heading" value={`${Math.round(ship.heading)}°`} />
        {ship.destination && <InfoRow label="Destination" value={ship.destination} />}
        {ship.length && ship.length > 0 && (
          <InfoRow label="Dimensions" value={`${ship.length}m × ${ship.width}m`} />
        )}
      </div>

      {/* Position & timestamp footer */}
      <div className="px-4 pb-3">
        <div className="text-xs text-gray-500 font-mono">
          {ship.lat.toFixed(5)}°, {ship.lon.toFixed(5)}°
        </div>
        <div className="text-xs text-gray-600 mt-0.5">Updated {lastSeen}</div>
      </div>
    </div>
  );
}
