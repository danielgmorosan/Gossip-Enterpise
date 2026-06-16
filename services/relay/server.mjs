/**
 * Gossip Workspace — channel relay (v1).
 *
 * A minimal WebSocket fan-out for group channels. This is the "workspace-confidential"
 * (non-E2E) transport described in the spec: channels are rooms backed by a relay, TLS in
 * transit, recent history kept in memory. NOT end-to-end encrypted — that's the deliberate
 * v1 tradeoff until the group-E2E upgrade (fan-out → MLS) lands.
 *
 * Run: node services/relay/server.mjs   (PORT env, default 8788)
 */
import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8788);
const HISTORY_CAP = 300;

/** channelId -> Message[] */
const history = new Map();
/** Set<client> where client = { ws, userId, name, channels:Set<string> } */
const clients = new Set();

const wss = new WebSocketServer({ port: PORT });
console.log(`[relay] channel relay listening on ws://localhost:${PORT}`);

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(channelId, obj) {
  const data = JSON.stringify(obj);
  for (const c of clients) {
    if (c.channels.has(channelId) && c.ws.readyState === c.ws.OPEN) c.ws.send(data);
  }
}

function presence(channelId) {
  const ids = new Set();
  for (const c of clients) if (c.channels.has(channelId) && c.userId) ids.add(c.userId);
  broadcast(channelId, { type: "presence", channelId, count: ids.size });
}

wss.on("connection", (ws) => {
  const client = { ws, userId: null, name: "Someone", channels: new Set() };
  clients.add(client);

  ws.on("message", (raw) => {
    let m;
    try {
      m = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (m.type) {
      case "hello":
        client.userId = String(m.userId ?? "").slice(0, 80);
        client.name = String(m.name ?? "Someone").slice(0, 40);
        break;
      case "join": {
        const ch = String(m.channelId);
        client.channels.add(ch);
        send(ws, { type: "history", channelId: ch, messages: history.get(ch) ?? [] });
        presence(ch);
        break;
      }
      case "leave": {
        const ch = String(m.channelId);
        client.channels.delete(ch);
        presence(ch);
        break;
      }
      case "post": {
        const ch = String(m.channelId);
        const body = String(m.body ?? "").slice(0, 4000);
        if (!ch || !body.trim()) return;
        const msg = {
          id: randomUUID(),
          channelId: ch,
          senderId: client.userId ?? "anon",
          senderName: client.name,
          body,
          ts: Date.now(),
          clientMsgId: m.clientMsgId ?? null,
        };
        const arr = history.get(ch) ?? [];
        arr.push(msg);
        while (arr.length > HISTORY_CAP) arr.shift();
        history.set(ch, arr);
        broadcast(ch, { type: "message", channelId: ch, message: msg });
        break;
      }
    }
  });

  ws.on("close", () => {
    clients.delete(client);
    for (const ch of client.channels) presence(ch);
  });
  ws.on("error", () => {});
});
