import { Ship } from "@/types/ship";

/**
 * Tile-based deterministic ship generator.
 *
 * The world is divided into tiles (~0.1° ≈ 11 km). Each tile gets a
 * deterministic set of ships seeded by its tile coordinates. Ship positions
 * are fixed within their tile, so they never move when the viewport changes.
 *
 * Ships are only placed in tiles that are likely to contain water, using a
 * simple coastal/ocean heuristic based on latitude and proximity to known
 * ocean/sea regions.
 *
 * The architecture supports swapping in a real AIS API (MarineTraffic, AISHub,
 * etc.) by replacing this function.
 */

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
const TILE_SIZE = 0.1; // degrees (~11 km at equator)

// Simple seeded PRNG (Park-Miller)
function seededRandom(seed: number): () => number {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Heuristic: does this tile likely contain water?
 * Uses a simple hash to create a mix of water/land tiles. Tiles near
 * certain lat/lon bands (open ocean latitudes, coastal longitudes) are
 * more likely to be "water". This isn't geographically accurate, but
 * produces a plausible-looking distribution with clusters and gaps.
 */
function tileHasWater(tileX: number, tileY: number): boolean {
  const rand = seededRandom(tileX * 73856093 + tileY * 19349669);
  const r = rand();

  // Latitude in degrees
  const lat = tileY * TILE_SIZE;

  // Open ocean bands are mostly water
  if (Math.abs(lat) > 60) return r < 0.3; // polar - less shipping
  if (Math.abs(lat) < 5) return r < 0.7;  // equatorial waters

  // General: roughly 70% of Earth is water, but we want fewer ships
  // inland. Use the hash to create natural-looking clusters.
  return r < 0.45;
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
  // Shorter trails: 3-6 points, small steps
  const steps = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < steps; i++) {
    const step = 0.001 + rand() * 0.002;
    curLat -= Math.cos(headingRad) * step + (rand() - 0.5) * 0.0003;
    curLon -= Math.sin(headingRad) * step + (rand() - 0.5) * 0.0003;
    path.push([curLat, curLon]);
  }
  return path.reverse();
}

/**
 * Generate ships for a single tile. Results are deterministic and cached.
 */
const tileCache = new Map<string, Ship[]>();

function shipsForTile(tileX: number, tileY: number): Ship[] {
  const key = `${tileX},${tileY}`;
  if (tileCache.has(key)) return tileCache.get(key)!;

  if (!tileHasWater(tileX, tileY)) {
    tileCache.set(key, []);
    return [];
  }

  const seed = Math.abs(tileX * 73856093 + tileY * 19349669 + 7);
  const rand = seededRandom(seed);

  // 0-4 ships per tile
  const count = Math.floor(rand() * 5);
  const ships: Ship[] = [];

  const baseLat = tileY * TILE_SIZE;
  const baseLon = tileX * TILE_SIZE;

  for (let i = 0; i < count; i++) {
    const typeKey = VESSEL_TYPE_KEYS[Math.floor(rand() * VESSEL_TYPE_KEYS.length)];
    const names = VESSEL_NAMES[typeKey];
    const name = names[Math.floor(rand() * names.length)];

    // Position within tile — fixed forever
    const lat = baseLat + rand() * TILE_SIZE;
    const lon = baseLon + rand() * TILE_SIZE;
    const heading = Math.floor(rand() * 360);
    const speed = Math.round((rand() * 20 + 1) * 10) / 10;

    // Unique, stable ID based on tile + index
    const mmsi = Math.abs((tileX * 100003 + tileY * 99991 + i * 7919) % 900000000) + 100000000;

    ships.push({
      id: `${mmsi}`,
      name,
      type: typeKey,
      lat,
      lon,
      speed,
      heading,
      path: generatePath(lat, lon, heading, rand),
    });
  }

  tileCache.set(key, ships);
  return ships;
}

export async function fetchShips(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): Promise<Ship[]> {
  // Simulate slight network delay
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

  const { north, south, east, west } = bounds;

  // Determine which tiles overlap with the viewport
  const minTileX = Math.floor(west / TILE_SIZE);
  const maxTileX = Math.floor(east / TILE_SIZE);
  const minTileY = Math.floor(south / TILE_SIZE);
  const maxTileY = Math.floor(north / TILE_SIZE);

  // Cap to avoid generating too many tiles when zoomed way out
  const tileCountX = maxTileX - minTileX + 1;
  const tileCountY = maxTileY - minTileY + 1;
  if (tileCountX * tileCountY > 2000) {
    // At very wide zoom, sample a subset of tiles
    const ships: Ship[] = [];
    const step = Math.ceil(Math.max(tileCountX, tileCountY) / 30);
    for (let tx = minTileX; tx <= maxTileX; tx += step) {
      for (let ty = minTileY; ty <= maxTileY; ty += step) {
        ships.push(...shipsForTile(tx, ty));
      }
    }
    return ships;
  }

  const ships: Ship[] = [];
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      ships.push(...shipsForTile(tx, ty));
    }
  }
  return ships;
}
