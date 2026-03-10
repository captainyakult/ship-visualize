'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useAIS } from '@/hooks/useAIS';
import { useDemoShips } from '@/hooks/useDemoShips';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { StatusBar } from '@/components/StatusBar';
import { BoundingBox, Ship } from '@/types/ship';

// Default fallback location (London)
const FALLBACK_LAT = 51.505;
const FALLBACK_LON = -0.09;

// Dynamically import map to avoid SSR issues with maplibre-gl
const MapContent = dynamic(() => import('@/components/MapContent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-gray-950">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Loading map…</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const { lat, lon, error: geoError, loading: geoLoading } = useGeolocation();

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [boundingBox, setBoundingBox] = useState<BoundingBox | null>(null);
  const [appReady, setAppReady] = useState(false);

  // Load stored API key on mount
  useEffect(() => {
    const envKey = process.env.NEXT_PUBLIC_AIS_API_KEY;
    const stored = localStorage.getItem('ais-api-key');
    if (envKey) {
      setApiKey(envKey);
      setAppReady(true);
    } else if (stored) {
      setApiKey(stored);
      setAppReady(true);
    } else {
      setShowModal(true);
      setAppReady(true);
    }
  }, []);

  const { ships: realShips, connected, error: wsError } = useAIS(
    demoMode ? null : apiKey,
    demoMode ? null : boundingBox
  );

  const centerLat = lat ?? FALLBACK_LAT;
  const centerLon = lon ?? FALLBACK_LON;

  const demoShips = useDemoShips(demoMode, centerLat, centerLon);

  const ships: Map<string, Ship> = demoMode ? demoShips : realShips;

  const handleSaveApiKey = useCallback((key: string) => {
    localStorage.setItem('ais-api-key', key);
    setApiKey(key);
    setDemoMode(false);
    setShowModal(false);
  }, []);

  const handleDemoMode = useCallback(() => {
    setDemoMode(true);
    setApiKey(null);
    setShowModal(false);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowModal(true);
  }, []);

  const handleBoundsChange = useCallback((bounds: BoundingBox) => {
    setBoundingBox(bounds);
  }, []);

  // Show loading screen while geolocation resolves
  if (!appReady || geoLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-950">
        <div className="text-center">
          <div className="text-4xl mb-4">🚢</div>
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {geoLoading ? 'Requesting location…' : 'Initializing…'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Full-screen map */}
      <MapContent
        initialLat={centerLat}
        initialLon={centerLon}
        ships={ships}
        onBoundsChange={handleBoundsChange}
      />

      {/* Top overlay: title + status bar */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        {/* App title */}
        <div className="flex items-center gap-2 bg-gray-900/85 backdrop-blur-md rounded-xl px-3 py-2
          border border-gray-700/40 shadow-lg pointer-events-none">
          <span className="text-lg">🚢</span>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Ship Visualizer</div>
            <div className="text-gray-400 text-xs leading-tight">
              {geoError ? 'Default location (London)' : 'Near your location'}
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="pointer-events-auto">
          <StatusBar
            connected={connected}
            demoMode={demoMode}
            shipCount={ships.size}
            onOpenSettings={handleOpenSettings}
          />
        </div>
      </div>

      {/* WebSocket error banner */}
      {wsError && !demoMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-red-950/90 border border-red-700/60 text-red-300 text-xs px-4 py-2
            rounded-full shadow-lg backdrop-blur-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            {wsError}
          </div>
        </div>
      )}

      {/* Geolocation error notice */}
      {geoError && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-yellow-950/90 border border-yellow-700/60 text-yellow-300 text-xs px-4 py-2
            rounded-full shadow-lg backdrop-blur-sm text-center max-w-xs">
            📍 Location unavailable — showing London. Enable location for local ships.
          </div>
        </div>
      )}

      {/* API Key / Demo modal */}
      {showModal && (
        <ApiKeyModal
          onSave={handleSaveApiKey}
          onDemo={handleDemoMode}
          initialKey={apiKey ?? ''}
        />
      )}
    </div>
  );
}
