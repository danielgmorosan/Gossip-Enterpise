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

---

# Batch 2 recon (T2-00, 2026-07-14)

State since batch 1: all 16 batch-1 tasks shipped (commit d7fc7d6), DMs+DM calls moved out of the workspace into a Discord-style `/home` space (commit f6859e8): `HomeShell`/`DmSidebar`/`HomePage`, routes `/home`, `/home/dm/:dmId`, `/home/call/dm/:peerId`; DM view + composer are now the shared `Composer.tsx`/`MessageBody.tsx` stack (batch-1 §4 "two composers" is fixed).

## B2-1. Em dashes (U+2014) in `apps/web/**` + `packages/ui/**`

**COPY (rewrite in T2-01):**
- `apps/web/src/app/DmSidebar.tsx:31` "personal space — no workspace needed"
- `apps/web/src/components/CallDock.tsx:51` "in call — click to return"
- `apps/web/src/components/chat/Composer.tsx:206` "Attachments coming soon — nothing was uploaded."
- `apps/web/src/components/chat/RealDmView.tsx:172` empty-state lines; `:244` composer placeholders; `:248` attachNotice
- `apps/web/src/components/chat/NewDmDialog.tsx:41` "Your user ID — share it…"
- `apps/web/src/pages/ChannelView.tsx:135` privacy banner; `:139` empty state
- `apps/web/src/pages/SearchPage.tsx:38` privacy note
- `apps/web/src/pages/HomePage.tsx:77` contact-link blurb; `:102` "All contacts — N"
- `apps/web/src/pages/AiPage.tsx:77` placeholder; `:122` local-model blurb
- `apps/web/src/pages/settings/CallSettings.tsx:63` mic-denied; `:105` setSinkId desc; `:146` "Advanced — noise gate"
- `apps/web/src/pages/settings/AiEngineSettings.tsx:75` "isn't pulled yet — run…"; `:103` model desc separator
- `apps/web/src/pages/settings/SecuritySettings.tsx:30` "This is sealed — not configurable."
- `apps/web/src/pages/settings/ProfileSettings.tsx:114` contact-link desc; `:173` "Preview — not saved yet"; `:176` avatar desc
- `apps/web/src/pages/settings/IntegrationsSettings.tsx:48` provider note
- `apps/web/src/pages/onboarding/IdentityCreate.tsx:56` passphrase warning
- `apps/web/src/pages/onboarding/OnboardingLayout.tsx:22` tagline
- Message-attribution dashes in shareText (`RealDmView.tsx:185`, `ChannelView.tsx:206`): **KEPT intentionally** (T2-01 decision) — the em dash is standard quote-attribution typography in copied-to-clipboard text, not UI prose.

**KEEP (not user-visible or intentional):** all code comments (WorkspaceRail:76, CallDock:11, router:69, HomeShell:7, DmSidebar:13, Composer:106/153/202/205, main:16, index.css:14/200, ComposerPlusMenu:11, useCall ×4, audioProcessing:7, useAvatars ×2, useAdvancedAudio:11, useRelay ×2, MessageActionsBar ×2, MessageBody:6, avatar:6, ai:1, call:7, contact:5, CallPage ×3, openclaw:6, uploads ×2, usePendingContactRedirect:11, useStartDm:7, DMView:18, CallSettings:13/41/60, IdentityUnlock:19/22, ContactLanding:14); bare "—" placeholder values (AiEngineSettings:80, WorkspaceSettings:19/47); `data/mock.ts` chat fixtures 79–97 (NOT rendered; only `ollamaModels` + `integrations` are imported — AiEngineSettings.tsx:7, IntegrationsSettings.tsx:5; mock.ts:134 `protocol: "—"` IS rendered in Integrations, treat as placeholder); dev-only pages `pages/dev/SdkSmoke.tsx` + `pages/dev/Styleguide.tsx`; ALL `packages/ui` hits (18) are docstrings/comments (DatePicker.tsx:159 is a dev-stub label inside the styleguide-only DatePicker).
**En dash (U+2013):** one hit — `Styleguide.tsx:581` "Mar 31 – Apr 6" date range, correct usage, keep.

## B2-2. Tooltip primitive: **ABSENT**

No Tooltip anywhere in `packages/ui/src`. Icon-only buttons use native `title=`: `PaneHeader.tsx` (HeaderIconButton), `MessageActionsBar.tsx`, `CallDock.tsx` (DockBtn), `Composer.tsx` toolbar, `WorkspaceRail.tsx`. T2-02 builds one in `packages/ui/src/stack/` (export via stack index), then swaps `title=` call-sites.

## B2-3. The two code formatters

