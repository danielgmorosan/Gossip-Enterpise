import { create } from "zustand";
import { useSession } from "./useSession";
import { useNotifications, mentionsUser } from "./useNotifications";
import { useAvatars } from "./useAvatars";
import { useStatus } from "./useStatus";
import { relayWsUrl } from "@/lib/relayBase";
import { ensureAuthKey, authPublicKeySync, signChallenge } from "@/lib/relayAuth";

export interface ChannelMsg {
  id: string;
  workspaceId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  body: string;
  ts: number;
  /** Set on replies - id of the thread's root message. */
  threadRootId?: string | null;
  /** Quote-reply (T3): snapshot of the message this one replies to. */
  replyTo?: { id: string; senderId: string; senderName: string; body: string } | null;
  /** Set when the author edited the message. */
  editedAt?: number | null;
  /** Soft delete - body is cleared server-side; render a tombstone. */
  deleted?: boolean;
  deletedAt?: number | null;
  deletedBy?: string | null;
  /** Inline attachment (channels only; uploaded via the relay /uploads). */
  attachment?: { id: string; url: string; name: string; type: string; size: number } | null;
  /** Emoji reactions (T4): emoji → userIds who reacted. */
  reactions?: Record<string, string[]>;
}
export interface RelayChannel {
  /** Unread count for ME, computed server-side from my read marker (T4). */
  unread?: number;
  lastReadTs?: number;
  id: string;
  name: string;
  type: "public" | "private";
  topic: string;
  createdBy: string;
  createdAt: number;
  /** Private channels only (T2-08): userIds allowed to see/read/post. */
  members?: string[];
  /** T3: the channel has a join password (the password itself never leaves the relay). */
  hasPassword?: boolean;
  /** T3: you're NOT a member - this is a password-protected stub (no messages until you join). */
  locked?: boolean;
}
/** Granular admin permissions (T2-07) - the Owner picks these at promotion. */
export type AdminPermission = "manageChannels" | "manageMembers" | "manageRoles" | "ban" | "moderateMessages";
export const ADMIN_PERMISSIONS: { id: AdminPermission; label: string; desc: string }[] = [
  { id: "manageChannels", label: "Manage channels", desc: "Create, edit, and manage channels." },
  { id: "manageMembers", label: "Manage members", desc: "Manage channel membership and invites." },
  { id: "manageRoles", label: "Manage roles", desc: "Reserved for future role tooling (assignment stays owner-only)." },
  { id: "ban", label: "Ban members", desc: "Ban and unban workspace members." },
  { id: "moderateMessages", label: "Moderate messages", desc: "Delete other members' channel messages." },
];

export interface RelayMember {
  userId: string;
  name: string;
  role: "owner" | "admin" | "member" | "guest";
  joinedAt: number;
  /** Present on admins: the permissions the Owner granted. */
  permissions?: AdminPermission[];
  /** Custom profile picture (small data-URI), synced via hello (T3). */
  avatar?: string;
}
export interface RelayBan {
  userId: string;
  name: string;
  reason: string;
  by: string;
  at: number;
}
export interface RelayWorkspace {
  id: string;
  name: string;
  code: string;
  createdBy: string;
  channels: RelayChannel[];
  members: RelayMember[];
  bans?: RelayBan[];
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
  /** channelId → live huddle info; empty when no calls are running (T3). */
  activeCallByChannel: Record<string, ActiveCall>;
  /** channelId → userId → who's typing right now (entries expire after 4s). */
  typingByChannel: Record<string, Record<string, { name: string; ts: number }>>;
  /** Currently-online userIds (workspace members + watched DM contacts) - T3. */
  onlineUsers: Set<string>;
  joinedChannels: Set<string>;

