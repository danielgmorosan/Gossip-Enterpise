/**
 * Gossip Workspace — relay (v1).
 *
 * Source of truth for workspaces, channels, membership, and channel messages
 * (the "workspace-confidential", non-E2E group transport from the spec — TLS in transit,
 * persisted to disk here, NOT end-to-end encrypted; that's the deliberate v1 tradeoff
 * until group-E2E (fan-out → MLS) lands). DMs stay E2E via the gossip-sdk, untouched.
 *
 * Run: node services/relay/server.mjs   (PORT env, default 8788)
 */
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { AccessToken } from "livekit-server-sdk";

const HERE = dirname(fileURLToPath(import.meta.url));

// Load services/relay/.env (KEY=VALUE) if present — keeps the LiveKit secret server-side.
const ENV_FILE = join(HERE, ".env");
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

const PORT = Number(process.env.PORT ?? 8788);
const HISTORY_CAP = 500;
const DATA_FILE = join(HERE, ".data.json");

const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";
const livekitConfigured = Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);

// ── OpenClaw AI (model routing) ──────────────────────────────────────
// Default route = local Ollama (native /api/chat, NOT /v1 — keeps tool-calling intact).
// Cloud (Anthropic) is an opt-in route added later. The AI lives here in the relay, which
// only holds CHANNEL data — so it structurally cannot read E2E DMs.
const AI_ROUTE = process.env.AI_ROUTE ?? "local";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const AI_MODEL = process.env.AI_MODEL ?? "qwen2.5:14b";
const MAX_MSGS_PER_CHANNEL = 120;

/** Persistent state. */
let db = { workspaces: {}, messages: {} }; // workspaces[id], messages[`${wsId}/${chId}`] = []
if (existsSync(DATA_FILE)) {
  try {
    db = JSON.parse(readFileSync(DATA_FILE, "utf8"));
    db.workspaces ??= {};
    db.messages ??= {};
  } catch {
    /* start fresh */
  }
}
let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      writeFileSync(DATA_FILE, JSON.stringify(db));
    } catch (e) {
      console.error("[relay] save failed", e);
    }
  }, 400);
}

const clients = new Set(); // { ws, userId, name, wsSubs:Set, chSubs:Set }

const shortId = (p) => p + randomUUID().replace(/-/g, "").slice(0, 8);
const genCode = () =>
  Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

function serializeWorkspace(ws) {
  return {
    id: ws.id,
    name: ws.name,
    code: ws.code,
    createdBy: ws.createdBy,
    channels: Object.values(ws.channels),
    members: Object.values(ws.members),
  };
}

function findWorkspace(key) {
  if (!key) return null;
  if (db.workspaces[key]) return db.workspaces[key];
  const up = String(key).toUpperCase();
  return Object.values(db.workspaces).find((w) => w.code === up) ?? null;
}

const send = (ws, obj) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(obj));
function broadcastWorkspace(wsId, obj) {
  const data = JSON.stringify(obj);
  for (const c of clients) if (c.wsSubs.has(wsId) && c.ws.readyState === c.ws.OPEN) c.ws.send(data);
}
function broadcastChannel(chKey, obj) {
  const data = JSON.stringify(obj);
  for (const c of clients) if (c.chSubs.has(chKey) && c.ws.readyState === c.ws.OPEN) c.ws.send(data);
}
function presence(wsId, chId) {
  const chKey = `${wsId}/${chId}`;
  const ids = new Set();
  for (const c of clients) if (c.chSubs.has(chKey) && c.userId) ids.add(c.userId);
  broadcastChannel(chKey, { type: "presence", workspaceId: wsId, channelId: chId, count: ids.size });
}

function addChannel(ws, { name, type, topic, createdBy }) {
  const id = shortId("ch_");
  ws.channels[id] = {
    id,
    name: String(name).replace(/[^a-z0-9-_ ]/gi, "").trim().slice(0, 40) || "channel",
    type: type === "private" ? "private" : "public",
    topic: String(topic ?? "").slice(0, 200),
    createdBy,
    createdAt: Date.now(),
  };
  return ws.channels[id];
}

// HTTP server: LiveKit token + config (and shares the port with the WebSocket relay).
function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });
}

