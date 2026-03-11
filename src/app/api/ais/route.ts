import { NextRequest } from "next/server";
import WebSocket from "ws";

const WS_URL = "wss://stream.aisstream.io/v0/stream";
const API_KEY = process.env.NEXT_PUBLIC_AISSTREAM_API_KEY || "a06e87868eda965ac17184bab2c8e250f2e0856d";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const south = req.nextUrl.searchParams.get("south");
  const west = req.nextUrl.searchParams.get("west");
  const north = req.nextUrl.searchParams.get("north");
  const east = req.nextUrl.searchParams.get("east");

  if (!south || !west || !north || !east) {
    return new Response("Missing bounding box params", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("log", { msg: "Connecting to AISStream..." });

      const ws = new WebSocket(WS_URL);

      ws.on("open", () => {
        send("log", { msg: "WebSocket opened, subscribing..." });
        const sub = {
          APIKey: API_KEY,
          BoundingBoxes: [
            [[Number(south), Number(west)], [Number(north), Number(east)]],
          ],
          FilterMessageTypes: ["PositionReport"],
        };
        ws.send(JSON.stringify(sub));
        send("status", { status: "connected" });
      });

      ws.on("message", (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          send("ais", data);
        } catch {
          // skip malformed
        }
      });

      ws.on("error", (err) => {
        send("log", { msg: `WebSocket error: ${err.message}` });
        send("status", { status: "disconnected" });
      });

      ws.on("close", (code, reason) => {
        send("log", { msg: `WebSocket closed: code=${code} reason=${reason || "none"}` });
        send("status", { status: "disconnected" });
        controller.close();
      });

      // Close WebSocket if the client disconnects
      req.signal.addEventListener("abort", () => {
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
