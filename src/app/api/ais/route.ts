import { NextRequest } from "next/server";
import WebSocket from "ws";

const WS_URL = "wss://stream.aisstream.io/v0/stream";
const API_KEY = process.env.NEXT_PUBLIC_AISSTREAM_API_KEY || "a06e87868eda965ac17184bab2c8e250f2e0856d";
const WS_CONNECT_TIMEOUT_MS = 3000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simulated ship data for when AISStream is unreachable
const SHIP_NAMES = [
  "EVER GIVEN", "MSC OSCAR", "MAERSK MCKINNEY", "CMA CGM MARCO POLO",
  "COSCO SHIPPING UNIVERSE", "ONE STORK", "PACIFIC JEWEL", "BLUE STAR",
  "OCEAN VOYAGER", "NORDIC SPIRIT", "ATLANTIC GUARDIAN", "SEA PIONEER",
  "GOLDEN HORIZON", "SILVER WAVE", "JADE PRINCESS", "CORAL QUEEN",
  "ARCTIC EXPLORER", "SUNSET GLORY", "STAR NAVIGATOR", "EMERALD TIDE",
];
const SHIP_TYPES = [70, 71, 72, 80, 81, 60, 30, 35, 52, 74];

function generateSimulatedShips(
  south: number, west: number, north: number, east: number, count: number
) {
  // Place ships in the middle 60% of the bounding box to keep them away from edges,
  // and bias towards center where water is more likely when user is near coast
  const latRange = north - south;
  const lonRange = east - west;
  const latPad = latRange * 0.2;
  const lonPad = lonRange * 0.2;

  const ships = [];
  for (let i = 0; i < count; i++) {
    // Current position — biased towards center of view
    const lat = (south + latPad) + Math.random() * (latRange - 2 * latPad);
    const lon = (west + lonPad) + Math.random() * (lonRange - 2 * lonPad);
    const heading = Math.random() * 360;
    const speed = 3 + Math.random() * 15; // 3-18 knots
    const shipType = SHIP_TYPES[i % SHIP_TYPES.length];

    // Pre-compute a few historical positions by walking backwards from current
    // so paths are visible immediately
    const stepSize = (speed / 3600) * 2 * 0.008;
    const headingRad = (heading * Math.PI) / 180;
    const prevLat = lat - Math.cos(headingRad) * stepSize * 5;
    const prevLon = lon - Math.sin(headingRad) * stepSize * 5;

    ships.push({
      mmsi: 200000000 + i,
      name: SHIP_NAMES[i % SHIP_NAMES.length],
      shipType,
      lat,
      lon,
      prevLat,
      prevLon,
      heading,
      speed,
      course: heading + (Math.random() - 0.5) * 10,
    });
  }
  return ships;
}

function makeAISMessage(ship: { mmsi: number; name: string; shipType: number; lat: number; lon: number; heading: number; speed: number; course: number; prevLat?: number; prevLon?: number }, usePrev = false) {
  const lat = usePrev && ship.prevLat != null ? ship.prevLat : ship.lat;
  const lon = usePrev && ship.prevLon != null ? ship.prevLon : ship.lon;
  return {
    MessageType: "PositionReport",
    MetaData: {
      MMSI: ship.mmsi,
      ShipName: ship.name,
      ShipType: ship.shipType,
      latitude: lat,
      longitude: lon,
    },
    Message: {
      PositionReport: {
        Latitude: lat,
        Longitude: lon,
        Sog: ship.speed,
        TrueHeading: ship.heading,
        Cog: ship.course,
      },
    },
  };
}

export async function GET(req: NextRequest) {
  const south = req.nextUrl.searchParams.get("south");
  const west = req.nextUrl.searchParams.get("west");
  const north = req.nextUrl.searchParams.get("north");
  const east = req.nextUrl.searchParams.get("east");

  if (!south || !west || !north || !east) {
    return new Response("Missing bounding box params", { status: 400 });
  }

  const sN = Number(south), wN = Number(west), nN = Number(north), eN = Number(east);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let aborted = false;
      let simulationStarted = false;

      req.signal.addEventListener("abort", () => { aborted = true; });

      const send = (event: string, data: unknown) => {
        if (aborted) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch { /* stream closed */ }
      };

      function startSimulation() {
        if (aborted || simulationStarted) return;
        simulationStarted = true;

        const shipCount = 15 + Math.floor(Math.random() * 10);
        const ships = generateSimulatedShips(sN, wN, nN, eN, shipCount);

        send("log", { msg: `Simulating ${ships.length} vessels in view` });
        send("status", { status: "connected" });

        // Send historical positions first so paths are visible immediately
        for (const ship of ships) {
          send("ais", makeAISMessage(ship, true));
        }
        // Then send current positions (creates 2-point path right away)
        for (const ship of ships) {
          send("ais", makeAISMessage(ship));
        }

        // Update ALL ships every 1.5s for smooth movement and path accumulation
        const interval = setInterval(() => {
          if (aborted) { clearInterval(interval); return; }

          for (const ship of ships) {
            const headingRad = (ship.heading * Math.PI) / 180;
            const speedFactor = (ship.speed / 3600) * 2 * 0.008;
            ship.lat += Math.cos(headingRad) * speedFactor;
            ship.lon += Math.sin(headingRad) * speedFactor;
            ship.heading += (Math.random() - 0.5) * 2;
            ship.course = ship.heading + (Math.random() - 0.5) * 5;
            send("ais", makeAISMessage(ship));
          }
        }, 1500);

        req.signal.addEventListener("abort", () => clearInterval(interval));
      }

      // Try real AISStream first, fall back to simulation on timeout/error
      send("log", { msg: "Connecting to AISStream..." });

      const ws = new WebSocket(WS_URL);
      let connected = false;

      const connectTimeout = setTimeout(() => {
        if (!connected && !aborted) {
          send("log", { msg: "AISStream unreachable — switching to simulated data" });
          // Remove error handler before closing to avoid double-triggering simulation
          ws.removeAllListeners("error");
          ws.on("error", () => {}); // suppress close-triggered error
          ws.close();
          startSimulation();
        }
      }, WS_CONNECT_TIMEOUT_MS);

      ws.on("open", () => {
        connected = true;
        clearTimeout(connectTimeout);
        send("log", { msg: "WebSocket opened, subscribing..." });
        const sub = {
          APIKey: API_KEY,
          BoundingBoxes: [[[sN, wN], [nN, eN]]],
          FilterMessageTypes: ["PositionReport"],
        };
        ws.send(JSON.stringify(sub));
        send("status", { status: "connected" });
      });

      ws.on("message", (raw) => {
        try {
          send("ais", JSON.parse(raw.toString()));
        } catch { /* skip */ }
      });

      ws.on("error", (err) => {
        send("log", { msg: `WebSocket error: ${err.message}` });
        if (!connected) {
          clearTimeout(connectTimeout);
          send("log", { msg: "Falling back to simulated data" });
          startSimulation();
        }
      });

      ws.on("close", (code, reason) => {
        if (connected) {
          send("log", { msg: `WebSocket closed: code=${code} reason=${reason || "none"}` });
          send("status", { status: "disconnected" });
          try { controller.close(); } catch { /* already closed */ }
        }
      });

      req.signal.addEventListener("abort", () => {
        clearTimeout(connectTimeout);
        ws.removeAllListeners();
        ws.on("error", () => {}); // suppress errors during cleanup
        ws.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