// ── AI helpers ───────────────────────────────────────────────────────
function gatherChannelContext(workspaceId, channelIds) {
  const ws = db.workspaces[workspaceId];
  if (!ws) return { transcript: "", channels: [], citations: [] };
  const channels = [];
  const citations = [];
  let transcript = "";
  for (const chId of channelIds) {
    const ch = ws.channels[chId];
    if (!ch) continue; // only channels that exist in this workspace
    const msgs = (db.messages[`${workspaceId}/${chId}`] ?? []).slice(-MAX_MSGS_PER_CHANNEL);
    if (msgs.length === 0) continue;
    channels.push(ch.name);
    transcript += `\n## #${ch.name}\n`;
    for (const m of msgs) {
      const t = new Date(m.ts).toISOString().slice(0, 16).replace("T", " ");
      transcript += `[${t}] ${m.senderName}: ${m.body}\n`;
      citations.push({ channelId: chId, messageId: m.id, ts: t });
    }
  }
  return { transcript: transcript.trim(), channels, citations };
}

async function ollamaChat(system, user) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL,
      stream: false,
      options: { num_ctx: 8192, temperature: 0.3 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.message?.content ?? "";
}

const SYSTEM_PROMPT =
  "You are OpenClaw, a privacy-first assistant inside a team workspace. " +
  "You can ONLY see the channel content provided to you below — you have no access to direct messages or anything else. " +
  "Answer strictly from the provided channel content. If the answer isn't there, say so. " +
  "Be concise and well-structured; use short bullets for recaps and call out decisions and action items.";

async function runAiJob({ workspaceId, channelScope, type, prompt }) {
  const { transcript, channels, citations } = gatherChannelContext(workspaceId, channelScope ?? []);
  const ask =
    type === "recap"
      ? `Recap these channels — key updates, decisions, and action items.${prompt ? " Focus: " + prompt : ""}`
      : type === "notes"
        ? `Produce meeting-style notes and action items from this content.${prompt ? " Focus: " + prompt : ""}`
        : prompt || "Summarize the most important points.";
  const context = transcript
    ? `Channel content you may use (channels: ${channels.map((c) => "#" + c).join(", ") || "none"}):\n${transcript}`
    : "There is no channel content available for the requested scope.";
  const text = await ollamaChat(SYSTEM_PROMPT, `${context}\n\n---\nRequest: ${ask}`);
  return {
    id: `job_${randomUUID().slice(0, 8)}`,
    type: type ?? "qa",
    route: AI_ROUTE,
    model: AI_MODEL,
    text,
    citations: citations.slice(0, 8),
    createdAt: new Date().toISOString(),
  };
}
const httpServer = createServer(async (req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  if (req.method === "GET" && req.url === "/livekit-config") {
    return json(200, { configured: livekitConfigured, url: LIVEKIT_URL });
  }
  if (req.method === "POST" && req.url === "/livekit-token") {
    if (!livekitConfigured) return json(503, { error: "LiveKit not configured. Set creds in services/relay/.env" });
    try {
      const { room, identity, name } = JSON.parse((await readBody(req)) || "{}");
      if (!room || !identity) return json(400, { error: "room and identity required" });
      const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name: name || identity, ttl: "2h" });
      at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
      return json(200, { token: await at.toJwt(), url: LIVEKIT_URL });
    } catch (e) {
      return json(500, { error: String(e) });
    }
  }
  if (req.method === "GET" && req.url === "/openclaw/health") {
    let ollamaUp = false;
    let hasModel = false;
    try {
      const r = await fetch(`${OLLAMA_URL}/api/tags`);
      ollamaUp = r.ok;
      if (r.ok) {
        const tags = await r.json();
        hasModel = (tags.models ?? []).some((m) => m.name?.startsWith(AI_MODEL.split(":")[0]));
      }
    } catch {
      /* down */
    }
    return json(200, { ok: ollamaUp && hasModel, route: AI_ROUTE, model: AI_MODEL, ollama: ollamaUp, hasModel });
  }
  if (req.method === "POST" && req.url === "/openclaw/jobs") {
    try {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (!body.workspaceId) return json(400, { error: "workspaceId required" });
      const result = await runAiJob(body);
      return json(200, result);
    } catch (e) {
      const msg = String(e);
      const code = /ECONNREFUSED|fetch failed|ollama/.test(msg) ? 503 : 500;
      return json(code, { error: code === 503 ? "Local model unavailable — is Ollama running?" : msg });
    }
  }
  if (req.method === "GET" && req.url === "/health") return json(200, { ok: true, livekit: livekitConfigured });
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });
httpServer.listen(PORT);
console.log(
  `[relay] http+ws on :${PORT}  (${Object.keys(db.workspaces).length} workspaces, livekit ${livekitConfigured ? "configured" : "NOT configured"})`,
);

