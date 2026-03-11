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
  const lastAISMessageTime = useRef<number>(0);
  const aisMessageBatchCount = useRef<number>(0);

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
        const now = Date.now();
        aisMessageBatchCount.current++;

        // Log first message
        if (messageCountRef.current === 0 && aisMessageBatchCount.current === 1) {
          addLog(`First AIS message: type=${data.MessageType}`);
        }

        // Log every 50th message
        if (aisMessageBatchCount.current % 50 === 0) {
          addLog(`AIS msgs received: ${aisMessageBatchCount.current} total`);
        }

        // Log time gap if >10s since last message
        if (lastAISMessageTime.current > 0) {
          const gap = now - lastAISMessageTime.current;
          if (gap > 10000) {
            addLog(`AIS data gap: ${(gap / 1000).toFixed(1)}s since last message`);
          }
        }
        lastAISMessageTime.current = now;

        if (data.MessageType?.toLowerCase() !== "positionreport") return;

        const meta = data.MetaData;
        const report = data.Message?.PositionReport;
        if (!meta || !report) return;

        const mmsi = String(meta.MMSI);
        // Prefer PositionReport fields (actual AIS transmission) over MetaData (may lag)
        const lat = report.Latitude ?? meta.latitude;
        const lon = report.Longitude ?? meta.longitude;

        // Log first 5 position reports with raw coords for debugging
        if (messageCountRef.current < 5) {
          addLog(`Ship ${mmsi}: lat=${lat} lon=${lon} (report: ${report.Latitude},${report.Longitude} meta: ${meta.latitude},${meta.longitude})`);
        }

        // Filter invalid AIS values: 91=lat unavailable, 181=lon unavailable
        if (lat == null || lon == null) return;
        if (lat === 0 && lon === 0) return;
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;

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
          // AIS heading 511 = not available; fall back to COG
          heading: (report.TrueHeading != null && report.TrueHeading !== 511)
            ? report.TrueHeading
            : (report.Cog ?? 0),
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
    let silenceWarned = false;
    flushTimer.current = setInterval(() => {
      const now = Date.now();
      const map = shipsRef.current;
      map.forEach((ship, id) => {
        if (now - ship.lastUpdate > SHIP_TTL_MS) map.delete(id);
      });
      setShips(new Map(map));
      setMessageCount(messageCountRef.current);

      // Detect silence: warn if no AIS data for 15s while supposedly connected
      if (lastAISMessageTime.current > 0) {
        const silence = now - lastAISMessageTime.current;
        if (silence > 15000 && !silenceWarned) {
          addLog(`WARNING: No AIS data for ${(silence / 1000).toFixed(0)}s — stream may be stalled`);
          silenceWarned = true;
        } else if (silence <= 15000) {
          silenceWarned = false;
        }
      }

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
