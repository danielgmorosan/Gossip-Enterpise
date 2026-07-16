# Gossip Workspace — Project Spec

> **Codename:** Gossip Workspace (placeholder — swap freely).
> **One-liner:** A decentralized, privacy-first competitor to Slack, built on Gossip's
> end-to-end-encrypted messaging stack, with privacy-focused mini-app integrations and a
> self-hosted AI assistant (OpenClaw) that can run on a local model.

This is the working product spec. Read the **Working Agreement** section before writing any code.
The build is sequenced into phases at the bottom — do **not** try to build everything at once.

---

## 1. What we're building and why

Gossip today is a consumer 1:1 messenger: pseudonymous identity (passphrase, no PII), end-to-end
encryption by default, ephemeral per-message keys (forward secrecy), post-quantum crypto, and
encrypted metadata, all running on the Massa network with no central server and the app itself
hostable on-chain via DeWeb.

We are pivoting that technology into an **enterprise team-collaboration product** — think Slack, but:

- **DMs are truly private** (reuse Gossip's existing E2E 1:1 channel verbatim).
- **Channels (group chats) just need to work** for now — privacy on groups is a later upgrade,
  not a v1 blocker.
- **Mini-apps** are docked into the workspace and chosen for privacy (mail, calendar, notes,
  files, calls) rather than convenience.
- **An AI assistant** ("OpenClaw") lives in the workspace for meeting notes and chat recaps,
  and can run **entirely on a local open-source model** so sensitive reasoning never leaves the
  org's machines. Cloud (Claude API) is available as an optional, higher-quality route.

**The sales pitch / differentiation:** "Slack where the messages are actually private, the AI runs
on your own hardware, and there is no vendor server that can be subpoenaed, breached, or shut off."
The enterprise levers are: self-hostable message relay, self-hosted AI, on-chain/DeWeb resilience,
and integrations with privacy-respecting tools instead of Google/Microsoft.

---

## 2. Tech stack

### 2.1 Inherited from Gossip (do not re-invent)
- **Frontend:** React 19 + TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Local DB:** SQLite via `wa-sqlite` + **Drizzle ORM** (data stays on device)
- **PWA:** Vite PWA plugin
- **Blockchain / identity:** Massa Web3 SDK
- **Crypto / protocol:** Rust → WASM (post-quantum E2E, ephemeral keys). Built with a Rust + zig
  toolchain; `npm run wasm:build` outputs to `gossip-sdk/src/assets/generated/wasm`.
- **Native shell:** Capacitor (iOS + Android), app id `net.massa.gossip`.

### 2.2 Added for the enterprise pivot
- **Routing:** React Router (multi-pane workspace shell).
- **Desktop shell:** **Tauri** (preferred) or Electron — needed so we can run a local AI engine
  and the Proton Bridge in "a few clicks". Capacitor stays for mobile. (Pure PWA can't spawn
  local processes — see §6.4.)
- **AI gateway:** **OpenClaw** (self-hosted assistant gateway) running as a sidecar service.
- **Local inference:** **Ollama** (local + optional cloud), driven by OpenClaw's model providers.
- **Transcription (call notes):** `whisper.cpp` / faster-whisper locally; cloud STT optional.
- **Calls/meetings:** **LiveKit** (open-source, Apache-2.0, self-hostable, E2E, AI-agent framework)
  as primary; **Jitsi Meet** as the lighter embeddable alternative. See §7.
- **Integrations (privacy mini-apps):** built against open standards — **JMAP/IMAP/SMTP** (mail),
  **CalDAV/CardDAV** (calendar/contacts), **WebDAV** + **S3** (files) — plus self-hostable apps
  (Nextcloud, Seafile, Storj). See §8.
- **Mini-app sandbox:** sandboxed `<iframe>` + a small postMessage RPC bridge (Slack-style apps).
- **Monorepo tooling:** pnpm workspaces + Turborepo.

---

## 3. Repository structure

We build a **new app** that *depends on Gossip's `gossip-sdk` package* rather than forking the
whole consumer app. Pull the Gossip repo as a git submodule pinned to `dev` and consume the SDK
as a workspace package.

```
gossip-workspace/
├── docs/SPEC.md                    # this file
├── pnpm-workspace.yaml
├── turbo.json
├── vendor/
│   └── gossip/                     # git submodule: github.com/massalabs/gossip @ dev
│                                   # we consume vendor/gossip/gossip-sdk as a workspace pkg
├── apps/
│   ├── web/                        # the workspace frontend (primary work area)
│   │   ├── src/
│   │   │   ├── main.tsx            # configureSdk(...) + setProtocolBaseUrl(...) at startup
│   │   │   ├── app/                # router, layout shell, providers
│   │   │   ├── pages/              # route-level screens (see §8)
│   │   │   ├── features/           # messaging, channels, ai, miniapps, calls, admin
│   │   │   ├── components/         # shared UI (design system)
│   │   │   ├── stores/             # Zustand stores (adapters injected into the SDK)
│   │   │   ├── db/                 # Drizzle schema + wa-sqlite setup (extends Gossip schema)
│   │   │   └── lib/                # sdk wiring, openclaw client, miniapp bridge
│   │   └── vite.config.ts
│   └── desktop/                    # Tauri shell wrapping apps/web + local-engine helpers
├── packages/
│   ├── ui/                         # shared Tailwind component library / design tokens
│   ├── openclaw-bridge/            # typed client + adapters for the OpenClaw gateway
│   ├── miniapp-sdk/                # host<->miniapp postMessage contract + helpers
│   └── config/                     # shared eslint/ts/tailwind config
└── services/
    ├── openclaw/                   # OpenClaw gateway config, gossip channel plugin, model routing
    └── relay/                      # OPTIONAL self-hosted message-transfer relay (enterprise)
```

> **Why submodule, not copy:** the `gossip-sdk` is *not* published to npm — it's a workspace
> package inside the gossip monorepo. Submodule lets us track upstream crypto/protocol fixes
> without re-vendoring. Pin to a commit and bump deliberately.

---

## 4. Architecture at a glance

```
            ┌────────────────────────── apps/web (React 19 + Vite) ──────────────────────────┐
            │  Workspace shell: sidebar (workspaces, channels, DMs) | main pane | miniapp dock │
            │                                                                                  │
   DMs ─────┼──> gossip-sdk (configureSdk + WASM crypto) ──E2E──> message-transfer protocol     │
            │        ▲ adapters: Zustand stores, Drizzle/wa-sqlite db, prefs, notifications     │
   Channels ┼──> channel service ──> relay (api.usegossip.com OR self-hosted services/relay)    │
            │                                                                                  │
   AI ──────┼──> openclaw-bridge ──HTTP/WS──> OpenClaw Gateway (services/openclaw)              │
            │                                     ├── gossip channel plugin (reads channels)     │
            │                                     ├── model provider: Ollama (local)  ◀─ default │
            │                                     └── model provider: Anthropic (Claude) ◀ cloud │
   Mini ────┼──> miniapp-sdk (sandboxed iframe + postMessage) ──> Mail / Calendar / Notes / ... │
            └──────────────────────────────────────────────────────────────────────────────────┘
                              Identity & resilience: Massa Web3 + DeWeb hosting
```

**Hard privacy boundary (memorize this):**
- **DMs** are E2E encrypted; *no server and no AI* can read them.
- **Channels** are shared workspace data; the **AI bot is a workspace member with its own Gossip
  identity** and can only read channels it has been explicitly added to. **The AI never has access
  to DMs.** Recaps and notes operate only on channel content the requesting user can already see.

---

## 5. Messaging layer

### 5.1 Direct messages (1:1) — reuse Gossip as-is
- Use `gossip-sdk` directly. At startup in `apps/web/src/main.tsx`, call `configureSdk(...)` to
  inject our runtime adapters (Zustand stores, the Drizzle/wa-sqlite db, a preferences adapter,
  and a notification handler), then `setProtocolBaseUrl(...)`.
- Identity = passphrase-derived Gossip identity (no PII). On desktop/mobile, gate unlock with
  Capacitor biometric auth where available.
- Do **not** modify the crypto or the WASM bindings. Treat E2E DMs as a solved, sealed component.

### 5.2 Channels (group chat) — new, "just works" for v1
The Gossip SDK does **not** ship group messaging yet (it's on their roadmap), so we build channels
ourselves:
- **v1 (acceptable to be non-E2E):** channels are rooms backed by the message-transfer relay.
  Messages are persisted to the local Drizzle DB and fanned out via the relay. Transport is TLS;
  treat channel contents as "workspace-confidential", not "E2E-private". This is the explicitly
  accepted tradeoff.
- **Privacy upgrade path (later phase, do not block v1):** per-member key fan-out using the
  existing 1:1 E2E primitive for small channels, then migrate to **MLS (Messaging Layer Security,
  RFC 9420)** for scalable group E2E. Leave a clean seam for this in the channel service.
- Channel types: public (any workspace member can join), private (invite-only), and DM-group
  (small E2E group via fan-out, optional later).

### 5.3 Self-hosted relay (enterprise lever)
`VITE_GOSSIP_API_URL` defaults to `https://api.usegossip.com`. For enterprise customers, allow
pointing this at a self-hosted relay (`services/relay`) so the org controls message transport.
E2E for DMs is unaffected by where the relay lives; this is purely about who runs the transport
and channel store. Make the base URL a per-workspace setting.

---

## 6. AI layer — OpenClaw

OpenClaw is a self-hosted assistant gateway with a plugin/channel architecture and pluggable model
providers (it can target a local Ollama server **or** a cloud provider like Anthropic). There is an
existing `massalabs/openclaw-gossip-plugin` — use it (or model our channel plugin on it) so OpenClaw
can read/write Gossip channels.

### 6.1 What the assistant does (v1 features)
1. **Chat recaps** — e.g. "what has the marketing team shipped this week?" → OpenClaw reads the
   channels the requester can access (filtered to `#marketing-*`), summarizes, replies in-thread.
2. **Meeting notes** — during a call (§7), capture audio → transcribe → OpenClaw produces notes +
   action items → posts to the linked channel.
3. **Ad-hoc Q&A / search-over-channels** — "find the decision we made about pricing".

### 6.2 Deployment model
- OpenClaw runs as a sidecar **per workspace** (or per self-hosted deployment), configured in
  `services/openclaw`. The frontend talks to it through `packages/openclaw-bridge` (typed
  HTTP/WS client). Never embed model API keys in the frontend bundle — keys live in the gateway.
- The bot authenticates to the workspace as a normal member with its own Gossip identity and is
  added to channels explicitly (this is what enforces the DM boundary in §4).

### 6.3 Model routing — Claude now, local for privacy
OpenClaw supports multi-model routing. Configure two routes:
- **default → local Ollama** (`baseUrl: http://127.0.0.1:11434`, native API — **not** the `/v1`
  OpenAI-compat path, which breaks tool calling).
- **complex/fallback → Anthropic Claude** (API key in the gateway, opt-in per workspace).

This gives the user's requested choice: "Claude API for now, or local model for private reasoning."
Privacy-sensitive recaps can be pinned to the local route; the cloud route is opt-in.

### 6.4 "Run a local model in a few clicks" (the AI Engine page)
This is a flagship UX. It requires the **desktop (Tauri) build** — a pure web PWA cannot install or
launch local processes, so on web we show setup instructions instead. On desktop:
1. **Detect** a running Ollama at `127.0.0.1:11434`.
2. If absent, **one-click install** Ollama (bundled installer or scripted download via Tauri).
3. **Pick a model** from a curated list with RAM/VRAM hints, e.g.
   `qwen2.5:7b` (light), `qwen2.5:14b` / `llama3.x` (balanced), larger for capable GPUs.
   Recommend **≥64k context** for agent workflows.
4. **Pull** the model with a live progress bar.
5. **Flip OpenClaw** to use the local provider as `default` (write the model-routing config and
   restart the gateway).
6. Optionally **enter a Claude API key** to enable the cloud `complex` route.

Transcription for call notes should likewise prefer a **local** engine (`whisper.cpp`) so audio
never leaves the machine.

---

## 7. Calls / huddles
- **Primary: LiveKit.** Open-source (Apache-2.0) WebRTC infrastructure you can **self-host for
  free** or run on LiveKit Cloud, with client/server SDKs, end-to-end encryption, and webhooks.
  Crucially, its **Agents framework lets an AI participant join a room** — this is the cleanest way
  to wire the OpenClaw notetaker directly into a call instead of scraping audio out-of-band.
- **Lighter alternative: Jitsi Meet** — open-source and self-hostable, embeddable via its IFrame
  API. Fastest path to a "click-to-huddle" with minimal frontend code. Good default if you don't
  need the LiveKit agent pipeline yet.
- **If already running Nextcloud:** Nextcloud Talk is essentially free calls in that stack.
- A call is tied to a channel. Optional **AI notetaker** toggle: capture audio (or attach a LiveKit
  agent) → local transcription (`whisper.cpp`) → OpenClaw summary + action items posted to the
  channel. Recording/transcription must be explicitly consented and visible to all participants.

---

## 8. Mini-apps framework + first integrations

### 8.1 Framework
- Mini-apps load in a **sandboxed iframe** and talk to the host via a typed `postMessage` RPC
  contract in `packages/miniapp-sdk` (identity handoff, channel context, "share to channel",
  notifications). Treat every mini-app as untrusted; least-privilege by default.
- A **mini-app dock** in the shell launches them; each is enabled per workspace in Integrations.

### 8.2 The privacy-vs-integrability tradeoff (design principle)
The most private tools (zero-knowledge E2E like Proton and Tuta) are closed precisely *because* of
that encryption — Tuta supports no third-party clients at all, and Proton is Bridge-only. The tools
that integrate cleanly are either **standards-based** (JMAP/IMAP, CalDAV/CardDAV, WebDAV, S3) or
**open-source and self-hostable**. For an enterprise privacy product the sweet spot is
**self-hostable open source**: the customer runs the server, so they own the data *and* you get a
real API — which is arguably more private than trusting someone else's E2E SaaS, and reinforces the
decentralization pitch. **Build every mini-app against the open protocol, not a vendor API**, so any
compliant provider (including a customer's existing one) drops in.

### 8.3 Recommended first-wave integrations (concrete picks)
- **Calls → LiveKit** (see §7). Self-hostable, E2E, and the AI-agent hook for the notetaker.
  Jitsi as the lighter fallback; Nextcloud Talk if Nextcloud is in play.
- **Files → Nextcloud** as the all-rounder (WebDAV + OCS API; also bundles calendar/contacts/Talk,
  so one integration can cover several surfaces). Alternatives by need:
  **Seafile** (per-library client-side encryption — the strongest E2E of the self-hosted set, has an
  API), **Storj** (decentralized, E2E-encrypted, S3-compatible API, ~$4/TB — on-brand with Massa),
  and **Syncthing** (decentralized P2P sync, no central server). Avoid leaning on **ownCloud** for
  EU-sovereignty stories — it was acquired by US-based Kiteworks in late 2024.
- **Mail → Fastmail (JMAP)** as the reference integration: it exposes **JMAP** (JSON-over-HTTP, the
  modern IMAP successor its team co-authored), plus IMAP/SMTP, CalDAV, CardDAV, and WebDAV, with API
  tokens and OAuth for distributed apps. EU standards-based options: **mailbox.org / Posteo /
  StartMail** (IMAP + CalDAV/CardDAV). Full sovereignty: self-host **Stalwart / Mailcow / Mailu**.
  Note: Fastmail is privacy-respecting but **not** zero-knowledge — name that honestly.
- **Calendar / Contacts → CalDAV / CardDAV.** This is the universal answer; works with Fastmail,
  Nextcloud, mailbox.org, and self-hosted **Radicale / Baïkal**. (Proton and Tuta expose neither —
  this was the hardest Proton gap.)
- **Notes → Standard Notes or CryptPad** (E2E/privacy-focused, with APIs/embeds).

### 8.4 Closed-but-private providers (handle as special cases, don't block on them)
- **Proton Mail:** Proton Mail Bridge (official, desktop-only, paid plan) → local IMAP/SMTP, or the
  third-party `hydroxide` (IMAP/SMTP/CardDAV translator). Desktop/Tauri only. **Proton Calendar has
  no API or CalDAV — don't promise it.**
- **Tuta:** E2E (encrypts subject lines too) but no third-party clients/API — not integrable today.

> Net: design around open standards + self-hostable apps; treat Proton/Tuta as optional desktop
> special cases rather than API integrations. Don't burn time on APIs that don't exist.

---

## 9. Data model (Drizzle / wa-sqlite)

Extends Gossip's existing entities (`UserProfile`, `Contacts`, `Messages`, `Conversations`,
`Settings`). Add:

- **Workspace** — id, name, relayBaseUrl, createdBy, settings.
- **WorkspaceMember** — workspaceId, userProfileId, displayName, role (`owner|admin|member|guest`),
  publicKey.
- **Channel** — id, workspaceId, name, type (`public|private|dm_group`), topic, isAiMember.
- **ChannelMember** — channelId, memberId, role.
- **ChannelMessage** — id, channelId, senderId, body (encrypted-at-rest locally), threadRootId?,
  createdAt, deliveryState. (DMs continue to use Gossip's `Messages`/`Conversations`.)
- **Integration** — workspaceId, kind (`mail|calendar|notes|files|calls`), provider, config (no
  secrets in frontend; secrets in desktop keychain / gateway), enabled.
- **AiJob** — id, workspaceId, channelId, type (`recap|notes|qa`), status, route (`local|cloud`),
  resultRef.

Keep all of it local-first; sync/relay only what the channel transport requires.

---

## 10. Pages / routes (frontend map)

Build the shell first, then fill panes. Route-level screens live in `apps/web/src/pages`.

**Unauthenticated / onboarding**
- `/welcome` — value prop + create-or-join.
- `/identity/create` — passphrase-based Gossip identity creation (no PII).
- `/identity/unlock` — passphrase / biometric unlock.
- `/workspace/create` — name workspace, set (optional) self-hosted relay URL.
- `/workspace/join` — join via invite link/code.

**Main app shell** (persistent layout: left sidebar = workspace switcher + channels + DMs; far-left
or bottom = mini-app dock; main pane = content; right = thread/AI panel)
- `/w/:workspaceId` — workspace home / activity.
- `/w/:workspaceId/c/:channelId` — channel (messages, threads, members, call button).
- `/w/:workspaceId/dm/:conversationId` — 1:1 E2E DM.
- `/w/:workspaceId/threads` — threads the user follows.
- `/w/:workspaceId/search` — search across accessible channels.
- `/w/:workspaceId/members` — directory.

**AI assistant**
- `/w/:workspaceId/ai` — chat with OpenClaw; quick actions ("recap #marketing this week",
  "summarize this thread"). Recaps respect access scope.

**Calls**
- `/w/:workspaceId/call/:channelId` — Jitsi huddle + AI-notetaker toggle.

**Mini-apps**
- `/w/:workspaceId/apps` — dock / launcher.
- `/w/:workspaceId/apps/mail` · `/apps/calendar` · `/apps/notes` · `/apps/files` — mini-app hosts.

**Settings**
- `/settings/profile` — identity, display name, devices.
- `/settings/workspace` — name, members, roles, relay URL.
- `/settings/integrations` — connect Proton(Bridge)/Nextcloud/IMAP/JMAP/CalDAV/etc.
- `/settings/ai-engine` — **the "few clicks" local-model page** (§6.4): detect/install Ollama,
  pick + pull model, toggle local/cloud routing, enter Claude API key.
- `/settings/security` — passphrase, biometric, session/device management.
- `/settings/notifications`, `/settings/appearance`.

**Admin / enterprise**
- `/admin/:workspaceId` — provisioning, roles, integration governance, license/seats. Keep
  admin features privacy-compatible (no reading of DMs; channel governance only).

> Suggested build order for the frontend: shell + routing → identity/onboarding → channel view
> (mocked data) → DM view (wire real SDK) → AI panel → AI Engine settings → mini-app dock → calls.

---

## 11. Environment & config

`apps/web/.env` (copy from `.env.example`):
- `VITE_GOSSIP_API_URL` — message-transfer base URL. Default `https://api.usegossip.com`;
  override per-workspace for self-hosted relay. Also set at runtime via `setProtocolBaseUrl`.
- `VITE_OPENCLAW_GATEWAY_URL` — URL of the OpenClaw gateway (`openclaw-bridge` targets this).
- `VITE_DEFAULT_MASSA_NETWORK` — `mainnet` (matches Gossip prod).

`services/openclaw` config (never in the frontend bundle):
- Model providers: `ollama` (`baseUrl: http://127.0.0.1:11434`, native API) and `anthropic`
  (API key). Model routing: `default → ollama`, `complex → anthropic`.
- Gossip channel plugin credentials (the bot's identity).

Desktop secrets (Proton Bridge creds, Claude key when entered in-app) live in the OS keychain via
Tauri, **not** in the web bundle.

---

## 12. Local dev setup

**Prerequisites:** Node (see `vendor/gossip/.nvmrc`), pnpm, Rust toolchain + zig (for WASM),
Xcode/Android Studio for native, Ollama (for local AI), and Tauri prerequisites for desktop.

```bash
# 1. Clone with the Gossip submodule
git clone <repo> gossip-workspace
cd gossip-workspace
git submodule update --init --recursive

# 2. Build Gossip's WASM bindings (post-quantum crypto) — required before first run
cd vendor/gossip
npm run setup          # installs rust toolchain, cargo subcommands, zig, wasm-bindgen-cli, deps
npm run wasm:build     # outputs gossip-sdk/src/assets/generated/wasm
cd ../../

# 3. Install workspace deps
pnpm install

# 4. Configure env
cp apps/web/.env.example apps/web/.env   # set VITE_GOSSIP_API_URL, VITE_OPENCLAW_GATEWAY_URL

# 5. Run the frontend
pnpm --filter web dev    # http://localhost:5173

# 6. (optional) Run the AI gateway with a local model
ollama pull qwen2.5:7b
# start OpenClaw gateway from services/openclaw pointed at ollama; see services/openclaw/README

# 7. (optional) Desktop shell
pnpm --filter desktop tauri dev
```

Mobile (later) uses Gossip's Capacitor flow (`cap:sync:ios`, `cap:run:ios`, wireless dev mode, etc.).

---

## 13. Build phases (sequence the work)

**Phase 0 — Scaffold.** Monorepo (pnpm + turbo), submodule the gossip repo, wire `gossip-sdk` as a
workspace dep, get `wasm:build` running, boot an empty `apps/web` with router + Tailwind + the
shared `ui` package. Stub `configureSdk` adapters.

**Phase 1 — Identity + shell.** Onboarding, identity create/unlock, workspace create/join, the
persistent workspace shell (sidebar, panes, dock placeholders).

**Phase 2 — DMs (real E2E).** Fully wire `gossip-sdk` for 1:1: send/receive, local persistence,
notifications. This proves the inherited stack end-to-end.

**Phase 3 — Channels.** Build the channel service + relay-backed group messaging (non-E2E v1),
threads, membership, search over accessible channels.

**Phase 4 — AI assistant.** `openclaw-bridge` + gateway + gossip channel plugin; recaps and
thread summaries via the **cloud (Claude)** route first (simplest), bot-as-member access model.

**Phase 5 — Local AI engine.** The `/settings/ai-engine` "few clicks" flow (Tauri): detect/install
Ollama, pull model, flip routing to local, optional Claude key. Move privacy-sensitive jobs local.

**Phase 6 — Calls + notes.** Jitsi embed, local transcription, AI meeting notes to channel.

**Phase 7 — Mini-apps.** `miniapp-sdk` sandbox + dock; first integrations against open standards —
**Nextcloud** (files/calendar/contacts via WebDAV/CalDAV/CardDAV), **Fastmail JMAP** (mail),
**Storj** (decentralized S3 files), with Proton handled as the desktop-Bridge special case.

**Phase 8 — Enterprise hardening.** Self-hosted relay option, admin console, roles/provisioning,
DeWeb deployment, group-E2E upgrade path (fan-out → MLS).

---

## 14. Security & privacy model (non-negotiables)
- **Never touch** Gossip's crypto or WASM bindings; treat E2E DMs as a sealed component.
- **AI never sees DMs.** The bot only reads channels it's a member of, scoped to the requester's
  access. Recaps/notes operate on already-shared channel data only.
- **No secrets in the frontend bundle.** Model API keys live in the gateway; Bridge/keychain
  secrets live in the desktop keychain.
- **Local-first.** Persist to the on-device Drizzle/wa-sqlite DB; relay only what transport needs.
- **Consent for capture.** Call transcription/notetaking must be explicit and visible to all
  participants.
- **Honest privacy claims.** v1 channels are "workspace-confidential," not E2E — label them
  accurately in UI and sales material until the group-E2E upgrade lands.

---

## 15. Working agreement
- Prefer **reusing `gossip-sdk`** over re-implementing messaging. If you must imitate it, keep the
  crypto boundary identical and document why.
- Work **phase by phase** (§13). Don't scaffold features from later phases prematurely.
- Keep the **monorepo boundaries** clean: UI in `packages/ui`, AI access only via
  `packages/openclaw-bridge`, mini-apps only via `packages/miniapp-sdk`.
- When a dependency/API turns out not to exist or not to fit (e.g. a Proton API), **stop and flag
  it** rather than mocking a fake integration.
- Default to **TypeScript strict**, small focused PRs/commits, and tests for the channel service
  and the openclaw-bridge.

---

## 16. Open decisions for the human (resolve before/while building)
1. **Product name** (replace "Gossip Workspace").
2. **Desktop shell:** Tauri (recommended, lighter) vs Electron.
3. **Group-chat privacy ambition for v1:** confirm relay-backed non-E2E is acceptable (current
   assumption) vs. attempt small-group fan-out E2E sooner.
4. **Relay:** ship against `api.usegossip.com` first, or stand up `services/relay` immediately for
   the enterprise story?
5. **First mini-app to ship:** Nextcloud (covers files+calendar+contacts in one) vs LiveKit calls
   (most visible "wow") vs Fastmail/JMAP mail. Recommendation: Nextcloud first for breadth.
6. **Local model default** for the AI Engine curated list (depends on target customer hardware).
7. **AI cloud route:** Claude via OpenClaw gateway — confirm it's acceptable for non-sensitive
   workspaces, with local-only as the privacy default.