1. **Chat markdown renderer** — `apps/web/src/components/chat/MessageBody.tsx`. Hand-rolled, XSS-safe (pure React elements, no dangerouslySetInnerHTML; raw HTML renders literal). Fenced blocks → bare `<pre class="md-chip">` (`index.css:200`): **no syntax highlighting, no language label, no copy button.** Used by `ChannelView.tsx:185`, `RealDmView.tsx:224`, `ThreadPanel.tsx:42`.
2. **AI answer surfaces** — `apps/web/src/pages/AiPage.tsx:162` and `apps/web/src/components/chat/AiSidePanel.tsx:88` dump model output into `whitespace-pre-wrap` spans: markdown/fences from the model render as literal ``` text. `AiProse` (`packages/ui/src/stack/ai/AiChatMessage.tsx:127`) is typography-only.

**No highlighter installed** (no shiki/prism/highlight.js/react-syntax-highlighter in `apps/web/package.json`). T2-04 root fix: highlighted + copy-button code block inside MessageBody, and render AI answers through the same safe markdown path.

## B2-4. Routes lacking a back affordance

- `/settings/*` — `SettingsLayout.tsx:30`: "Back to workspace" always targets `myWorkspaces[0]` (not the workspace you came from) and falls back to `/welcome` (predates `/home`). Fix in T2-03: origin-aware back + `/home` fallback.
- `/w/:id/apps/:appId` (`MiniAppHost.tsx`) — no back to the `/w/:id/apps` launcher.
- `/dev/styleguide`, `/dev/sdk-smoke` — shell-less dead ends (dev-only; low priority).
- OK already: onboarding pages have Back links; `ContactLanding` has Cancel; CallPage error states have Back; in-call intentionally has none (CallDock); everything else sits in a persistent shell.

## B2-5. Channel model & where entry is gated

- Client: `RelayChannel { id, name, type: "public"|"private", topic, createdBy, createdAt }` (`stores/useRelay.ts:24`). **No membership list on channels.**
- Relay: `services/relay/server.mjs` — `addChannel` :169 (type forced to public unless "private" :174). **`joinChannel` :502 performs NO membership/visibility check** — any connected client with workspaceId+channelId receives full history + live broadcast. Private channels are cosmetic (lock icon, `ChannelSidebar.tsx:144`).
- **No Drizzle DB in apps/web** (no `src/db/`). Channel data = relay JSON persistence + Zustand. For T2-07/T2-08 "additive migrations" = additive relay data-model fields + client store fields.

## B2-6. Workspace roles today

- Relay member: `{ userId, name, role, joinedAt }` — creator "owner" (`server.mjs:424`), joiners "member" (:445, :465). Client type declares `"owner"|"admin"|"member"|"guest"` (`useRelay.ts:35`) but relay only ever assigns owner/member.
- **Single enforcement point:** channel-message delete/edit-others gate `isAdmin = role === "owner" || role === "admin"` (`server.mjs:570-571`). No ban table, no promotion API, no granular permissions, no role-management UI (`MembersPage.tsx` displays role text only).

## B2-7. @mention handling: **NONE**

No mention parsing/rendering anywhere (`mock.ts:22 mentions?: number` is dead mock data). Autocomplete member sources exist: workspace members via `useRelay((s) => s.workspace?.members)` (RelayMember[]), DM contacts via `useContacts`. Composer is shared (`Composer.tsx`) so one trigger implementation covers DM + channel; MessageBody needs a mention token renderer (T2-05).

## B2-8. Notification infra: **none beyond transient toasts**

- `StackToast` (`packages/ui/src/stack/settings/`) used for one-off notices: `ChannelView.tsx:240`, `Composer.tsx:216`. No store, no unread counts (NavBadge renders static strings), no notification center; `NotificationsSettings.tsx` is an honest "not available yet" placeholder.
- **Event sources for T2-09:** relay WS pushes `message`, `messageUpdated`, `channelCreated`, `memberJoined` (`server.mjs:451,467`), `memberLeft` (:482), `presence` — all flow through `useRelay`'s socket handler. SDK events: `MESSAGE_RECEIVED/SENT/UPDATED/DELETED/ACKNOWLEDGED`, `SESSION_CREATED`, `SESSION_REQUESTED`, `CONTACT_DELETED` (see `useContacts.ts:50-59`, `RealDmView.tsx:78-87`). **No call-start signal exists** — LiveKit rooms are join-only; a "call started" relay broadcast would be new surface area.

## B2-9. Call UI

- **Stack: LiveKit** (batch-1 §1 unchanged). Batch-1 T-07 (restyle) and T-14 (persistent call: `stores/useCall.ts` + `components/CallDock.tsx`) both ran — per RALPH.md checkboxes + PROGRESS.md. Guardrail #3 → T2-06 = **layout/tile-sizing, dark-mode control styling, in-call chat**; don't undo T-07.
- Call surface `pages/CallPage.tsx` renders LiveKit's prefab `<VideoConference />` (:176) under `data-lk-theme="default"` — tile layout and the white-on-dark control styling come from `@livekit/components-styles`, not our tokens. **No text-chat panel in the call view.** T2-06 path: replace `VideoConference` with composed LiveKit primitives (GridLayout/ParticipantTile/ControlBar or custom buttons bound to `useCall`), style with Stack tokens, add a chat panel reusing `Composer` + message list.
- Routes: channel `/w/:workspaceId/call/:channelId`; DM `/home/call/dm/:peerId`. Audio prefs already exist: `stores/useAudioSettings.ts`, `stores/useAdvancedAudio.ts`, `lib/audioProcessing.ts` (noise gate).
