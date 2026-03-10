import { Ship } from "@/types/ship";

// Generate realistic mock ship data based on bounding box
// Public maritime APIs (like AIS) typically require API keys or have strict rate limits.
// For this prototype, we generate realistic mock data. The architecture supports
// swapping in a real API (e.g., MarineTraffic, AISHub) by changing this function.

const VESSEL_NAMES: Record<string, string[]> = {
  Cargo: [
    "MSC Oscar", "Ever Given", "OOCL Hong Kong", "CMA CGM Marco Polo",
    "Maersk Eindhoven", "Cosco Shipping Universe", "HMM Algeciras",
    "Yang Ming Wellness", "Pacific Explorer", "Atlantic Pioneer",
    "Nordic Carrier", "Global Trader", "Sea Fortune", "Ocean Grace",
  ],
  Tanker: [
    "Seawise Giant", "TI Europe", "Knock Nevis", "Hellespont Alhambra",
    "Overseas Tankers", "Eagle Petroleum", "Nordic Voyager", "Gulf Stream",
    "Petro Navigator", "Crude Runner",
  ],
  Passenger: [
    "Symphony of the Seas", "Wonder of the Seas", "MSC Grandiosa",
    "Costa Smeralda", "AIDAnova", "Celebrity Edge", "Queen Mary 2",
    "Norwegian Prima",
  ],
  Fishing: [
    "Atlantic Dawn", "Northern Eagle", "Pacific Harvest", "Sea Crest",
    "Ocean Bounty", "Blue Fin", "Silver Wave", "Coral Fisher",
    "Deep Current", "Storm Chaser",
  ],
  Military: [
    "USS Enterprise", "HMS Queen Elizabeth", "INS Vikrant",
    "Charles de Gaulle", "JS Izumo", "HMAS Canberra",
  ],
  Other: [
    "Sea Tug Alpha", "Harbor Pilot 3", "Research Vessel Atlantis",
    "Cable Layer Neptune", "Dredger King", "Survey Ship Discovery",
  ],
};

const VESSEL_TYPE_KEYS = Object.keys(VESSEL_NAMES);

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generatePath(
  lat: number,
  lon: number,
  heading: number,
  rand: () => number
): [number, number][] {
  const path: [number, number][] = [];
  let curLat = lat;
  let curLon = lon;
  const headingRad = ((heading + 180) * Math.PI) / 180;
  const steps = 5 + Math.floor(rand() * 10);
  for (let i = 0; i < steps; i++) {
    const step = 0.002 + rand() * 0.005;
    curLat -= Math.cos(headingRad) * step + (rand() - 0.5) * 0.001;
    curLon -= Math.sin(headingRad) * step + (rand() - 0.5) * 0.001;
    path.push([curLat, curLon]);
  }
  return path.reverse();
}

export async function fetchShips(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): Promise<Ship[]> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

  const { north, south, east, west } = bounds;
  const latRange = north - south;
  const lonRange = east - west;

  // Generate a deterministic but varied set of ships based on the viewport center
  const centerLat = Math.round(((north + south) / 2) * 100);
  const centerLon = Math.round(((east + west) / 2) * 100);
  const seed = Math.abs(centerLat * 1000 + centerLon);
  const rand = seededRandom(seed);

  const shipCount = 15 + Math.floor(rand() * 25);
  const ships: Ship[] = [];

  for (let i = 0; i < shipCount; i++) {
    const typeKey = VESSEL_TYPE_KEYS[Math.floor(rand() * VESSEL_TYPE_KEYS.length)];
    const names = VESSEL_NAMES[typeKey];
    const name = names[Math.floor(rand() * names.length)];
    const lat = south + rand() * latRange;
    const lon = west + rand() * lonRange;
    const heading = Math.floor(rand() * 360);
    const speed = Math.round((rand() * 20 + 1) * 10) / 10;

    ships.push({
      id: `MMSI-${seed}-${i}`,
      name: `${name}${i > names.length ? ` ${i}` : ""}`,
      type: typeKey,
      lat,
      lon,
      speed,
      heading,
      path: generatePath(lat, lon, heading, rand),
    });
  }

  return ships;
}
