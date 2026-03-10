"use client";

import { useGeolocation } from "@/hooks/useGeolocation";
import MapView from "@/components/MapView";

export default function Home() {
  const { latitude, longitude, error, loading } = useGeolocation();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 text-sm">Requesting your location...</p>
          <p className="text-gray-400 text-xs">
            Please allow location access when prompted
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen w-screen relative">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-4 py-2 rounded-lg shadow-sm">
          {error}
        </div>
      )}
      <MapView latitude={latitude!} longitude={longitude!} />
    </main>
  );
}
