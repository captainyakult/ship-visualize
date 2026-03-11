"use client";

import { Ship } from "@/types/ship";

interface ShipPopupProps {
  ship: Ship;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  Cargo: "bg-blue-100 text-blue-700",
  Tanker: "bg-red-100 text-red-700",
  Passenger: "bg-green-100 text-green-700",
  Fishing: "bg-yellow-100 text-yellow-700",
  Military: "bg-purple-100 text-purple-700",
  Other: "bg-gray-100 text-gray-700",
};

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

export default function ShipPopup({ ship, onClose }: ShipPopupProps) {
  return (
    <div className="absolute top-auto bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white rounded-xl shadow-xl p-4 min-w-[280px] max-w-[340px] max-h-[50vh] overflow-y-auto">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">{ship.name}</h3>
          <span
            className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${TYPE_COLORS[ship.type] || TYPE_COLORS.Other}`}
          >
            {ship.type}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-400 text-[10px]">MMSI</div>
          <div className="text-gray-700 font-mono">{ship.id}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-400 text-[10px]">Speed</div>
          <div className="text-gray-700">{ship.speed.toFixed(1)} kn</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-400 text-[10px]">Heading</div>
          <div className="text-gray-700">{ship.heading}°</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-400 text-[10px]">Course</div>
          <div className="text-gray-700">{ship.course.toFixed(1)}°</div>
        </div>
        <div className="col-span-2 bg-gray-50 rounded-lg p-2">
          <div className="text-gray-400 text-[10px]">Position</div>
          <div className="text-gray-700 font-mono text-[11px]">
            {ship.lat.toFixed(5)}, {ship.lon.toFixed(5)}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
        <span>Track: {ship.path.length} points</span>
        <span>{timeAgo(ship.lastUpdate)}</span>
      </div>
    </div>
  );
}