  connect: () => void;
  /** Re-announce name/avatar to the relay (call after profile changes). */
  syncProfile: () => void;
  /** Remove the synced avatar for everyone (profile "remove picture"). */
  clearProfileAvatar: () => void;
  rememberWorkspace: (w: MyWorkspace) => void;
  createWorkspace: (name: string) => Promise<{ ok: true; workspace: RelayWorkspace } | { ok: false; error: string }>;
  joinWorkspace: (key: string) => Promise<{ ok: true; workspace: RelayWorkspace } | { ok: false; error: string }>;
  leaveWorkspace: (workspaceId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Owner only (T3): delete the whole workspace, relay-enforced. */
  deleteWorkspace: (workspaceId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** manageChannels permission (T3). */
  deleteChannel: (workspaceId: string, channelId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  makeChannelPrivate: (workspaceId: string, channelId: string, password?: string, membership?: "everyone" | "self") => Promise<{ ok: true } | { ok: false; error: string }>;
  openWorkspace: (workspaceId: string) => Promise<RelayWorkspace | null>;
  createChannel: (workspaceId: string, name: string, type?: "public" | "private", topic?: string, password?: string) => Promise<{ ok: true; channel: RelayChannel } | { ok: false; error: string }>;
  /** T3: join a password-protected private channel. */
  joinChannelWithPassword: (workspaceId: string, channelId: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  joinChannel: (workspaceId: string, channelId: string) => void;
  post: (workspaceId: string, channelId: string, body: string, threadRootId?: string, attachmentId?: string, replyToId?: string) => void;
  /** Throttled "I'm typing" signal for a channel (T3). */
  sendTyping: (workspaceId: string, channelId: string) => void;
  /** Subscribe to online presence for specific DM contacts (T3). */
  watchPresence: (userIds: string[]) => void;
  /** Last leaver tells the relay the call is over (verified server-side) and clears it locally. */
  callEndedHint: (workspaceId: string, channelId: string) => void;
  editMessage: (workspaceId: string, channelId: string, messageId: string, body: string) => void;
  deleteMessage: (workspaceId: string, channelId: string, messageId: string) => void;
  /** Toggle an emoji reaction on a channel message (T4). */
  reactToMessage: (workspaceId: string, channelId: string, messageId: string, emoji: string) => void;
  /** Poke someone who shares a workspace with you - quacks on their end (T4). */
  poke: (userId: string) => void;
  /** channelId → userId → read marker (T4); drives "seen by" and unread sync. */
  readsByChannel: Record<string, Record<string, { ts: number; messageId: string }>>;
  /** Tell the relay how far I've read a channel; clears the local badge too (T4). */
  markChannelRead: (workspaceId: string, channelId: string) => void;
  /** Owner-only: promote/demote; permissions apply when role is "admin" (T2-07). */
  setRole: (workspaceId: string, userId: string, role: "admin" | "member", permissions?: AdminPermission[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  banMember: (workspaceId: string, userId: string, reason?: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  unbanMember: (workspaceId: string, userId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Private-channel membership (T2-08) - creator or manageMembers; relay-enforced. */
  addChannelMember: (workspaceId: string, channelId: string, userId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeChannelMember: (workspaceId: string, channelId: string, userId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let refCounter = 0;
const pending = new Map<string, (m: RelayMsg) => void>();
// D2: session token issued by the relay after a proven auth handshake. Sent as
// `Authorization: Bearer` on relay HTTP calls (uploads, LiveKit, AI) so the
// authenticated WS identity carries over. Null until the handshake completes.
let relaySessionToken: string | null = null;
// Handshake state so we sign a challenge at most once and never clobber a live
// token with a late/duplicate authError.
let authState: "idle" | "proving" | "done" = "idle";
let lastNonceSigned: string | null = null;
// Privileged sends wait on this until the auth handshake completes, so that with
// enforcement on (RELAY_REQUIRE_AUTH) we never fire post/join/etc. as an
// unproven identity. Resolved immediately when there's nothing to prove, and by
// a fallback timeout so a non-auth relay can't hang the app.
let authReadyP: Promise<void> = Promise.resolve();
let fireAuthReady: (() => void) | null = null;
function armAuthReady() {
  authReadyP = new Promise<void>((resolve) => {
    fireAuthReady = () => {
      fireAuthReady = null;
      resolve();
    };
  });
}
/** Send a privileged message once the identity handshake has completed. */
function sendReady(obj: object) {
  void authReadyP.then(() => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  });
}
/** The current relay session token, or null if not yet authenticated (D2). */
export function getRelaySessionToken(): string | null {
  return relaySessionToken;
}
/** `Authorization` header for relay HTTP calls when authenticated, else empty (D2). */
export function relayAuthHeader(): Record<string, string> {
  return relaySessionToken ? { authorization: `Bearer ${relaySessionToken}` } : {};
}
const lastTypingSent = new Map<string, number>();

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
  ban?: RelayBan;
  reason?: string;
  userId?: string;
  count?: number;
  startedByName?: string;
  name?: string;
  online?: string[] | boolean;
  error?: string;
  /** Poke sender (T4). */
  from?: string;
  /** Read receipts (T4). */
  reads?: Record<string, { ts: number; messageId: string }>;
  ts?: number;
  messageId?: string;
  // D2 auth handshake frames.
  nonce?: string;
  sessionToken?: string;
  code?: string;
}

/** Live huddle in a channel (T3): participant count + who kicked it off. */
export interface ActiveCall {
  count: number;
  startedByName?: string;
}

/** Relay errors carry their text in `message` (a string on error frames). */
function errText(m: RelayMsg, fallback: string): string {
  return typeof m.message === "string" ? m.message : (m.error ?? fallback);
}

function wsUrl() {
  return relayWsUrl("/group-ws");
}

function sendHello(clearAvatar = false, profileUpdate = false) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return; // onopen will send hello once connected
  const s = useSession.getState();
  const name = s.displayName || (s.userId ? `user-${s.userId.slice(7, 11)}` : "Someone");
  // Custom avatar rides along (small webp data-URI) so workspace members see
  // it. IMPORTANT: omit the field when this device has no local copy - a
  // second browser/device without the localStorage override must NOT wipe the
  // synced avatar. Explicit removal sends null (clearAvatar).
  let avatar: string | null | undefined = clearAvatar ? null : undefined;
  if (!clearAvatar && s.userId) {
    const o = useAvatars.getState().overrides[s.userId];
    if (o?.kind === "image" && o.dataUrl.length <= 65536) avatar = o.dataUrl;
  }
  const status = useStatus.getState().status; // "online" | "invisible" (T3)
  // profileUpdate=true (only from syncProfile after a real Settings change,
  // and only when a display name is actually set) lets the relay update the
  // registered member name. A routine hello never does.
  const explicit = profileUpdate && !!s.displayName;
  // D2: advertise our relay-auth public key (when derived) so the relay can
  // challenge us to prove this userId. Absent on the very first hello before
  // the key finishes deriving — onopen re-sends once it's ready. Once we're
  // authenticated we stop advertising it, so no further challenges are issued.
  const authPublicKey = authState !== "done" ? (authPublicKeySync() ?? undefined) : undefined;
  ws.send(
    JSON.stringify({
      type: "hello",
      userId: s.userId,
      name,
      status,
      ...(explicit ? { profileUpdate: true } : {}),
      ...(avatar !== undefined ? { avatar } : {}),
      ...(authPublicKey ? { authPublicKey } : {}),
    }),
  );
}

function request<T extends RelayMsg>(payload: object): Promise<T> {
  return new Promise((resolve) => {
    const ref = `r${++refCounter}`;
    pending.set(ref, (m) => resolve(m as T));
    const trySend = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Wait for the identity handshake so privileged requests aren't sent
        // (and rejected) as an unproven identity under enforcement.
        void authReadyP.then(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            sendHello(); // ensure the server knows our identity before the request
            ws.send(JSON.stringify({ ...payload, ref }));
          } else setTimeout(trySend, 200);
        });
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
  activeCallByChannel: {},
  typingByChannel: {},
  onlineUsers: new Set(),
  joinedChannels: new Set(),
  readsByChannel: {},

  connect: () => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    set({ conn: "connecting" });
    ws = new WebSocket(wsUrl());
    ws.onopen = () => {
      set({ conn: "open" });
      // Stale across reconnects; re-earned via the handshake.
      relaySessionToken = null;
      authState = "idle";
      lastNonceSigned = null;
      armAuthReady();
      sendHello();
      // Auto-heal: if we have a real display name, re-announce it as an explicit
      // profile update so the relay's member record can't stay stuck on an old
      // "user-xxxx" fallback from a hello sent before the name was set.
      if (useSession.getState().displayName) sendHello(false, true);
      // D2: derive the relay-auth key (if needed), then re-send hello so the
      // relay issues an auth challenge. authOk resolves authReadyP, unblocking
      // privileged sends. With nothing to prove, unblock immediately; a fallback
      // timeout unblocks anyway so a non-auth relay can't hang the app.
      const mnemonic = useSession.getState().mnemonic;
      if (!mnemonic) {
        fireAuthReady?.();
      } else {
        if (!authPublicKeySync()) void ensureAuthKey(mnemonic).then(() => sendHello());
        setTimeout(() => fireAuthReady?.(), 4000);
      }
      // re-subscribe channels after a reconnect (deferred until authed).
      const cur = get();
      if (cur.workspace) sendReady({ type: "openWorkspace", workspaceId: cur.workspace.id });
      for (const key of cur.joinedChannels) {
        const [workspaceId, channelId] = key.split("/");
        sendReady({ type: "joinChannel", workspaceId, channelId });
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
        case "authChallenge": {
          // D2: relay wants us to prove this userId. Sign its nonce once with
          // our mnemonic-derived key. Ignore duplicate/stale challenges so we
          // don't race ourselves.
          if (authState === "done" || m.nonce === lastNonceSigned) break;
          const userId = useSession.getState().userId;
          const key = authPublicKeySync();
          if (!m.nonce || !userId || !key) break;
          authState = "proving";
          lastNonceSigned = m.nonce;
          const nonce = m.nonce;
          const message = `gossip-relay-auth:v1:${userId}:${key}:${nonce}`;
          void signChallenge(message).then((signature) => {
            if (signature && ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "authProve", nonce, signature }));
            }
          });
          break;
        }
        case "authOk":
          // Identity proven; hold the session token for relay HTTP calls and
          // unblock any privileged sends waiting on the handshake.
          authState = "done";
          relaySessionToken = m.sessionToken ?? null;
          fireAuthReady?.();
          break;
        case "authError":
          // Ignore once we already hold a token (a late duplicate must not
          // clobber it). Otherwise allow a retry on the next challenge.
          if (authState === "done") break;
          if (m.code === "key_mismatch") {
            console.warn("[relay-auth] identity is bound to a different device key; this device can't prove it.");
          }
          authState = "idle";
          lastNonceSigned = null;
          relaySessionToken = null;
          break;
        case "workspace":
        case "workspaceCreated":
          // Fresh snapshot - the relay follows with callActive events for any
          // live huddles, so reset the map instead of carrying stale entries.
          if (m.workspace) {
            set({ workspace: m.workspace, activeCallByChannel: {} });
            // T4: seed unread badges from the server-side counts so unread
            // state survives reloads and follows you across devices.
            const counts: Record<string, number> = {};
            for (const ch of m.workspace.channels) {
              if (typeof ch.unread === "number") counts[ch.id] = ch.unread;
            }
            useNotifications.getState().seedChannelUnread(counts);
          }
          break;
        case "readUpdated": {
          // T4: someone's read marker moved. Feeds "seen by"; when it's MY
          // marker (another of my devices read it), sync the badge away.
          if (!m.channelId || !m.userId || !m.ts) break;
          const chId = m.channelId;
          set((st) => ({
            readsByChannel: {
              ...st.readsByChannel,
              [chId]: { ...st.readsByChannel[chId], [m.userId!]: { ts: m.ts!, messageId: m.messageId ?? "" } },
            },
          }));
          if (m.userId === useSession.getState().userId) {
            useNotifications.getState().clearChannelUnread(chId);
          }
          break;
        }
        case "channelCreated":
        case "channelUpdated": {
          // New channel, or a private channel you were invited to / whose roster changed.
          // T2-09: detect "you were just added to a private channel" before upserting.
          const myId = useSession.getState().userId;
          const wasVisible = !!get().workspace?.channels.some((c) => c.id === m.channel?.id);
          set((st) =>
            st.workspace && st.workspace.id === m.workspaceId && m.channel
              ? { workspace: { ...st.workspace, channels: [...st.workspace.channels.filter((c) => c.id !== m.channel!.id), m.channel] } }
              : st,
          );
          if (
            m.type === "channelUpdated" &&
            m.channel?.type === "private" &&
            !wasVisible &&
            myId &&
            m.channel.members?.includes(myId)
          ) {
            useNotifications.getState().notify({
              type: "membership",
              title: `#${m.channel.name}`,
              body: "You were added to a private channel",
              link: `/w/${m.workspaceId}/c/${m.channel.id}`,
            });
          }
          break;
        }
        case "channelRemoved": {
          // You were removed from a private channel: drop it, its messages, and the live sub.
          const chId = m.channelId;
          if (!chId) break;
          set((st) => {
            const joined = new Set(st.joinedChannels);
            joined.delete(`${m.workspaceId}/${chId}`);
            const msgs = { ...st.messagesByChannel };
            delete msgs[chId];
            return {
              joinedChannels: joined,
              messagesByChannel: msgs,
              workspace:
                st.workspace && st.workspace.id === m.workspaceId
                  ? { ...st.workspace, channels: st.workspace.channels.filter((c) => c.id !== chId) }
                  : st.workspace,
            };
          });
          break;
        }
        case "memberJoined":
          set((st) =>
            st.workspace && st.workspace.id === m.workspaceId && m.member
              ? { workspace: { ...st.workspace, members: [...st.workspace.members.filter((x) => x.userId !== m.member!.userId), m.member] } }
              : st,
          );
          // T2-09: membership notification (skip your own join echo).
          if (m.member && m.member.userId !== useSession.getState().userId) {
            useNotifications.getState().notify({
              type: "membership",
              title: get().workspace?.name ?? "Workspace",
              body: `${m.member.name} joined the workspace`,
              link: `/w/${m.workspaceId}/members`,
            });
          }
          break;
        case "memberLeft":
          set((st) =>
            st.workspace && st.workspace.id === m.workspaceId && m.userId
              ? { workspace: { ...st.workspace, members: st.workspace.members.filter((x) => x.userId !== m.userId) } }
              : st,
          );
          break;
        case "memberUpdated":
          // Role/permission change (T2-07): replace the member in place.
          set((st) =>
            st.workspace && st.workspace.id === m.workspaceId && m.member
              ? { workspace: { ...st.workspace, members: st.workspace.members.map((x) => (x.userId === m.member!.userId ? m.member! : x)) } }
              : st,
          );
          break;
        case "memberBanned":
          set((st) =>
            st.workspace && st.workspace.id === m.workspaceId && m.userId
              ? {
                  workspace: {
                    ...st.workspace,
                    members: st.workspace.members.filter((x) => x.userId !== m.userId),
                    bans: [...(st.workspace.bans ?? []).filter((b) => b.userId !== m.userId), ...(m.ban ? [m.ban] : [])],
                  },
                }
              : st,
          );
          break;
        case "memberUnbanned":
          set((st) =>
            st.workspace && st.workspace.id === m.workspaceId && m.userId
              ? { workspace: { ...st.workspace, bans: (st.workspace.bans ?? []).filter((b) => b.userId !== m.userId) } }
              : st,
          );
          break;
        case "workspaceDeleted": {
          // The owner deleted the workspace (T3): forget it, tell the user,
          // and get them somewhere that still exists.
          const wsId = m.workspaceId;
          if (!wsId) break;
          const wasCurrent = get().workspace?.id === wsId;
          const list = get().myWorkspaces.filter((x) => x.id !== wsId);
          saveMyWorkspaces(list);
          set((st) => ({
            myWorkspaces: list,
            workspace: st.workspace?.id === wsId ? null : st.workspace,
          }));
          if (wasCurrent) {
            useNotifications.getState().notify({
              type: "membership",
              title: m.name ? `Workspace "${m.name}"` : "Workspace",
              body: "This workspace was deleted by its owner.",
              link: "/home",
            });
            void import("@/app/router").then(({ router }) => {
              if (window.location.pathname.startsWith(`/w/${wsId}`)) void router.navigate("/home");
            });
          }
          break;
        }
        case "banned": {
          // WE got banned: the relay already kicked our subscriptions. Drop
          // the workspace locally and forget it in the switcher.
          const wsId = m.workspaceId;
          if (!wsId) break;
          const list = get().myWorkspaces.filter((x) => x.id !== wsId);
          saveMyWorkspaces(list);
          set((st) => ({
            myWorkspaces: list,
            workspace: st.workspace?.id === wsId ? null : st.workspace,
          }));
          break;
        }
        case "history":
          if (m.channelId)
            set((st) => ({
              messagesByChannel: { ...st.messagesByChannel, [m.channelId!]: m.messages ?? [] },
              // T4: everyone's read markers for this channel ride along.
              readsByChannel: { ...st.readsByChannel, [m.channelId!]: m.reads ?? {} },
            }));
          break;
        case "message":
          if (m.message) {
            const msg = m.message;
            set((st) => {
              const cur = st.messagesByChannel[msg.channelId] ?? [];
              if (cur.some((x) => x.id === msg.id)) return st;
              return { messagesByChannel: { ...st.messagesByChannel, [msg.channelId]: [...cur, msg] } };
            });
            // Their message arrived - they're no longer "typing".
            set((st) => {
              if (!st.typingByChannel[msg.channelId]?.[msg.senderId]) return st;
              const nextCh = { ...st.typingByChannel[msg.channelId] };
              delete nextCh[msg.senderId];
              return { typingByChannel: { ...st.typingByChannel, [msg.channelId]: nextCh } };
            });
            // T2-09: notify for other people's messages; mentions get their own type.
            const myId = useSession.getState().userId;
            if (msg.senderId !== myId && !msg.deleted) {
              const chName = get().workspace?.channels.find((c) => c.id === msg.channelId)?.name ?? "channel";
              const mentioned = mentionsUser(msg.body, myId);
              useNotifications.getState().notify({
                type: mentioned ? "mention" : "message",
                title: `#${chName} · ${msg.senderName}`,
                body: mentioned
                  ? `Mentioned you: ${msg.body.slice(0, 120)}`
                  : msg.body
                    ? msg.body.slice(0, 120)
                    : msg.attachment
                      ? `Sent ${msg.attachment.name}`
                      : "New message",
                link: `/w/${msg.workspaceId}/c/${msg.channelId}`,
                channelId: msg.channelId,
              });
            }
          }
          break;
        case "poked":
          // T4: someone wants your attention. The notification store applies
          // the Pokes preference and mutes, and plays the quack.
          if (m.from) {
            useNotifications.getState().notify({
              type: "poke",
              title: `${m.name || "Someone"} poked you 🦆`,
              body: "Quack. They want your attention.",
              link: `/home/dm/${encodeURIComponent(m.from)}`,
              peerId: m.from,
            });
          }
          break;
        case "messageUpdated":
          // Edit or soft-delete fan-out: replace the message in place.
          if (m.message) {
            const msg = m.message;
            set((st) => {
              const cur = st.messagesByChannel[msg.channelId];
              if (!cur?.some((x) => x.id === msg.id)) return st;
              return {
                messagesByChannel: {
                  ...st.messagesByChannel,
                  [msg.channelId]: cur.map((x) => (x.id === msg.id ? msg : x)),
                },
              };
            });
          }
          break;
        case "presence":
          if (m.channelId) set((st) => ({ presenceByChannel: { ...st.presenceByChannel, [m.channelId!]: m.count ?? 0 } }));
          break;
        case "workspacePresence": {
          // Authoritative online snapshot for this workspace's members (T3):
          // reconcile those members, leave DM-watched contacts untouched.
          const ids = Array.isArray(m.online) ? m.online : [];
          set((st) => {
            const memberIds = st.workspace && st.workspace.id === m.workspaceId ? st.workspace.members.map((x) => x.userId) : [];
            const next = new Set(st.onlineUsers);
            for (const id of memberIds) next.delete(id); // clear, then re-add the online ones
            for (const id of ids) next.add(id);
            return { onlineUsers: next };
          });
          break;
        }
        case "presenceSnapshot": {
          const ids = Array.isArray(m.online) ? m.online : [];
          set((st) => ({ onlineUsers: new Set([...st.onlineUsers, ...ids]) }));
          break;
        }
        case "userPresence": {
          if (!m.userId) break;
          set((st) => {
            const next = new Set(st.onlineUsers);
            if (m.online) next.add(m.userId!);
            else next.delete(m.userId!);
            return { onlineUsers: next };
          });
          break;
        }
        case "typing": {
          // "X is typing" (T3) - entries expire after 4s unless refreshed.
          const myId = useSession.getState().userId;
          const chId = m.channelId;
          const uid = m.userId;
          if (!chId || !uid || uid === myId) break;
          const ts = Date.now();
          set((st) => ({
            typingByChannel: {
              ...st.typingByChannel,
              [chId]: { ...st.typingByChannel[chId], [uid]: { name: m.name ?? "Someone", ts } },
            },
          }));
          setTimeout(() => {
            set((st) => {
              const cur = st.typingByChannel[chId]?.[uid];
              if (!cur || cur.ts !== ts) return st; // refreshed since - keep
              const nextCh = { ...st.typingByChannel[chId] };
              delete nextCh[uid];
              return { typingByChannel: { ...st.typingByChannel, [chId]: nextCh } };
            });
          }, 4000);
          break;
        }
        case "callActive":
          // Live huddle state (T3): drives the in-channel banner + sidebar dot.
          if (m.channelId) {
            set((st) => ({
              activeCallByChannel: {
                ...st.activeCallByChannel,
                [m.channelId!]: { count: m.count ?? 1, startedByName: m.startedByName },
              },
            }));
          }
          break;
        case "callEnded":
          if (m.channelId) {
            set((st) => {
              if (!(m.channelId! in st.activeCallByChannel)) return st;
              const next = { ...st.activeCallByChannel };
              delete next[m.channelId!];
              return { activeCallByChannel: next };
            });
          }
          break;
        case "callStarted": {
          // T2-09: relay signals a channel call starting (LiveKit token issued).
          const myId = useSession.getState().userId;
          // Call identities carry a "#suffix" (duplicate-kick fix) - compare the base handle.
          if (m.userId?.split("#")[0] === myId || !m.channelId) break;
          const chName = get().workspace?.channels.find((c) => c.id === m.channelId)?.name ?? "channel";
          useNotifications.getState().notify({
            type: "call",
            title: `#${chName}`,
            body: `${m.member?.name ?? "Someone"} started a call`,
            link: `/w/${m.workspaceId}/call/${m.channelId}`,
            channelId: m.channelId,
          });
          break;
        }
      }
    };
    ws.onclose = () => {
      set({ conn: "closed" });
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => get().connect(), 1500);
    };
    ws.onerror = () => ws?.close();
  },

  syncProfile: () => {
    // The socket may still be connecting right after unlock - retry briefly
    // so the profile announcement isn't silently dropped. profileUpdate=true
    // so the relay actually applies the (real) name/avatar.
    const attempt = (left: number) => {
      if (ws && ws.readyState === WebSocket.OPEN) sendHello(false, true);
      else if (left > 0) setTimeout(() => attempt(left - 1), 500);
    };
    attempt(10);
  },

  clearProfileAvatar: () => sendHello(true),

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

  deleteWorkspace: async (workspaceId) => {
    get().connect();
    sendHello();
    const m = await request({ type: "deleteWorkspace", workspaceId });
    if (m.type === "error") return { ok: false, error: errText(m, "Couldn't delete the workspace.") };
    const list = get().myWorkspaces.filter((x) => x.id !== workspaceId);
    saveMyWorkspaces(list);
    set((st) => ({
      myWorkspaces: list,
      workspace: st.workspace?.id === workspaceId ? null : st.workspace,
    }));
    return { ok: true };
  },

  deleteChannel: async (workspaceId, channelId) => {
    get().connect();
    sendHello();
    const m = await request({ type: "deleteChannel", workspaceId, channelId });
    if (m.type === "error") return { ok: false, error: errText(m, "Couldn't delete the channel.") };
    return { ok: true };
  },

  makeChannelPrivate: async (workspaceId, channelId, password, membership) => {
    get().connect();
    sendHello();
    const m = await request({ type: "makeChannelPrivate", workspaceId, channelId, password, membership });
    if (m.type === "error") return { ok: false, error: errText(m, "Couldn't update the channel.") };
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

  createChannel: async (workspaceId, name, type = "public", topic = "", password = "") => {
    const m = await request({ type: "createChannel", workspaceId, name, channelType: type, topic, password });
    if (m.type === "error" || !m.channel) return { ok: false, error: errText(m, "Failed to create channel") };
    return { ok: true, channel: m.channel };
  },

  joinChannelWithPassword: async (workspaceId, channelId, password) => {
    const m = await request({ type: "joinChannelPassword", workspaceId, channelId, password });
    if (m.type === "error") return { ok: false, error: errText(m, "Couldn't join the channel.") };
    return { ok: true };
  },

  joinChannel: (workspaceId, channelId) => {
    get().connect();
    set((st) => {
      const joined = new Set(st.joinedChannels);
      joined.add(`${workspaceId}/${channelId}`);
      return { joinedChannels: joined };
    });
    const trySend = () => {
      if (ws && ws.readyState === WebSocket.OPEN) sendReady({ type: "joinChannel", workspaceId, channelId });
      else setTimeout(trySend, 250);
    };
    trySend();
  },

  post: (workspaceId, channelId, body, threadRootId, attachmentId, replyToId) => {
    const text = body.trim();
    if ((!text && !attachmentId) || !ws || ws.readyState !== WebSocket.OPEN) return;
    sendReady({
      type: "post",
      workspaceId,
      channelId,
      body: text,
      threadRootId,
      attachment: attachmentId ? { id: attachmentId } : undefined,
      replyToId,
      clientMsgId: crypto.randomUUID(),
    });
  },

  sendTyping: (workspaceId, channelId) => {
    const key = `${workspaceId}/${channelId}`;
    const now = Date.now();
    if (now - (lastTypingSent.get(key) ?? 0) < 2500) return; // throttle
    lastTypingSent.set(key, now);
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendReady({ type: "typing", workspaceId, channelId });
    }
  },

  watchPresence: (userIds) => {
    get().connect();
    const send = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendHello();
        sendReady({ type: "watchPresence", userIds });
      } else setTimeout(send, 400);
    };
    send();
  },

  callEndedHint: (workspaceId, channelId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendReady({ type: "callEndedHint", workspaceId, channelId });
    }
    // Optimistic: we were the last one out - don't wait for the round-trip.
    set((st) => {
      if (!(channelId in st.activeCallByChannel)) return st;
      const next = { ...st.activeCallByChannel };
      delete next[channelId];
      return { activeCallByChannel: next };
    });
  },

