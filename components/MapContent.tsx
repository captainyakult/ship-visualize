'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import Map, {
  Marker,
  Popup,
  Source,
  Layer,
  NavigationControl,
  GeolocateControl,
} from 'react-map-gl/maplibre';
import type { MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre';
import type { GeoJSON } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';

import { Ship, VesselFilter, BoundingBox } from '@/types/ship';
import { ShipMarker } from './ShipMarker';
import { ShipPopup } from './ShipPopup';
import { FilterPanel } from './FilterPanel';
import { VESSEL_TYPE_COLORS } from '@/utils/vesselTypes';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface MapContentProps {
  initialLat: number;
  initialLon: number;
  ships: Map<string, Ship>;
  onBoundsChange: (bounds: BoundingBox) => void;
}

export default function MapContent({ initialLat, initialLon, ships, onBoundsChange }: MapContentProps) {
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
  const [activeFilter, setActiveFilter] = useState<VesselFilter>('all');
  const mapRef = useRef<MapRef>(null);

  const reportBounds = useCallback((map: maplibregl.Map) => {
    const bounds = map.getBounds();
    onBoundsChange({
      minLat: bounds.getSouth(),
      minLon: bounds.getWest(),
      maxLat: bounds.getNorth(),
      maxLon: bounds.getEast(),
    });
  }, [onBoundsChange]);

  const handleMove = useCallback((e: ViewStateChangeEvent) => {
    reportBounds(e.target as unknown as maplibregl.Map);
  }, [reportBounds]);

  const handleLoad = useCallback((e: { target: unknown }) => {
    reportBounds(e.target as unknown as maplibregl.Map);
  }, [reportBounds]);

  const shipsArray = useMemo(() => Array.from(ships.values()), [ships]);

  const filteredShips = useMemo(() => {
    if (activeFilter === 'all') return shipsArray;
    return shipsArray.filter((ship) => {
      if (activeFilter === 'tug') return ship.type === 'tug' || ship.type === 'towing';
      return ship.type === activeFilter;
    });
  }, [shipsArray, activeFilter]);

  // Count by type for filter badges
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    shipsArray.forEach((ship) => {
      const key = ship.type === 'towing' ? 'tug' : ship.type;
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [shipsArray]);

  // GeoJSON for ship trails
  const trailsData = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: filteredShips
      .filter((ship) => ship.path.length >= 2)
      .map((ship) => ({
        type: 'Feature',
        properties: {
          id: ship.id,
          color: VESSEL_TYPE_COLORS[ship.type] ?? VESSEL_TYPE_COLORS.other,
        },
        geometry: {
          type: 'LineString',
          // GeoJSON uses [lon, lat]
          coordinates: ship.path.map(([lat, lon]) => [lon, lat]),
        },
      })),
  }), [filteredShips]);

  // Sync selected ship with latest data
  const currentSelectedShip = selectedShip
    ? (ships.get(selectedShip.id) ?? selectedShip)
    : null;

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: initialLon,
          latitude: initialLat,
          zoom: 10,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        onMoveEnd={handleMove}
        onLoad={handleLoad}
        onClick={() => setSelectedShip(null)}
        attributionControl={false}
      >
        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />

        {/* Ship trails */}
        <Source id="trails" type="geojson" data={trailsData}>
          <Layer
            id="trails-layer"
            type="line"
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 1.5,
              'line-opacity': 0.55,
              'line-dasharray': [3, 3],
            }}
          />
        </Source>

        {/* Ship markers */}
        {filteredShips.map((ship) => (
          <Marker
            key={ship.id}
            longitude={ship.lon}
            latitude={ship.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedShip(ship);
            }}
          >
            <ShipMarker
              ship={ship}
              isSelected={currentSelectedShip?.id === ship.id}
            />
          </Marker>
        ))}

        {/* Ship detail popup */}
        {currentSelectedShip && (
          <Popup
            longitude={currentSelectedShip.lon}
            latitude={currentSelectedShip.lat}
            anchor="bottom"
            onClose={() => setSelectedShip(null)}
            closeButton={false}
            closeOnClick={false}
            offset={[0, -16] as [number, number]}
            maxWidth="none"
          >
            <ShipPopup
              ship={currentSelectedShip}
              onClose={() => setSelectedShip(null)}
            />
          </Popup>
        )}
      </Map>

      {/* Filter bar overlay */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto
        bg-gray-900/85 backdrop-blur-md rounded-2xl px-3 py-2 shadow-2xl
        border border-gray-700/40 max-w-[calc(100vw-2rem)]">
        <FilterPanel
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={typeCounts}
          totalCount={ships.size}
        />
      </div>
    </div>
  );
}
