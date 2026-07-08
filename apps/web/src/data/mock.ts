/* Mock data for the Gossip Workspace UI pass. All client-side, no network. */

export type Role = "owner" | "admin" | "member" | "guest";
export type Presence = "online" | "away" | "offline" | "dnd";

export interface Member {
  id: string;
  displayName: string;
  handle: string; // pseudonymous gossip identity
  role: Role;
  presence: Presence;
  title?: string;
  isAi?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  type: "public" | "private" | "dm_group";
  topic?: string;
  unread?: number;
  mentions?: number;
  muted?: boolean;
  aiMember?: boolean;
  memberIds: string[];
}

export interface DM {
  id: string;
  memberId: string;
  unread?: number;
  lastPreview?: string;
}

export interface Message {
  id: string;
  authorId: string;
  body: string;
  ts: string; // HH:MM
  reactions?: { emoji: string; count: number; mine?: boolean }[];
  replyCount?: number;
  edited?: boolean;
  system?: boolean;
}

export const me: Member = {
  id: "u_me",
  displayName: "You",
  handle: "gossip34ngsdf9nq2k7vx8mp1l8dhuj",
  role: "owner",
  presence: "online",
  title: "Founder",
};

export const members: Member[] = [
  me,
  { id: "u_kev", displayName: "Kevin Cero", handle: "gossipk3v9rq2x7mz1p4w8nl0dhqz", role: "admin", presence: "online", title: "Eng Lead" },
  { id: "u_seb", displayName: "Sébastien Forestier", handle: "gossipseb7x2q9mz4p1w8nl3dhrk", role: "member", presence: "online", title: "Robotics" },
  { id: "u_mara", displayName: "Mara Holt", handle: "gossipm4r8q1z7x9p2w5nl6dhtv", role: "member", presence: "away", title: "Design" },
  { id: "u_jun", displayName: "Jun Park", handle: "gossipj9n2q7z4x1p8w3nl5dhwb", role: "member", presence: "dnd", title: "Growth" },
  { id: "u_ada", displayName: "Ada Núñez", handle: "gossipad4q8z2x7p1w9nl4dhxc", role: "guest", presence: "offline", title: "Counsel (ext.)" },
  { id: "u_oc", displayName: "Gossip AI", handle: "gossip-ai-bot-local-7f2a", role: "member", presence: "online", isAi: true, title: "AI assistant" },
];

export const memberById = (id: string) => members.find((m) => m.id === id) ?? me;

export const channels: Channel[] = [
  { id: "c_general", name: "general", type: "public", topic: "Company-wide announcements and chatter.", memberIds: members.map((m) => m.id) },
  { id: "c_eng", name: "engineering", type: "public", topic: "Protocol, relay, and client work.", unread: 3, aiMember: true, memberIds: ["u_me", "u_kev", "u_seb", "u_oc"] },
  { id: "c_design", name: "design", type: "public", topic: "Gossip Workspace product design.", unread: 12, mentions: 1, aiMember: true, memberIds: ["u_me", "u_mara", "u_kev", "u_oc"] },
  { id: "c_marketing", name: "marketing-launch", type: "public", topic: "Go-to-market for the enterprise pivot.", aiMember: true, memberIds: ["u_me", "u_jun", "u_mara", "u_oc"] },
  { id: "c_sec", name: "security", type: "private", topic: "Crypto boundary + audits. Invite only.", muted: true, memberIds: ["u_me", "u_kev"] },
  { id: "c_legal", name: "legal-ext", type: "private", topic: "External counsel room.", memberIds: ["u_me", "u_ada"] },
];

export const channelById = (id: string) => channels.find((c) => c.id === id) ?? channels[0];

export const dms: DM[] = [
  { id: "dm_kev", memberId: "u_kev", lastPreview: "Pushed the relay seam — take a look", unread: 2 },
  { id: "dm_mara", memberId: "u_mara", lastPreview: "Mint on the outgoing bubbles is 🔥" },
  { id: "dm_seb", memberId: "u_seb", lastPreview: "Robot demo recording is up" },
  { id: "dm_ada", memberId: "u_ada", lastPreview: "Reviewed the DPA, two notes" },
];

export const messagesByChannel: Record<string, Message[]> = {
  c_design: [
    { id: "m1", authorId: "u_mara", body: "Locked the dark theme tokens — near-black canvas with the mint accent reads really premium.", ts: "09:02", reactions: [{ emoji: "🔥", count: 4, mine: true }] },
    { id: "m2", authorId: "u_kev", body: "Agreed. Can we keep the monospace for the identity handle? It sells the crypto story.", ts: "09:05" },
    { id: "m3", authorId: "u_mara", body: "Yes — handles, key fingerprints, and the AI route badge all go mono.", ts: "09:06", replyCount: 3 },
    { id: "m4", authorId: "u_me", body: "Love it. One ask: make the channel-vs-DM privacy difference obvious in the header. Channels are workspace-confidential, DMs are E2E.", ts: "09:11" },
    { id: "m5", authorId: "u_mara", body: "On it. DM headers get the mint shield, channels get a neutral lock with a tooltip explaining the v1 tradeoff.", ts: "09:13", reactions: [{ emoji: "✅", count: 2 }, { emoji: "🛡️", count: 1 }] },
    { id: "m6", authorId: "u_oc", body: "Recap of this thread: the team aligned on (1) dark + mint as the default theme, (2) monospace for all cryptographic identity, and (3) a clear header treatment distinguishing E2E DMs from workspace-confidential channels. Action: Mara to ship header variants.", ts: "09:15", system: false },
  ],
  c_eng: [
    { id: "e1", authorId: "u_kev", body: "Relay seam is in. `services/relay` is optional — defaults to api.usegossip.com but a workspace can point at a self-hosted URL.", ts: "11:20" },
    { id: "e2", authorId: "u_seb", body: "Nice. Does that touch the DM path at all?", ts: "11:22" },
    { id: "e3", authorId: "u_kev", body: "No — DMs stay on the gossip-sdk E2E channel verbatim. The relay only carries channel transport.", ts: "11:23", reactions: [{ emoji: "🔒", count: 3 }] },
  ],
  c_general: [
    { id: "g1", authorId: "u_jun", body: "Welcome Ada from external counsel 👋 added to #legal-ext only.", ts: "08:30" },
    { id: "g2", authorId: "u_me", body: "Reminder: the AI assistant only reads channels it's explicitly added to. It never sees DMs. That's the whole pitch.", ts: "08:41", reactions: [{ emoji: "🙌", count: 5 }] },
  ],
};

