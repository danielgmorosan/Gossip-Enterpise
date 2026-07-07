import { create } from "zustand";
import { useSession } from "./useSession";
import { relayWsUrl } from "@/lib/relayBase";

export interface ChannelMsg {
  id: string;
  workspaceId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  body: string;
  ts: number;
}
export interface RelayChannel {
  id: string;
  name: string;
  type: "public" | "private";
  topic: string;
  createdBy: string;
  createdAt: number;
}
export interface RelayMember {
  userId: string;
  name: string;
  role: "owner" | "admin" | "member" | "guest";
  joinedAt: number;
}
export interface RelayWorkspace {
  id: string;
  name: string;
  code: string;
  createdBy: string;
  channels: RelayChannel[];
  members: RelayMember[];
}
export interface MyWorkspace {
  id: string;
  name: string;
  code: string;
}

type ConnState = "idle" | "connecting" | "open" | "closed";

const MY_WS_KEY = "gossip-my-workspaces";
function loadMyWorkspaces(): MyWorkspace[] {
  try {
    return JSON.parse(localStorage.getItem(MY_WS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveMyWorkspaces(list: MyWorkspace[]) {
  localStorage.setItem(MY_WS_KEY, JSON.stringify(list));
}

interface RelayState {
  conn: ConnState;
  myWorkspaces: MyWorkspace[];
  workspace: RelayWorkspace | null;
  messagesByChannel: Record<string, ChannelMsg[]>;
  presenceByChannel: Record<string, number>;
  joinedChannels: Set<string>;

  connect: () => void;
  rememberWorkspace: (w: MyWorkspace) => void;
  createWorkspace: (name: string) => Promise<{ ok: true; workspace: RelayWorkspace } | { ok: false; error: string }>;
  joinWorkspace: (key: string) => Promise<{ ok: true; workspace: RelayWorkspace } | { ok: false; error: string }>;
  leaveWorkspace: (workspaceId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  openWorkspace: (workspaceId: string) => Promise<RelayWorkspace | null>;
  createChannel: (workspaceId: string, name: string, type?: "public" | "private", topic?: string) => Promise<{ ok: true; channel: RelayChannel } | { ok: false; error: string }>;
  joinChannel: (workspaceId: string, channelId: string) => void;
  post: (workspaceId: string, channelId: string, body: string) => void;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let refCounter = 0;
const pending = new Map<string, (m: RelayMsg) => void>();

interface RelayMsg {
  type: string;
  ref?: string;
  workspace?: RelayWorkspace;
  channel?: RelayChannel;
  channelId?: string;
  workspaceId?: string;
  messages?: ChannelMsg[];
  message?: ChannelMsg;
  member?: RelayMember;
  userId?: string;
  count?: number;
  error?: string;
}

function wsUrl() {
  return relayWsUrl("/group-ws");
}

function sendHello() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return; // onopen will send hello once connected
  const s = useSession.getState();
  const name = s.displayName || (s.userId ? `user-${s.userId.slice(7, 11)}` : "Someone");
  ws.send(JSON.stringify({ type: "hello", userId: s.userId, name }));
}

function request<T extends RelayMsg>(payload: object): Promise<T> {
  return new Promise((resolve) => {
    const ref = `r${++refCounter}`;
    pending.set(ref, (m) => resolve(m as T));
    const trySend = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendHello(); // ensure the server knows our identity before the request
        ws.send(JSON.stringify({ ...payload, ref }));
      } else setTimeout(trySend, 200);
    };
    trySend();
  });
}

export const useRelay = create<RelayState>((set, get) => ({
  conn: "idle",
  myWorkspaces: loadMyWorkspaces(),
  workspace: null,
  messagesByChannel: {},
  presenceByChannel: {},
  joinedChannels: new Set(),

  connect: () => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    set({ conn: "connecting" });
    ws = new WebSocket(wsUrl());
    ws.onopen = () => {
      set({ conn: "open" });
      sendHello();
      // re-subscribe channels after a reconnect
      const cur = get();
      if (cur.workspace) ws?.send(JSON.stringify({ type: "openWorkspace", workspaceId: cur.workspace.id }));
      for (const key of cur.joinedChannels) {
        const [workspaceId, channelId] = key.split("/");
        ws?.send(JSON.stringify({ type: "joinChannel", workspaceId, channelId }));
      }
    };
    ws.onmessage = (ev) => {
      let m: RelayMsg;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.ref && pending.has(m.ref)) {
        pending.get(m.ref)!(m);
        pending.delete(m.ref);
      }
      switch (m.type) {
        case "workspace":
        case "workspaceCreated":
          if (m.workspace) set({ workspace: m.workspace });
          break;
        case "channelCreated":
          set((st) =>
            st.workspace && st.workspace.id === m.workspaceId && m.channel
              ? { workspace: { ...st.workspace, channels: [...st.workspace.channels.filter((c) => c.id !== m.channel!.id), m.channel] } }
              : st,
          );
          break;
        case "memberJoined":
          set((st) =>
            st.workspace && st.workspace.id === m.workspaceId && m.member
              ? { workspace: { ...st.workspace, members: [...st.workspace.members.filter((x) => x.userId !== m.member!.userId), m.member] } }
              : st,
          );
          break;
        case "memberLeft":
          set((st) =>
            st.workspace && st.workspace.id === m.workspaceId && m.userId
              ? { workspace: { ...st.workspace, members: st.workspace.members.filter((x) => x.userId !== m.userId) } }
              : st,
          );
          break;
        case "history":
          if (m.channelId) set((st) => ({ messagesByChannel: { ...st.messagesByChannel, [m.channelId!]: m.messages ?? [] } }));
          break;
        case "message":
          if (m.message) {
            const msg = m.message;
            set((st) => {
              const cur = st.messagesByChannel[msg.channelId] ?? [];
              if (cur.some((x) => x.id === msg.id)) return st;
              return { messagesByChannel: { ...st.messagesByChannel, [msg.channelId]: [...cur, msg] } };
            });
          }
          break;
        case "presence":
          if (m.channelId) set((st) => ({ presenceByChannel: { ...st.presenceByChannel, [m.channelId!]: m.count ?? 0 } }));
          break;
      }
    };
    ws.onclose = () => {
      set({ conn: "closed" });
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => get().connect(), 1500);
    };
    ws.onerror = () => ws?.close();
  },

  rememberWorkspace: (w) => {
    // Keep a stable order: update in place if known, append if new (no reshuffle on open).
    const cur = get().myWorkspaces;
    const list = cur.some((x) => x.id === w.id)
      ? cur.map((x) => (x.id === w.id ? w : x))
      : [...cur, w];
    saveMyWorkspaces(list);
    set({ myWorkspaces: list });
  },

  createWorkspace: async (name) => {
    get().connect();
    sendHello();
    const m = await request({ type: "createWorkspace", name });
    if (m.type === "error" || !m.workspace) return { ok: false, error: m.error ?? "Failed to create workspace" };
    get().rememberWorkspace({ id: m.workspace.id, name: m.workspace.name, code: m.workspace.code });
    set({ workspace: m.workspace });
    return { ok: true, workspace: m.workspace };
  },

  joinWorkspace: async (key) => {
    get().connect();
    sendHello();
    const m = await request({ type: "joinWorkspace", key });
    if (m.type === "error" || !m.workspace) return { ok: false, error: m.error ?? "Couldn't join workspace" };
    get().rememberWorkspace({ id: m.workspace.id, name: m.workspace.name, code: m.workspace.code });
    set({ workspace: m.workspace });
    return { ok: true, workspace: m.workspace };
  },

  leaveWorkspace: async (workspaceId) => {
    get().connect();
    sendHello();
    const m = await request({ type: "leaveWorkspace", workspaceId });
    if (m.type === "error") return { ok: false, error: m.error ?? "Couldn't leave the workspace" };
    const list = get().myWorkspaces.filter((x) => x.id !== workspaceId);
    saveMyWorkspaces(list);
    set((st) => ({
      myWorkspaces: list,
      workspace: st.workspace?.id === workspaceId ? null : st.workspace,
    }));
    return { ok: true };
  },

  openWorkspace: async (workspaceId) => {
    get().connect();
    sendHello();
    if (get().workspace?.id === workspaceId) {
      // refresh in background
      request({ type: "openWorkspace", workspaceId });
      return get().workspace;
    }
    const m = await request({ type: "openWorkspace", workspaceId });
    if (m.workspace) {
      get().rememberWorkspace({ id: m.workspace.id, name: m.workspace.name, code: m.workspace.code });
      set({ workspace: m.workspace });
      return m.workspace;
    }
    return null;
  },

  createChannel: async (workspaceId, name, type = "public", topic = "") => {
    const m = await request({ type: "createChannel", workspaceId, name, channelType: type, topic });
    if (m.type === "error" || !m.channel) return { ok: false, error: m.error ?? "Failed to create channel" };
    return { ok: true, channel: m.channel };
  },

  joinChannel: (workspaceId, channelId) => {
    get().connect();
    set((st) => {
      const joined = new Set(st.joinedChannels);
      joined.add(`${workspaceId}/${channelId}`);
      return { joinedChannels: joined };
    });
    const trySend = () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "joinChannel", workspaceId, channelId }));
      else setTimeout(trySend, 250);
    };
    trySend();
  },

  post: (workspaceId, channelId, body) => {
    const text = body.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "post", workspaceId, channelId, body: text, clientMsgId: crypto.randomUUID() }));
  },
}));

if (import.meta.env.DEV) {
  (globalThis as unknown as { __relay: unknown }).__relay = useRelay;
}
