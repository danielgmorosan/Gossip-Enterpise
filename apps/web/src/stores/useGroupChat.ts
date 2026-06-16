import { create } from "zustand";
import { useSession } from "./useSession";

export interface ChannelMsg {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  body: string;
  ts: number;
  clientMsgId?: string | null;
}

type ConnState = "idle" | "connecting" | "open" | "closed";

interface GroupChatState {
  conn: ConnState;
  messagesByChannel: Record<string, ChannelMsg[]>;
  presenceByChannel: Record<string, number>;
  joined: Set<string>;
  connect: () => void;
  join: (channelId: string) => void;
  post: (channelId: string, body: string) => void;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/group-ws`;
}

export const useGroupChat = create<GroupChatState>((set, get) => ({
  conn: "idle",
  messagesByChannel: {},
  presenceByChannel: {},
  joined: new Set(),

  connect: () => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    set({ conn: "connecting" });
    ws = new WebSocket(wsUrl());

    ws.onopen = () => {
      set({ conn: "open" });
      const s = useSession.getState();
      const name = s.displayName || (s.userId ? `user-${s.userId.slice(7, 11)}` : "Someone");
      ws?.send(JSON.stringify({ type: "hello", userId: s.userId, name }));
      // Re-join any channels we were in (after a reconnect).
      for (const ch of get().joined) ws?.send(JSON.stringify({ type: "join", channelId: ch }));
    };

    ws.onmessage = (ev) => {
      let m: { type: string; channelId?: string; messages?: ChannelMsg[]; message?: ChannelMsg; count?: number };
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.type === "history" && m.channelId) {
        set((st) => ({ messagesByChannel: { ...st.messagesByChannel, [m.channelId!]: m.messages ?? [] } }));
      } else if (m.type === "message" && m.message) {
        const msg = m.message;
        set((st) => {
          const cur = st.messagesByChannel[msg.channelId] ?? [];
          if (cur.some((x) => x.id === msg.id)) return st;
          return { messagesByChannel: { ...st.messagesByChannel, [msg.channelId]: [...cur, msg] } };
        });
      } else if (m.type === "presence" && m.channelId) {
        set((st) => ({ presenceByChannel: { ...st.presenceByChannel, [m.channelId!]: m.count ?? 0 } }));
      }
    };

    ws.onclose = () => {
      set({ conn: "closed" });
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => get().connect(), 1500);
    };
    ws.onerror = () => ws?.close();
  },

  join: (channelId) => {
    get().connect();
    set((st) => {
      const joined = new Set(st.joined);
      joined.add(channelId);
      return { joined };
    });
    const trySend = () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "join", channelId }));
      else setTimeout(trySend, 300);
    };
    trySend();
  },

  post: (channelId, body) => {
    const text = body.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "post", channelId, body: text, clientMsgId: crypto.randomUUID() }));
  },
}));
