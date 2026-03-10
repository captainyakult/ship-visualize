"use client";

import { VESSEL_TYPES, VesselType } from "@/types/ship";

interface FilterPanelProps {
  selectedType: VesselType;
  onTypeChange: (type: VesselType) => void;
  shipCount: number;
  loading: boolean;
}

export default function FilterPanel({
  selectedType,
  onTypeChange,
  shipCount,
  loading,
}: FilterPanelProps) {
  return (
    <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 min-w-[220px]">
      <div className="flex items-center gap-2 mb-3">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-blue-600"
        >
          <path d="M2 20l2-2h2l4-4-6-6 4-4 6 6 4-4h2l2-2" />
        </svg>
        <h2 className="font-semibold text-gray-800 text-sm">Ship Visualizer</h2>
      </div>

      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        Vessel Type
      </label>
      <select
        value={selectedType}
        onChange={(e) => onTypeChange(e.target.value as VesselType)}
        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
      >
        {VESSEL_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        {loading ? (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Loading ships...
          </span>
        ) : (
          <span>
            <strong className="text-gray-700">{shipCount}</strong> vessels visible
          </span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          {[
            { color: "bg-blue-500", label: "Cargo" },
            { color: "bg-red-500", label: "Tanker" },
            { color: "bg-green-500", label: "Passenger" },
            { color: "bg-yellow-500", label: "Fishing" },
            { color: "bg-purple-500", label: "Military" },
            { color: "bg-gray-400", label: "Other" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-gray-600">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
