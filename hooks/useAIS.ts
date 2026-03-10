import { useState, useEffect, useRef, useCallback } from 'react';
import { Ship, BoundingBox } from '@/types/ship';
import { getVesselTypeName } from '@/utils/vesselTypes';

const WS_URL = 'wss://stream.aisstream.io/v0/stream';
const MAX_PATH_POINTS = 20;
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export function useAIS(apiKey: string | null, boundingBox: BoundingBox | null) {
  const [ships, setShips] = useState<Map<string, Ship>>(new Map());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttempts = useRef(0);
  const boundingBoxRef = useRef(boundingBox);
  const apiKeyRef = useRef(apiKey);

  boundingBoxRef.current = boundingBox;
  apiKeyRef.current = apiKey;

  const sendSubscription = useCallback((ws: WebSocket, bb: BoundingBox, key: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        APIKey: key,
        BoundingBoxes: [[[bb.minLat, bb.minLon], [bb.maxLat, bb.maxLon]]],
      }));
    }
  }, []);

  const processMessage = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const msg = data as Record<string, unknown>;
    const { MessageType, MetaData, Message } = msg;

    if (!MetaData || typeof MetaData !== 'object') return;
    const meta = MetaData as Record<string, unknown>;

    const mmsi = String(meta.MMSI ?? meta.UserID ?? '');
    if (!mmsi || mmsi === 'undefined' || mmsi === '0') return;

    setShips((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(mmsi);

      const lat = typeof meta.latitude === 'number' ? meta.latitude : existing?.lat;
      const lon = typeof meta.longitude === 'number' ? meta.longitude : existing?.lon;

      if (!lat || !lon) return prev;

      const updates: Partial<Ship> = { lat, lon, timestamp: Date.now() };

      if (MessageType === 'PositionReport' && Message && typeof Message === 'object') {
        const pr = (Message as Record<string, unknown>).PositionReport as Record<string, unknown> | undefined;
        if (pr) {
          const th = typeof pr.TrueHeading === 'number' ? pr.TrueHeading : null;
          const cog = typeof pr.Cog === 'number' ? pr.Cog : null;
          if (th !== null && th < 360) updates.heading = th;
          else if (cog !== null) updates.heading = cog;
          if (typeof pr.Sog === 'number') updates.speed = pr.Sog;
        }
      }

      if (MessageType === 'ShipStaticData' && Message && typeof Message === 'object') {
        const ssd = (Message as Record<string, unknown>).ShipStaticData as Record<string, unknown> | undefined;
        if (ssd) {
          if (typeof ssd.Type === 'number') {
            updates.typeCode = ssd.Type;
            updates.type = getVesselTypeName(ssd.Type);
          }
          if (typeof ssd.Name === 'string' && ssd.Name.trim()) {
            updates.name = ssd.Name.trim();
          }
          if (typeof ssd.Destination === 'string' && ssd.Destination.trim()) {
            updates.destination = ssd.Destination.trim();
          }
          if (typeof ssd.CallSign === 'string' && ssd.CallSign.trim()) {
            updates.callsign = ssd.CallSign.trim();
          }
          if (ssd.Dimension && typeof ssd.Dimension === 'object') {
            const dim = ssd.Dimension as Record<string, number>;
            updates.length = (dim.A || 0) + (dim.B || 0);
            updates.width = (dim.C || 0) + (dim.D || 0);
          }
        }
      }

      // Update path only if position changed
      const prevPath = existing?.path ?? [];
      const last = prevPath[prevPath.length - 1];
      const hasMoved = !last || Math.abs(last[0] - lat) > 0.0001 || Math.abs(last[1] - lon) > 0.0001;
      const newPath = hasMoved
        ? [...prevPath.slice(-(MAX_PATH_POINTS - 1)), [lat, lon] as [number, number]]
        : prevPath;

      const ship: Ship = {
        id: mmsi,
        name: typeof meta.ShipName === 'string' && meta.ShipName.trim()
          ? meta.ShipName.trim()
          : existing?.name ?? `MMSI ${mmsi}`,
        type: existing?.type ?? 'other',
        typeCode: existing?.typeCode ?? 0,
        lat,
        lon,
        speed: existing?.speed ?? 0,
        heading: existing?.heading ?? 0,
        path: newPath,
        timestamp: Date.now(),
        destination: existing?.destination,
        callsign: existing?.callsign,
        length: existing?.length,
        width: existing?.width,
        ...updates,
      };

      newMap.set(mmsi, ship);
      return newMap;
    });
  }, []);

  const connect = useCallback(() => {
    const key = apiKeyRef.current;
    const bb = boundingBoxRef.current;
    if (!key || !bb) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendSubscription(wsRef.current, bb, key);
      return;
    }

    wsRef.current?.close();

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      const currentBB = boundingBoxRef.current;
      const currentKey = apiKeyRef.current;
      if (currentBB && currentKey) sendSubscription(ws, currentBB, currentKey);
    };

    ws.onmessage = (event) => {
      try {
        processMessage(JSON.parse(event.data as string));
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      wsRef.current = null;
      if (event.code !== 1000) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      setError('Connection failed. Verify your API key at aisstream.io');
    };
  }, [sendSubscription, processMessage]);

  // Connect / disconnect when apiKey changes
  useEffect(() => {
    if (!apiKey) {
      wsRef.current?.close(1000);
      wsRef.current = null;
      setConnected(false);
      setShips(new Map());
      return;
    }
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close(1000);
      wsRef.current = null;
    };
  }, [apiKey, connect]);

  // Update subscription when bounding box changes
  useEffect(() => {
    if (apiKey && boundingBox && wsRef.current?.readyState === WebSocket.OPEN) {
      sendSubscription(wsRef.current, boundingBox, apiKey);
    }
  }, [apiKey, boundingBox, sendSubscription]);

  // Periodically remove stale ships
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setShips((prev) => {
        let changed = false;
        const next = new Map(prev);
        next.forEach((ship, id) => {
          if (now - ship.timestamp > STALE_THRESHOLD_MS) {
            next.delete(id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  return { ships, connected, error };
}
