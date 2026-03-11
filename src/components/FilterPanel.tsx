"use client";

import { VESSEL_TYPES, VesselType, ConnectionStatus } from "@/types/ship";

interface FilterPanelProps {
  selectedType: VesselType;
  onTypeChange: (type: VesselType) => void;
  shipCount: number;
  status: ConnectionStatus;
  messageCount: number;
}

const STATUS_STYLES: Record<ConnectionStatus, { dot: string; text: string; label: string }> = {
  disconnected: { dot: "bg-red-500", text: "text-red-600", label: "Disconnected" },
  connecting: { dot: "bg-yellow-500 animate-pulse", text: "text-yellow-600", label: "Connecting..." },
  connected: { dot: "bg-green-500", text: "text-green-600", label: "Live" },
};

export default function FilterPanel({
  selectedType,
  onTypeChange,
  shipCount,
  status,
  messageCount,
}: FilterPanelProps) {
  const statusStyle = STATUS_STYLES[status];

  return (
    <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 min-w-[260px] max-w-[300px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
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
        <div className={`flex items-center gap-1.5 text-[10px] font-medium ${statusStyle.text}`}>
          <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
          {statusStyle.label}
        </div>
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

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          <strong className="text-gray-700">{shipCount}</strong> vessels
        </span>
        {status === "connected" && (
          <span className="text-[10px] text-gray-400">
            {messageCount.toLocaleString()} msgs
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
