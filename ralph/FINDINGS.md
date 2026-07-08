# FINDINGS.md — T-00 recon (2026-07-08)

Answers to every T-00 bullet, with real paths. Repo root: `Gossip-Enterpise/`.

## 1. Call stack: **LiveKit** (not Jitsi, not stub)

- `apps/web/package.json` deps: `"@livekit/components-react": "^2"`, `"@livekit/components-styles": "^1"`, `"livekit-client": "^2"`. Relay side has `livekit-server-sdk` (pnpm-lock.yaml).
- Call component: `apps/web/src/pages/CallPage.tsx` — uses `<LiveKitRoom>` + `<VideoConference>` from `@livekit/components-react` with `data-lk-theme="default"` (default LiveKit theme, i.e. NOT yet on-brand — relevant to T-07).
- Route: `apps/web/src/app/router.tsx:66` → `{ path: "call/:channelId", element: <CallPage /> }` under `/w/:workspaceId`.
- Token flow: `CallPage` fetches `relayUrl("/livekit-config")` then POSTs `relayUrl("/livekit-token")`; Vite proxies both to `http://localhost:8788` (`apps/web/vite.config.ts:67-69`, comment: "LiveKit token (signed server-side) + config, served by the relay"). Room name is `` `${workspaceId}:${channelId}` `` (opaque ids — good precedent for T-08).
- Dev helper: `apps/web/src/lib/devLivekit.ts` (imported in `main.tsx`).
- **Consequence:** T-07 (restyle), T-08 (DM calls), T-12 (audio settings), T-14 (persistent call), T-15 (advanced audio) all take the **LiveKit path** — none are stack-blocked.

## 2. vendor/gossip: **present**; gossip-sdk message-mutation API: **EXISTS**

- `vendor/gossip/` is a full checkout (gossip-sdk, src, android/ios, patches…). The web app depends on `"@massalabs/gossip-sdk": "workspace:*"`.
- `vendor/gossip/gossip-sdk/src/services/message.ts` (MessageService) exports:
  - `editMessage(id: number, newContent: string): Promise<boolean>` (line ~1881; internal `performEditMessage` ~1813)
  - `deleteMessage(id: number): Promise<boolean>` (line ~1748; internal `PerformDeleteMessage` ~1595)
  - `sendReaction(...)` (~1794) and `getReactions(contactUserId)` (~1548)
  - `getVisibleMessages(contactUserId)` (~1539), `sendText(...)` (~1570), `send(...)` (~1557), `markAsRead(id)` (~1962)
- Schema support (`vendor/gossip/gossip-sdk/src/db/schema/messages.ts`): columns `editOf`, `deleteOf`, `reactionOf`, `replyTo`, `forwardOf` — edit/delete/reactions are first-class in the protocol.
- **Attachments: ABSENT.** No attachment/upload/blob/media API in `services/message.ts` or the SDK index; `content` is a `text` column. → T-13's DM sub-part is blocked; channel attachments must go via the relay.
- **Consequence:** T-10 (DM edit/delete) is **NOT blocked** — implement via `gossipSdk.messages.editMessage/deleteMessage`. T-13 DM attachments **is** blocked.

## 3. DM data source: **real gossip-sdk** (not mock)

- Wiring: `apps/web/src/lib/sdk.ts` — `gossipSdk.init(...)` with `protocolBaseUrl` (dev: Vite proxy `/gossip-relay`; prod: `VITE_GOSSIP_API_URL` → `https://api.usegossip.com/api`), `openSession({ mnemonic })`, auto-accept of `SESSION_REQUESTED`. Storage is **in-memory** (session lives for app lifetime — noted in file header).
- DM view: `apps/web/src/pages/DMView.tsx` routes `dm_self` → `<RealDmView peerId="self">` (selfMessages) and `gossip1…` ids → `<RealDmView peerId={dmId}>`; unknown ids show an empty state ("no mock content").
- `apps/web/src/components/chat/RealDmView.tsx` reads via `gossipSdk.messages.getVisibleMessages(peerId)` / `gossipSdk.selfMessages.getMessages()`, sends via `sendText`/`selfMessages.send`, subscribes to SDK events.
- `apps/web/src/data/mock.ts` is only used by `pages/settings/AiEngineSettings.tsx` and `pages/settings/IntegrationsSettings.tsx` (settings fixtures, not messaging).
- Channels: real relay-backed via `apps/web/src/stores/useRelay.ts` (WebSocket `relayWsUrl`, `post(workspaceId, channelId, text)`).