export const aiConversation: { role: "user" | "assistant"; body: string; route?: "local" | "cloud" }[] = [
  { role: "user", body: "Recap what #marketing-launch shipped this week." },
  {
    role: "assistant",
    route: "local",
    body: "Here's what #marketing-launch moved this week (scoped to channels you can access):\n\n• **Positioning** finalized: \"Slack where messages are actually private and the AI runs on your own hardware.\"\n• **Landing page** draft handed to design; hero leads with the self-hosted AI engine.\n• **Launch date** tentatively set pending the relay self-host doc.\n\nAction items: Jun to confirm the date, Mara to deliver hero variants.",
  },
];

export interface IntegrationDef {
  id: string;
  name: string;
  kind: "mail" | "calendar" | "notes" | "files" | "calls";
  protocol: string;
  blurb: string;
  privacy: "self-hosted" | "standards" | "bridge" | "e2e";
  status: "connected" | "available" | "desktop-only" | "unavailable";
  note?: string;
}

export const integrations: IntegrationDef[] = [
  { id: "livekit", name: "LiveKit", kind: "calls", protocol: "WebRTC · self-host", blurb: "Open-source calls with an AI-agent hook for the notetaker.", privacy: "self-hosted", status: "connected", note: "AI notetaker enabled" },
  { id: "jitsi", name: "Jitsi Meet", kind: "calls", protocol: "IFrame API", blurb: "Lighter embeddable huddles. Fastest click-to-call.", privacy: "self-hosted", status: "available" },
  { id: "nextcloud", name: "Nextcloud", kind: "files", protocol: "WebDAV · OCS · CalDAV", blurb: "All-rounder: files, calendar, contacts, and Talk in one.", privacy: "self-hosted", status: "connected" },
  { id: "seafile", name: "Seafile", kind: "files", protocol: "API · per-library E2E", blurb: "Strongest E2E of the self-hosted file set.", privacy: "e2e", status: "available" },
  { id: "storj", name: "Storj", kind: "files", protocol: "S3-compatible", blurb: "Decentralized, E2E-encrypted object storage. On-brand with Massa.", privacy: "e2e", status: "available" },
  { id: "fastmail", name: "Fastmail", kind: "mail", protocol: "JMAP · IMAP · SMTP", blurb: "Reference mail integration. Privacy-respecting, not zero-knowledge.", privacy: "standards", status: "connected", note: "JMAP token" },
  { id: "mailbox", name: "mailbox.org", kind: "mail", protocol: "IMAP · CalDAV", blurb: "EU standards-based mail + calendar.", privacy: "standards", status: "available" },
  { id: "proton", name: "Proton Mail", kind: "mail", protocol: "Bridge → IMAP/SMTP", blurb: "Via Proton Bridge. Desktop only; Calendar has no API.", privacy: "bridge", status: "desktop-only" },
  { id: "tuta", name: "Tuta", kind: "mail", protocol: "—", blurb: "Fully E2E but exposes no third-party API. Not integrable today.", privacy: "e2e", status: "unavailable" },
  { id: "caldav", name: "CalDAV / CardDAV", kind: "calendar", protocol: "RFC 4791 / 6352", blurb: "Universal calendar + contacts. Works with Fastmail, Nextcloud, Radicale.", privacy: "standards", status: "connected" },
  { id: "standardnotes", name: "Standard Notes", kind: "notes", protocol: "E2E · API", blurb: "End-to-end encrypted notes with an embeddable client.", privacy: "e2e", status: "available" },
  { id: "cryptpad", name: "CryptPad", kind: "notes", protocol: "E2E · embed", blurb: "Zero-knowledge collaborative docs.", privacy: "e2e", status: "available" },
];

export const ollamaModels = [
  { id: "qwen2.5:7b", name: "Qwen 2.5 7B", tier: "Light", ram: "8 GB RAM", ctx: "32k ctx", desc: "Fast, runs on most laptops." },
  { id: "qwen2.5:14b", name: "Qwen 2.5 14B", tier: "Balanced", ram: "16 GB RAM", ctx: "64k ctx", desc: "Recommended for agent workflows.", recommended: true },
  { id: "llama3.3:70b", name: "Llama 3.3 70B", tier: "Capable", ram: "48 GB VRAM", ctx: "128k ctx", desc: "For workstations / GPU servers." },
];
