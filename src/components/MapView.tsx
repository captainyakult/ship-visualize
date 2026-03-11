"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Ship, VesselType } from "@/types/ship";
import { useAISStream } from "@/hooks/useAISStream";
import FilterPanel from "./FilterPanel";
import ShipPopup from "./ShipPopup";

const TYPE_COLORS: Record<string, string> = {
  Cargo: "#3b82f6",
  Tanker: "#ef4444",
  Passenger: "#22c55e",
  Fishing: "#eab308",
  Military: "#a855f7",
  Other: "#9ca3af",
};

const API_KEY_STORAGE = "aisstream-api-key";
const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_AISSTREAM_API_KEY || "a06e87868eda965ac17184bab2c8e250f2e0856d";

function createShipSVG(heading: number, color: string): string {
  return `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(${heading}, 12, 12)">
      <polygon points="12,2 6,20 12,16 18,20" fill="${color}" stroke="white" stroke-width="1.5"/>
    </g>
  </svg>`;
}

interface MapViewProps {
  latitude: number;
  longitude: number;
}

export default function MapView({ latitude, longitude }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const trailSourceAdded = useRef(false);

  const [apiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY;
    }
    return DEFAULT_API_KEY;
  });
  const [bounds, setBounds] = useState<{
    north: number; south: number; east: number; west: number;
  } | null>(null);
  const [selectedType, setSelectedType] = useState<VesselType>("All vessels");
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);


  // AISStream WebSocket
  const { ships: shipMap, status, messageCount, debugLog } = useAISStream({
    apiKey,
    bounds,
  });

  // Convert map to filtered array
  const allShips = useMemo(() => Array.from(shipMap.values()), [shipMap]);
  const filteredShips = useMemo(() => {
    if (selectedType === "All vessels") return allShips;
    return allShips.filter((s) => s.type === selectedType);
  }, [allShips, selectedType]);

  // Update bounds from map viewport
  const updateBounds = useCallback((m: maplibregl.Map) => {
    const b = m.getBounds();
    setBounds({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [longitude, latitude],
      zoom: 12,
    });

    m.addControl(new maplibregl.NavigationControl(), "top-right");
    m.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right"
    );

    m.on("load", () => {
      m.addSource("ship-trails", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "ship-trails-layer",
        type: "line",
        source: "ship-trails",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2,
          "line-opacity": 0.5,
          "line-dasharray": [2, 2],
        },
      });
      trailSourceAdded.current = true;
      updateBounds(m);
    });

    let debounceTimer: ReturnType<typeof setTimeout>;
    m.on("moveend", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => updateBounds(m), 300);
    });

    map.current = m;

    return () => {
      m.remove();
      map.current = null;
    };
  }, [latitude, longitude, updateBounds]);

  // Update markers and trails when ships change
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const currentIds = new Set(filteredShips.map((s) => s.id));

    // Remove markers for ships no longer present
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    filteredShips.forEach((ship) => {
      const color = TYPE_COLORS[ship.type] || TYPE_COLORS.Other;
      const existing = markersRef.current.get(ship.id);

      if (existing) {
        // Update position
        existing.setLngLat([ship.lon, ship.lat]);
        // Update rotation via SVG
        const el = existing.getElement();
        el.innerHTML = createShipSVG(ship.heading, color);
      } else {
        // Create new marker
        const el = document.createElement("div");
        el.innerHTML = createShipSVG(ship.heading, color);
        el.style.cursor = "pointer";
        el.style.width = "24px";
        el.style.height = "24px";

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedShip(ship);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([ship.lon, ship.lat])
          .addTo(m);

        markersRef.current.set(ship.id, marker);
      }
    });

    // Update trails
    if (trailSourceAdded.current) {
      const trailFeatures = filteredShips
        .filter((s) => s.path.length > 1)
        .map((ship) => ({
          type: "Feature" as const,
          properties: { color: TYPE_COLORS[ship.type] || TYPE_COLORS.Other },
          geometry: {
            type: "LineString" as const,
            coordinates: ship.path.map(([lat, lon]) => [lon, lat]),
          },
        }));

      const source = m.getSource("ship-trails") as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features: trailFeatures,
        });
      }
    }

    // Update selected ship data if it's still in the set
    if (selectedShip) {
      const updated = shipMap.get(selectedShip.id);
      if (updated && updated.lastUpdate !== selectedShip.lastUpdate) {
        setSelectedShip(updated);
      }
    }
  }, [filteredShips, shipMap, selectedShip]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      <FilterPanel
        selectedType={selectedType}
        onTypeChange={(type) => {
          setSelectedType(type);
          setSelectedShip(null);
        }}
        shipCount={filteredShips.length}
        status={status}
        messageCount={messageCount}
        apiKey={apiKey}
      />

      {selectedShip && (
        <ShipPopup
          ship={selectedShip}
          onClose={() => setSelectedShip(null)}
        />
      )}

      {/* Debug log panel */}
      <div className="absolute bottom-4 left-4 right-4 z-10 bg-black/80 text-green-400 rounded-lg p-3 max-h-[200px] overflow-y-auto font-mono text-[11px] leading-relaxed">
        <div className="flex items-center justify-between mb-1">
          <span className="text-green-300 font-bold text-xs">Connection Debug</span>
          <span className="text-gray-400 text-[10px]">
            key={apiKey ? `${apiKey.slice(0, 6)}...` : "none"} | bounds={bounds ? "yes" : "no"} | ws={status}
          </span>
        </div>
        {debugLog.length === 0 ? (
          <div className="text-gray-500">Waiting for events...</div>
        ) : (
          debugLog.map((line, i) => (
            <div key={i} className="text-[10px]">{line}</div>
          ))
        )}
      </div>
    </div>
  );
}