## 4. Message composer: **two separate composers — NOT shared**

- Channel composer: `apps/web/src/components/chat/Composer.tsx` (textarea + E2E/workspace-confidential pill + send button). Used **only** by `apps/web/src/pages/ChannelView.tsx:175`.
- DM composer: **inline** in `apps/web/src/components/chat/RealDmView.tsx` (~lines 163–183) — a bare `<input>` + send button, built separately.
- Thread reply composer: `apps/web/src/components/chat/ThreadPanel.tsx` (own input as well).
- **Consequence for T-01/T-02/T-03:** "add to the shared composer" actually means either (a) adopting `Composer.tsx` in `RealDmView` first, or (b) adding the feature to both. Cleanest: extend `Composer.tsx` and swap it into `RealDmView` (keeping its send semantics), then both surfaces share one component.

## 5. App shell / sidebar / providers

- Shell: `apps/web/src/app/AppShell.tsx` (layout with `WorkspaceRail` + `ChannelSidebar` + `<Outlet/>`); sidebar: `apps/web/src/app/ChannelSidebar.tsx`; far-left rail: `apps/web/src/app/WorkspaceRail.tsx`. A persistent CallDock (T-14) would live in `AppShell`/`ChannelSidebar`.
- Providers/entry: `apps/web/src/main.tsx` — **no provider tree**; just `RouterProvider` in `StrictMode` plus `useSession.getState().warmup()`. Router: `apps/web/src/app/router.tsx`. A top-level call provider (T-14) would wrap `RouterProvider` here or in `router.tsx`'s root element.

## 6. Design tokens & styleguide

- **Active design system: "Stack"** — `packages/ui/src/stack/tokens.css`, namespaced `--st-*`. It is **light-first, pure-neutral monochrome** (white paper / near-black ink / gray hairlines; green `--st-positive` + red `--st-negative` semantics only). Has a `.dark` block (dark paper `#0a0a0a` etc.). Components: `packages/ui/src/stack/` (Button, Input, workspace/* incl. WorkspaceLayout, Avatar, Modal, ContextMenu…), exported as `@gossip/ui/stack`.
- **Legacy theme** ("encrypted calm", dark + mint `--accent: #7fe9c3`) lives in `apps/web/src/index.css` and legacy `packages/ui/src/*` (Avatar.tsx, Button.tsx…). The RALPH.md brief says "dark + mint", but the app's current shell + styleguide are Stack (monochrome). **Follow the Stack system for new UI** (per the user's directive to respect http://localhost:5173/dev/styleguide); use mint only where legacy surfaces already do.
- Styleguide route source: `apps/web/src/pages/dev/Styleguide.tsx`, mounted at `/dev/styleguide` (`router.tsx:41-42`).

## 7. Avatar rendering today

- Stack avatar: `packages/ui/src/stack/workspace/Avatar.tsx` — initials on a flat `colorForId(id)` background (deterministic hash color), sizes sm/md. Exported from `@gossip/ui/stack`.
- Legacy avatar: `packages/ui/src/Avatar.tsx` — initials + gradient + presence dot, uses legacy `var(--accent)`.
- Used in `RealDmView` (peer avatar), sidebar, members page. **No image/avatar-upload support anywhere; purely initials.** T-05 replaces/extends this.

## 8. Zustand stores (`apps/web/src/stores/`)

- `useSession.ts` — `SessionState`: userId, displayName, session lifecycle (`warmup()`, unlock).
- `useRelay.ts` — workspace/channel state over relay WS: `ChannelMsg {id, workspaceId, channelId, senderId, senderName, body, ts, threadRootId?}`, `RelayChannel {id,name,type:"public"|"private",topic,createdBy,createdAt}`, `RelayMember {userId,name,role,joinedAt}`, `RelayWorkspace`; actions incl. `post(...)`.
- `useContacts.ts` — `ContactsState`: SDK contacts list (`{userId, name}`), used by DMView for names.
- `useTheme.ts` — persisted theme state (light/dark).
- No call store yet (T-14 will add one).

## 9. Corrections to RALPH.md §4 assumptions

- Repo is **beyond** "Phase 0–1 mock data": DMs are real (SDK wired), channels are real (relay WS), LiveKit calls work behind a relay token endpoint.
- `vendor/gossip` **is** vendored and wired; edit/delete/reactions exist in the SDK. Only **attachments** are absent from the DM path.
- Brand is Stack monochrome (see §6), not "dark + mint" — style new UI to `/dev/styleguide`.