wss.on("connection", (ws) => {
  const client = { ws, userId: null, name: "Someone", wsSubs: new Set(), chSubs: new Set() };
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
        client.userId = String(m.userId ?? "").slice(0, 80) || `anon-${randomUUID().slice(0, 6)}`;
        client.name = String(m.name ?? "Someone").slice(0, 40);
        break;

      case "createWorkspace": {
        const id = shortId("ws_");
        const workspace = {
          id,
          name: String(m.name ?? "Workspace").slice(0, 60) || "Workspace",
          code: genCode(),
          createdBy: client.userId,
          createdAt: Date.now(),
          channels: {},
          members: {},
        };
        addChannel(workspace, { name: "general", type: "public", topic: "Company-wide chatter.", createdBy: client.userId });
        workspace.members[client.userId] = { userId: client.userId, name: client.name, role: "owner", joinedAt: Date.now() };
        db.workspaces[id] = workspace;
        client.wsSubs.add(id);
        save();
        send(ws, { type: "workspaceCreated", ref: m.ref, workspace: serializeWorkspace(workspace) });
        break;
      }

      case "joinWorkspace": {
        const workspace = findWorkspace(m.key);
        if (!workspace) {
          send(ws, { type: "error", ref: m.ref, message: "Workspace not found. Check the code." });
          break;
        }
        workspace.members[client.userId] = workspace.members[client.userId] ?? {
          userId: client.userId,
          name: client.name,
          role: "member",
          joinedAt: Date.now(),
        };
        client.wsSubs.add(workspace.id);
        save();
        send(ws, { type: "workspace", ref: m.ref, workspace: serializeWorkspace(workspace) });
        broadcastWorkspace(workspace.id, { type: "memberJoined", workspaceId: workspace.id, member: workspace.members[client.userId] });
        break;
      }

      case "openWorkspace": {
        const workspace = db.workspaces[m.workspaceId];
        if (!workspace) {
          send(ws, { type: "error", ref: m.ref, message: "Workspace not found." });
          break;
        }
        client.wsSubs.add(workspace.id);
        // ensure membership (e.g. creator returning) — keep if present
        if (client.userId && !workspace.members[client.userId]) {
          workspace.members[client.userId] = { userId: client.userId, name: client.name, role: "member", joinedAt: Date.now() };
          save();
        }
        send(ws, { type: "workspace", ref: m.ref, workspace: serializeWorkspace(workspace) });
        break;
      }

      case "createChannel": {
        const workspace = db.workspaces[m.workspaceId];
        if (!workspace) {
          send(ws, { type: "error", ref: m.ref, message: "Workspace not found." });
          break;
        }
        const channel = addChannel(workspace, { name: m.name, type: m.channelType, topic: m.topic, createdBy: client.userId });
        save();
        broadcastWorkspace(workspace.id, { type: "channelCreated", workspaceId: workspace.id, channel });
        send(ws, { type: "channelCreated", ref: m.ref, workspaceId: workspace.id, channel });
        break;
      }

      case "joinChannel": {
        const chKey = `${m.workspaceId}/${m.channelId}`;
        client.chSubs.add(chKey);
        send(ws, { type: "history", workspaceId: m.workspaceId, channelId: m.channelId, messages: db.messages[chKey] ?? [] });
        presence(m.workspaceId, m.channelId);
        break;
      }

      case "post": {
        const chKey = `${m.workspaceId}/${m.channelId}`;
        const body = String(m.body ?? "").slice(0, 4000);
        if (!body.trim()) break;
        const msg = {
          id: randomUUID(),
          workspaceId: m.workspaceId,
          channelId: m.channelId,
          senderId: client.userId ?? "anon",
          senderName: client.name,
          body,
          ts: Date.now(),
          clientMsgId: m.clientMsgId ?? null,
        };
        const arr = db.messages[chKey] ?? [];
        arr.push(msg);
        while (arr.length > HISTORY_CAP) arr.shift();
        db.messages[chKey] = arr;
        save();
        broadcastChannel(chKey, { type: "message", workspaceId: m.workspaceId, channelId: m.channelId, message: msg });
        break;
      }
    }
  });

  ws.on("close", () => {
    const subs = [...client.chSubs];
    clients.delete(client);
    for (const chKey of subs) {
      const [wsId, chId] = chKey.split("/");
      presence(wsId, chId);
    }
  });
  ws.on("error", () => {});
});
