"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Ship, ConnectionStatus, aisTypeToCategory } from "@/types/ship";

const SHIP_TTL_MS = 5 * 60 * 1000;
const MAX_PATH_POINTS = 20;

interface UseAISStreamOptions {
  bounds: { north: number; south: number; east: number; west: number } | null;
}

export function useAISStream({ bounds }: UseAISStreamOptions) {
  const [ships, setShips] = useState<Map<string, Ship>>(new Map());
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messageCount, setMessageCount] = useState(0);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const esRef = useRef<EventSource | null>(null);
  const shipsRef = useRef<Map<string, Ship>>(new Map());
  const connectedOnce = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const flushTimer = useRef<ReturnType<typeof setInterval>>();
  const messageCountRef = useRef(0);
  const debugLogRef = useRef<string[]>([]);

  const addLog = useCallback((msg: string) => {
    const entry = `${new Date().toLocaleTimeString()} ${msg}`;
    debugLogRef.current = [...debugLogRef.current.slice(-19), entry];
    setDebugLog([...debugLogRef.current]);
  }, []);

  const connect = useCallback((b: { north: number; south: number; east: number; west: number }) => {
    // Clean up previous
    clearTimeout(reconnectTimer.current);
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const params = new URLSearchParams({
      south: b.south.toFixed(4),
      west: b.west.toFixed(4),
      north: b.north.toFixed(4),
      east: b.east.toFixed(4),
    });
    const url = `/api/ais?${params}`;

    addLog(`Connecting via SSE proxy...`);
    addLog(`Bbox: [${b.south.toFixed(2)},${b.west.toFixed(2)}]-[${b.north.toFixed(2)},${b.east.toFixed(2)}]`);
    setStatus("connecting");

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("log", (e) => {
      const { msg } = JSON.parse(e.data);
      addLog(`[server] ${msg}`);
    });

    es.addEventListener("status", (e) => {
      const { status: s } = JSON.parse(e.data);
      setStatus(s as ConnectionStatus);
      addLog(`Status: ${s}`);
    });

    es.addEventListener("ais", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (messageCountRef.current === 0) {
          addLog(`First AIS message: type=${data.MessageType}`);
        }
        if (data.MessageType?.toLowerCase() !== "positionreport") return;

        const meta = data.MetaData;
        const report = data.Message?.PositionReport;
        if (!meta || !report) return;

        const mmsi = String(meta.MMSI);
        const lat = meta.latitude ?? report.Latitude;
        const lon = meta.longitude ?? report.Longitude;

        if (lat == null || lon == null || (lat === 0 && lon === 0)) return;

        const existing = shipsRef.current.get(mmsi);
        const path: [number, number][] = existing?.path
          ? [...existing.path]
          : [];

        if (
          path.length === 0 ||
          Math.abs(path[path.length - 1][0] - lat) > 0.0001 ||
          Math.abs(path[path.length - 1][1] - lon) > 0.0001
        ) {
          path.push([lat, lon]);
          if (path.length > MAX_PATH_POINTS) path.shift();
        }

        const ship: Ship = {
          id: mmsi,
          name: (meta.ShipName || "Unknown").trim(),
          type: aisTypeToCategory(meta.ShipType ?? 0),
          lat,
          lon,
          speed: report.Sog ?? 0,
          heading: report.TrueHeading ?? report.Cog ?? 0,
          course: report.Cog ?? 0,
          path,
          lastUpdate: Date.now(),
        };

        shipsRef.current.set(mmsi, ship);
        messageCountRef.current++;
      } catch {
        // ignore malformed
      }
    });

    es.onerror = () => {
      addLog("SSE connection error — reconnecting in 3s...");
      setStatus("disconnected");
      es.close();
      esRef.current = null;
      reconnectTimer.current = setTimeout(() => {
        if (b) connect(b);
      }, 3000);
    };
  }, [addLog]);

  // Connect only once when bounds first become available
  useEffect(() => {
    if (!bounds || connectedOnce.current) return;

    connectedOnce.current = true;
    addLog("Map bounds ready — connecting");
    connect(bounds);

    return () => {
      clearTimeout(reconnectTimer.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [bounds, connect, addLog]);

  // Flush ships to state periodically and prune stale
  useEffect(() => {
    let lastLoggedCount = -1;
    flushTimer.current = setInterval(() => {
      const now = Date.now();
      const map = shipsRef.current;
      map.forEach((ship, id) => {
        if (now - ship.lastUpdate > SHIP_TTL_MS) map.delete(id);
      });
      setShips(new Map(map));
      setMessageCount(messageCountRef.current);
      // Log ship count changes for debugging
      if (map.size !== lastLoggedCount) {
        addLog(`Ships tracked: ${map.size} | msgs: ${messageCountRef.current}`);
        lastLoggedCount = map.size;
      }
    }, 1000);

    return () => clearInterval(flushTimer.current);
  }, [addLog]);

  return { ships, status, messageCount, debugLog };
}
