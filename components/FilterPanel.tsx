'use client';

import { VesselFilter } from '@/types/ship';
import { VESSEL_TYPE_COLORS } from '@/utils/vesselTypes';

const FILTERS: { value: VesselFilter; label: string; emoji: string }[] = [
  { value: 'all', label: 'All', emoji: '🌐' },
  { value: 'cargo', label: 'Cargo', emoji: '📦' },
  { value: 'tanker', label: 'Tanker', emoji: '🛢️' },
  { value: 'passenger', label: 'Passenger', emoji: '🚢' },
  { value: 'fishing', label: 'Fishing', emoji: '🎣' },
  { value: 'military', label: 'Military', emoji: '⚓' },
  { value: 'sailing', label: 'Sailing', emoji: '⛵' },
  { value: 'tug', label: 'Tug', emoji: '🔧' },
  { value: 'other', label: 'Other', emoji: '🚤' },
];

interface FilterPanelProps {
  activeFilter: VesselFilter;
  onFilterChange: (filter: VesselFilter) => void;
  counts: Record<string, number>;
  totalCount: number;
}

export function FilterPanel({ activeFilter, onFilterChange, counts, totalCount }: FilterPanelProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
      {FILTERS.map(({ value, label, emoji }) => {
        const isActive = activeFilter === value;
        const color = value === 'all' ? '#e2e8f0' : (VESSEL_TYPE_COLORS[value] ?? '#94a3b8');
        const count = value === 'all' ? totalCount : (counts[value] ?? 0);

        return (
          <button
            key={value}
            onClick={() => onFilterChange(value)}
            className={`
              flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              transition-all duration-200 whitespace-nowrap
              ${isActive
                ? 'shadow-lg scale-105'
                : 'bg-gray-800/70 text-gray-300 hover:bg-gray-700/70 hover:scale-105 border border-gray-600/40'
              }
            `}
            style={isActive ? {
              backgroundColor: `${color}20`,
              color,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: `${color}60`,
            } : {}}
          >
            <span>{emoji}</span>
            <span>{label}</span>
            {count > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-xs leading-none font-bold"
                style={{
                  backgroundColor: isActive ? `${color}30` : 'rgba(255,255,255,0.1)',
                  color: isActive ? color : '#94a3b8',
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
