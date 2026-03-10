import { useState, useEffect, useRef } from 'react';
import { Ship } from '@/types/ship';

const VESSEL_TYPES = ['cargo', 'tanker', 'passenger', 'fishing', 'sailing', 'tug', 'other'];
const VESSEL_TYPE_CODES = [70, 80, 60, 30, 36, 52, 0];
const SHIP_NAMES = [
  'ATLANTIC STAR', 'PACIFIC EXPLORER', 'NORDIC CARRIER', 'OCEAN PIONEER',
  'SEA TRADER', 'COASTAL QUEEN', 'BLUE HORIZON', 'HARBOR LIGHT',
  'MARITIME EXPRESS', 'PORT RUNNER', 'NORTHERN SPIRIT', 'SOUTHERN CROSS',
  'EMERALD ISLE', 'GOLDEN GATE', 'SILVER LINING', 'CRIMSON TIDE',
  'ARCTIC WOLF', 'DESERT WIND', 'THUNDER BAY', 'SUNRISE GLORY',
];
const DESTINATIONS = ['ROTTERDAM', 'HAMBURG', 'SHANGHAI', 'SINGAPORE', 'DUBAI', 'NEW YORK', 'ANTWERP', 'LOS ANGELES'];

function generateDemoShip(id: number, centerLat: number, centerLon: number): Ship {
  const angle = Math.random() * 2 * Math.PI;
  const dist = Math.random() * 0.25 + 0.03;
  const lat = centerLat + Math.cos(angle) * dist;
  const lon = centerLon + Math.sin(angle) * dist;
  const typeIndex = Math.floor(Math.random() * VESSEL_TYPES.length);
  const heading = Math.random() * 360;
  const speeds: Record<string, number> = {
    cargo: 12 + Math.random() * 6,
    tanker: 10 + Math.random() * 5,
    passenger: 15 + Math.random() * 8,
    fishing: 4 + Math.random() * 6,
    sailing: 5 + Math.random() * 8,
    tug: 6 + Math.random() * 4,
    other: 8 + Math.random() * 5,
  };
  const type = VESSEL_TYPES[typeIndex];

  return {
    id: `demo-${id}`,
    name: SHIP_NAMES[id % SHIP_NAMES.length],
    type,
    typeCode: VESSEL_TYPE_CODES[typeIndex],
    lat,
    lon,
    speed: speeds[type] ?? 10,
    heading,
    path: [[lat, lon]],
    timestamp: Date.now(),
    destination: DESTINATIONS[id % DESTINATIONS.length],
    callsign: `DEMO${String(id).padStart(3, '0')}`,
  };
}

export function useDemoShips(enabled: boolean, centerLat: number | null, centerLon: number | null) {
  const [ships, setShips] = useState<Map<string, Ship>>(new Map());
  const shipsRef = useRef<Map<string, Ship>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!enabled || !centerLat || !centerLon) {
      clearInterval(intervalRef.current);
      setShips(new Map());
      shipsRef.current = new Map();
      return;
    }

    const initialShips = new Map<string, Ship>();
    for (let i = 0; i < 20; i++) {
      const ship = generateDemoShip(i, centerLat, centerLon);
      initialShips.set(ship.id, ship);
    }
    shipsRef.current = initialShips;
    setShips(new Map(initialShips));

    intervalRef.current = setInterval(() => {
      const updated = new Map<string, Ship>();
      shipsRef.current.forEach((ship, id) => {
        // Convert heading to radians (0° = north, clockwise)
        const headingRad = ((ship.heading - 90) * Math.PI) / 180;
        const knotsToDegreesPerSec = ship.speed * 0.000005;
        const newLat = ship.lat + Math.sin(headingRad + Math.PI / 2) * knotsToDegreesPerSec;
        const newLon = ship.lon + Math.cos(headingRad + Math.PI / 2) * knotsToDegreesPerSec;
        const headingDrift = (Math.random() - 0.5) * 3;

        const updatedShip: Ship = {
          ...ship,
          lat: newLat,
          lon: newLon,
          heading: (ship.heading + headingDrift + 360) % 360,
          path: [...ship.path.slice(-19), [newLat, newLon] as [number, number]],
          timestamp: Date.now(),
        };
        updated.set(id, updatedShip);
      });
      shipsRef.current = updated;
      setShips(new Map(updated));
    }, 2000);

    return () => clearInterval(intervalRef.current);
  }, [enabled, centerLat, centerLon]);

  return ships;
}