  reactToMessage: (workspaceId, channelId, messageId, emoji) => {
    if (!emoji.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    sendReady({ type: "reactToMessage", workspaceId, channelId, messageId, emoji: emoji.trim() });
  },

  poke: (userId) => {
    get().connect();
    sendHello();
    sendReady({ type: "poke", userId });
  },

  markChannelRead: (workspaceId, channelId) => {
    const myId = useSession.getState().userId;
    useNotifications.getState().clearChannelUnread(channelId);
    if (!myId || !ws || ws.readyState !== WebSocket.OPEN) return;
    const msgs = get().messagesByChannel[channelId] ?? [];
    const last = msgs[msgs.length - 1];
    if (!last) return;
    // Only tell the relay when the marker actually moves forward.
    const mine = get().readsByChannel[channelId]?.[myId];
    if (mine && mine.ts >= last.ts) return;
    set((st) => ({
      readsByChannel: {
        ...st.readsByChannel,
        [channelId]: { ...st.readsByChannel[channelId], [myId]: { ts: last.ts, messageId: last.id } },
      },
    }));
    sendReady({ type: "markRead", workspaceId, channelId, ts: last.ts, messageId: last.id });
  },

  editMessage: (workspaceId, channelId, messageId, body) => {
    const text = body.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    sendReady({ type: "editMessage", workspaceId, channelId, messageId, body: text });
  },

  deleteMessage: (workspaceId, channelId, messageId) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    sendReady({ type: "deleteMessage", workspaceId, channelId, messageId });
  },

