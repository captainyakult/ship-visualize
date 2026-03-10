"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Ship, VesselType } from "@/types/ship";
import { fetchShips } from "@/lib/fetchShips";
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
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const trailSourceAdded = useRef(false);

  const [ships, setShips] = useState<Ship[]>([]);
  const [filteredShips, setFilteredShips] = useState<Ship[]>([]);
  const [selectedType, setSelectedType] = useState<VesselType>("All vessels");
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
  const [loading, setLoading] = useState(false);

  // Filter ships when type or data changes
  useEffect(() => {
    if (selectedType === "All vessels") {
      setFilteredShips(ships);
    } else {
      setFilteredShips(ships.filter((s) => s.type === selectedType));
    }
  }, [ships, selectedType]);

  const loadShips = useCallback(async (m: maplibregl.Map) => {
    const bounds = m.getBounds();
    setLoading(true);
    try {
      const data = await fetchShips({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
      setShips(data);
    } catch {
      console.error("Failed to fetch ships");
    } finally {
      setLoading(false);
    }
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
      // Add trail source
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

      loadShips(m);
    });

    let debounceTimer: ReturnType<typeof setTimeout>;
    m.on("moveend", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadShips(m), 500);
    });

    map.current = m;

    return () => {
      m.remove();
      map.current = null;
    };
  }, [latitude, longitude, loadShips]);

  // Update markers and trails when filtered ships change
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    filteredShips.forEach((ship) => {
      const color = TYPE_COLORS[ship.type] || TYPE_COLORS.Other;
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

      markersRef.current.push(marker);
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
            coordinates: [
              ...ship.path.map(([lat, lon]) => [lon, lat]),
              [ship.lon, ship.lat],
            ],
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
  }, [filteredShips]);

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
        loading={loading}
      />

      {selectedShip && (
        <ShipPopup
          ship={selectedShip}
          onClose={() => setSelectedShip(null)}
        />
      )}
    </div>
  );
}
