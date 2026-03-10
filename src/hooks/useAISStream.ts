"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Ship, ConnectionStatus, aisTypeToCategory } from "@/types/ship";

const WS_URL = "wss://stream.aisstream.io/v0/stream";
const SHIP_TTL_MS = 5 * 60 * 1000; // remove ships not seen in 5 min
const MAX_PATH_POINTS = 20;

interface UseAISStreamOptions {
  apiKey: string;
  bounds: { north: number; south: number; east: number; west: number } | null;
}

export function useAISStream({ apiKey, bounds }: UseAISStreamOptions) {
  const [ships, setShips] = useState<Map<string, Ship>>(new Map());
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messageCount, setMessageCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const shipsRef = useRef<Map<string, Ship>>(new Map());
  const boundsRef = useRef(bounds);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const flushTimer = useRef<ReturnType<typeof setInterval>>();
  const messageCountRef = useRef(0);

  boundsRef.current = bounds;

  const sendSubscription = useCallback((ws: WebSocket) => {
    const b = boundsRef.current;
    if (!b || ws.readyState !== WebSocket.OPEN) return;

    const msg = {
      Apikey: apiKey,
      BoundingBoxes: [
        [[b.south, b.west], [b.north, b.east]],
      ],
      FilterMessageTypes: ["PositionReport"],
    };
    ws.send(JSON.stringify(msg));
  }, [apiKey]);

  const connect = useCallback(() => {
    if (!apiKey || !bounds) return;

    // Clean up previous connection
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      sendSubscription(ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.MessageType !== "PositionReport") return;

        const meta = data.MetaData;
        const report = data.Message?.PositionReport;
        if (!meta || !report) return;

        const mmsi = String(meta.MMSI);
        const lat = meta.latitude ?? report.Latitude;
        const lon = meta.longitude ?? report.Longitude;

        if (lat == null || lon == null || (lat === 0 && lon === 0)) return;

        const existing = shipsRef.current.get(mmsi);
        const path: [number, number][] = existing?.path ?? [];

        // Add current position to path if it moved
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
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      setStatus("disconnected");
    };

    ws.onclose = () => {
      setStatus("disconnected");
      // Reconnect after 3 seconds
      reconnectTimer.current = setTimeout(() => {
        if (apiKey) connect();
      }, 3000);
    };
  }, [apiKey, bounds, sendSubscription]);

  // Connect when API key is set
  useEffect(() => {
    if (!apiKey) {
      setStatus("disconnected");
      return;
    }
    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [apiKey, connect]);

  // Re-subscribe when bounds change
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && bounds) {
      sendSubscription(wsRef.current);
    }
  }, [bounds, sendSubscription]);

  // Flush ships to state periodically and prune stale ships
  useEffect(() => {
    flushTimer.current = setInterval(() => {
      const now = Date.now();
      const map = shipsRef.current;
      // Prune stale
      map.forEach((ship, id) => {
        if (now - ship.lastUpdate > SHIP_TTL_MS) map.delete(id);
      });
      setShips(new Map(map));
      setMessageCount(messageCountRef.current);
    }, 1000);

    return () => clearInterval(flushTimer.current);
  }, []);

  return { ships, status, messageCount };
}