  // ── Roles & bans (T2-07) - enforced server-side at the relay ────────
  setRole: async (workspaceId, userId, role, permissions) => {
    get().connect();
    sendHello();
    const m = await request({ type: "setRole", workspaceId, userId, role, permissions });
    if (m.type === "error") return { ok: false, error: errText(m, "Couldn't change the role.") };
    return { ok: true };
  },

  banMember: async (workspaceId, userId, reason) => {
    get().connect();
    sendHello();
    const m = await request({ type: "banMember", workspaceId, userId, reason });
    if (m.type === "error") return { ok: false, error: errText(m, "Couldn't ban that member.") };
    return { ok: true };
  },

  unbanMember: async (workspaceId, userId) => {
    get().connect();
    sendHello();
    const m = await request({ type: "unbanMember", workspaceId, userId });
    if (m.type === "error") return { ok: false, error: errText(m, "Couldn't unban that member.") };
    return { ok: true };
  },

  addChannelMember: async (workspaceId, channelId, userId) => {
    get().connect();
    sendHello();
    const m = await request({ type: "addChannelMember", workspaceId, channelId, userId });
    if (m.type === "error") return { ok: false, error: errText(m, "Couldn't invite them.") };
    return { ok: true };
  },

  removeChannelMember: async (workspaceId, channelId, userId) => {
    get().connect();
    sendHello();
    const m = await request({ type: "removeChannelMember", workspaceId, channelId, userId });
    if (m.type === "error") return { ok: false, error: errText(m, "Couldn't remove them.") };
    return { ok: true };
  },
}));

if (import.meta.env.DEV) {
  (globalThis as unknown as { __relay: unknown }).__relay = useRelay;
}
