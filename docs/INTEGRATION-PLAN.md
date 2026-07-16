# Gossip Workspace — Desktop, Self-Hosting & Security Integration Plan

> **Goal:** one codebase that serves three kinds of users with the *least possible effort for each*:
>
> 1. **"Just works" users** — open the app (web or desktop), talk to people. Our managed infra
>    carries channels, calls, and AI. Zero setup.
> 2. **Privacy-maximalist individuals** — install the desktop client, flip **one toggle**, and
>    every service (relay, AI, calls) runs on their own machine. No account with us, no data
>    through us.
> 3. **Self-hosting orgs** — run one `docker compose up` on a box they control; every teammate's
>    client points at it via the invite link. The org owns transport, storage, and AI.
>
> This document inventories every feature we ship, maps it to the infrastructure it touches,
> classifies its privacy level, defines the three deployment modes, and lays out the security
> hardening work — including honest findings about today's relay — phased so nothing blocks the
> next demo.

Companion to [`SPEC.md`](SPEC.md) (product spec). Where they disagree, this file is newer and wins
on deployment/security topics.

---

## 1. Feature inventory → infrastructure map

Everything the app does today, and which backend each piece touches. This is the ground truth for
"what has to move" when a user flips to self-hosted.

**Legend — privacy class:**
- 🟢 **E2EE** — end-to-end encrypted; no server (ours or self-hosted) can read it.
- 🟡 **Server-visible** — plaintext to whoever runs the relay ("workspace-confidential").
- 🔵 **Local-only** — never leaves the device.
- 🟠 **Third-party** — a request leaves our infra entirely (proxied or direct).

| Feature | Where it lives | Backend it touches | Class | Self-host story |
|---|---|---|---|---|
| **1:1 DMs** | `gossip-sdk` via `lib/sdk.ts`, `RealDmView` | Gossip/Massa network (`VITE_GOSSIP_API_URL`) | 🟢 | Already decentralized — nothing to self-host. Endpoint is configurable per workspace. |
| **Channels** (public / private / password) | `useRelay.ts` ↔ relay WS | `services/relay` | 🟡 | Relay moves to user/org hardware — becomes org-confidential on org's disk. |
| **Threads, edits, deletes, mentions, typing** | relay WS messages | relay | 🟡 | Rides with the relay. |
| **Roles, bans, membership** | relay WS (`setRole`, `banMember`, …) | relay | 🟡 | Rides with the relay. |
| **Presence & status** (online / invisible) | relay WS (`watchPresence`) | relay (in-memory) | 🟡 | Rides with the relay. Never persisted — keep it that way. |
| **File & image attachments** | `lib/uploads.ts` → `POST /uploads` | relay disk (`uploads/`) | 🟡 | Rides with the relay; files land on org/user disk. |
| **Voice messages** | `voiceRecorder.ts` → uploads | relay disk | 🟡 | Same as attachments. |
| **Calls / huddles** (channel + DM, screen share, device settings) | `useCall.ts`, LiveKit client | LiveKit server (token minted by relay `POST /livekit-token`) | 🟡 media E2EE-capable | Self-hosted `livekit-server` binary; relay keeps minting tokens with locally generated keys. |
| **AI: recaps / notes / Q&A** | `AiSidePanel`, `AiPage` → `POST /openclaw/jobs` | relay → Ollama (`OLLAMA_URL`) | 🟡 (channel content → model) | Point `OLLAMA_URL` at localhost — the model literally runs on the user's GPU. |
| **AI: draft rewrite** | Composer ✨ → `POST /openclaw/rewrite` | relay → Ollama, **local route only** (cloud refused server-side) | 🟡→🔵 | Already designed private: refuses non-local routes. Fully local in desktop mode. |
| **GIF picker** | `GifPicker` → `GET /gif-search` | relay → Giphy/Tenor (keys server-side) | 🟠 proxied | Good pattern already: client IPs never hit Giphy — the relay proxies. Self-host: org's relay key, or feature hides when no key set. |
| **Link previews** | `LinkPreview` → `GET /unfurl` | relay → target site | 🟠 proxied | Relay fetches, so the *user's* IP never touches the linked site. Channel-only by design (DM URLs never sent — would leak E2EE content). |
| **Avatars** | `useAvatars` (DiceBear local, custom ≤64 KB via `hello`) | local + relay member record | 🔵/🟡 | No third-party avatar CDN. Fine as-is. |
| **Notifications** | `useNotifications`, browser Notification API | local | 🔵 | Desktop: native notifications via Electron. No push service, no APNs/FCM — nothing to self-host. |
| **Identity** (passphrase, biometric unlock) | `useSession`, `biometricVault.ts` | local (WebAuthn / device) | 🔵 | Nothing server-side to move. Desktop upgrade: OS keychain via `safeStorage`. |
| **Search** | `SearchPage` over relay history | relay | 🟡 | Rides with the relay. |
| **Mini-apps** | `miniapp-sdk` sandboxed iframes | per-app (open protocols) | varies | Already designed self-host-first (CalDAV/JMAP/WebDAV — see SPEC §8). |
| **Themes / appearance / sounds** | `useTheme`, `sounds.ts` | local | 🔵 | Nothing to do. |

**Two load-bearing observations:**

1. **The relay is the whole ballgame.** One Node process (`server.mjs`, ~1.5 k lines, deps: `ws` +
   `livekit-server-sdk`) already fronts channels, uploads, LiveKit tokens, AI jobs, GIF proxy, and
   unfurl. Self-hosting ≈ *running this one process somewhere else* plus its two friends (Ollama,
   livekit-server). This is why the toggle is feasible at all.
2. **DMs are already sovereign.** They ride Gossip's decentralized network E2EE — there is nothing
   of ours to self-host, in any mode. Keep the SDK: the self-host audience is exactly who values
   E2EE DMs most. (Decision from 2026-07-16 discussion: SDK stays.)

---

## 2. The three deployment modes

Same binaries, same renderer — the modes differ only in **which base URLs the client talks to** and
**who spawned the processes behind them**. All three already reduce to configuration
(`VITE_RELAY_URL` / per-workspace relay URL, `OLLAMA_URL`, `LIVEKIT_URL`).

### Mode A — Managed (default, zero setup)
- Web app on Vercel, or desktop client out of the box.
- Relay: our Fly.io instance. LiveKit: LiveKit Cloud (or our hosted SFU). AI: our GPU (today:
  Ollama behind the Cloudflare tunnel).
- Privacy statement (be honest in UI + marketing): *DMs E2EE always; channels/files/AI prompts are
  workspace-confidential on our infra.*

### Mode B — Org self-host (one command on a server)
- We ship `deploy/docker-compose.yml`: **relay + livekit-server + ollama + caddy** (auto-TLS via
  Let's Encrypt). One `docker compose up -d` with a 4-line `.env` (domain, admin passphrase).
- Compose generates LiveKit key/secret and relay secrets on first boot — the admin never touches
  crypto material.
- Teammates onboard via **invite link that embeds the relay URL** (extend `lib/invite.ts`:
  `https://chat.acme.com/join/CODE` already implies the origin — the join flow should adopt the
  link's origin as the workspace relay URL so clients auto-point without manual settings).
- Privacy statement: *everything on org hardware; we never see a byte.*

### Mode C — Fully-local desktop (the toggle)
- Electron client (see §5) bundles/fetches: **relay** (Node, ours), **livekit-server** (single Go
  binary, Apache-2.0), **Ollama** (download-on-demand — too big to bundle).
- Settings → **Self-hosting** panel: one master toggle + per-service cards (status dot, port,
  logs). Flipping the toggle: supervisor spawns services on loopback, health-checks, then swaps the
  client's base URLs. Flipping back restores managed URLs; local services stop.
- **No LiveKit account or API-key visit needed** in this mode: we self-generate an API key/secret
  locally (livekit-server accepts `--keys` / config file), store it via `safeStorage`, and the
  local relay mints tokens with it. A LiveKit Cloud key is only relevant if the user *chooses*
  cloud SFU for better NAT traversal.
- Caveat surfaced in UI, not hidden: a laptop relay is only reachable by others while it's awake
  and reachable (LAN or tunnel). Mode C is perfect for solo/local-first + small LAN teams;
  point teams at Mode B for always-on.

---

## 3. Security audit of today's relay (honest findings)

Done before hardening design, 2026-07-16, against `services/relay/server.mjs`. Severity is for
Modes A/B (shared relay); Mode C on loopback mostly moots the network-facing items.

| # | Finding | Severity | Detail |
|---|---|---|---|
| F1 | **Identity is asserted, not proven.** `hello { userId }` is trusted verbatim; any client claiming a userId becomes that user — read joined channels, post as them, exercise their role (incl. owner powers). | **Critical** | The whole authz layer (roles, private channels, bans) sits on an unauthenticated identity. **⏳ Step 1 shipped (2026-07-16):** identity is now cryptographically provable (§4.1 — signed-challenge handshake, key pinning, session tokens, all live on prod, backward compatible). Remaining: flip to enforcement (reject unsigned/mismatched hellos) after a migration window. |
| F2 | **`POST /openclaw/jobs` is unauthenticated.** Anyone with a workspace id gets AI summaries of its channel content over plain HTTP. | **Critical** | `runAiJob` scopes by `workspaceId/channelScope` from the request body with no requester check. **✅ Fixed (2026-07-16, live):** AI context is now scoped to the proven requester's membership *always* (non-member → empty; private channels they belong to now correctly included) — a bare workspaceId can't pull content the caller can't read. Token requirement is behind `RELAY_REQUIRE_AUTH` (deployed off). |
| F3 | **`POST /livekit-token` mints for any room/identity.** No membership check — anyone can join any channel call, or a DM call if they learn the room digest. | **High** | Also lets outsiders trigger `callStarted` announces (spam) and inflate `activeCalls`. **⏳ Fix shipped, gated:** behind `RELAY_REQUIRE_AUTH` — requires a token, binds the minted identity to the proven userId (403 on mismatch), and checks workspace+channel membership for channel rooms. Live once the flag is flipped. |
| F4 | **Uploads: unauthenticated POST, no quota/rate limit.** Per-file cap exists (`MAX_UPLOAD_BYTES`), but nothing stops disk-filling loops. GET is capability-URL (unguessable UUID) — acceptable, but no membership binding. | **High** | Abuse/DoS vector on Mode A; storage cost risk. **⏳ Auth fix shipped, gated** (`RELAY_REQUIRE_AUTH` requires a token; uploader is recorded). Rate limit/quota still to do (D2 step 3 / D5). |
| F5 | **Channel `joinPassword` stored/compared in plaintext** in `.data.json`. | Medium | Anyone with disk access (or a backup) reads every channel password. |
| F6 | **Unfurl SSRF guard is hostname-literal.** `isPrivateHost` blocks `10.x`/`192.168.x`/localhost literals, but a public DNS name resolving to a private IP (DNS rebinding) or a redirect chain can reach internal services. | Medium | Classic SSRF hardening gap. |
| F7 | **`CORS_ORIGIN` defaults to `*`**; no security headers on upload/file responses beyond `nosniff`. | Medium | Fine for dev; must be pinned in production. |
| F8 | **Data at rest is plaintext**: `.data.json` (all channel history) + `uploads/` on relay disk. | Medium | "Workspace-confidential" currently means "readable by anyone with the disk". |
| F9 | Good things worth preserving: DM URLs never sent to unfurl; draft-rewrite refuses cloud routes server-side; presence is in-memory only; uploads stored by UUID (no path traversal); avatar size caps; GIF/unfurl proxying hides client IPs. | — | Design intent is right; enforcement needs to catch up. |

None of this is embarrassing for a pre-launch demo product — but F1–F3 must land **before** we
market "private" to strangers, because they invalidate the private-channel and role features under
a hostile user.

---

## 4. Security hardening plan

### 4.1 Relay identity: signed hello (fixes F1) — the keystone

We already have the perfect primitive: every user has a **Gossip identity with a keypair**
(passphrase-derived, pseudonymous, zero PII). Use it, instead of inventing accounts/emails:

1. Client `hello` includes its **public key**; `userId` *is* (a hash of) the public key — claims
   become self-certifying.
2. Relay replies with a random **challenge nonce**; client signs it (Ed25519); relay verifies and
   binds the socket to the proven userId. ~40 lines each side; no passwords, no PII, no email —
   perfectly on-brand.
3. **Migration**: two-phase. Phase 1: accept both, tag members with their pubkey on first signed
   hello ("key pinning" — first-come). Phase 2 (flag day per workspace): reject unsigned hellos.
   Existing member records with no pinned key get claimed by first signed hello — announce that
   window to workspaces.
4. HTTP endpoints get a short-lived **session token** issued over the authenticated WS (relay
   returns it post-challenge; client sends `Authorization: Bearer` on `/uploads`, `/openclaw/*`,
   `/livekit-token`). Keeps HTTP handlers stateless-ish without a second auth system.

### 4.2 Endpoint authorization (fixes F2, F3, F4)
- **AI jobs**: require session token; resolve the requester's actual membership; intersect
  `channelScope` with channels the requester can read (drop private channels they're not in). This
  also implements SPEC §4's "recaps respect access scope" for real.
- **LiveKit tokens**: require session token; verify room membership — channel rooms
  (`wsId:chId`): must be a non-banned workspace member and, for private channels, a channel
  member. DM rooms: both parties derive the digest; require the requester's identity to be one of
  the two hashes in it.
- **Uploads**: require session token on POST; per-user rate limit (e.g. 20/min) + per-workspace
  storage quota (configurable, default 1 GB managed / unlimited self-host); record uploader id in
  metadata. Keep capability-URL GET (media tags can't send headers) but add optional
  `?token=` binding for private-channel attachments later.

### 4.3 Protocol & input hygiene (fixes F5, F6, F7)
- Hash channel passwords with **scrypt** (Node built-in) + per-channel salt; migrate lazily on
  next successful join.
- Unfurl: resolve DNS first, connect to the **resolved IP** (re-check private ranges post-resolve),
  cap redirects at 3 re-validating each hop, 5 s timeout, 512 KB response cap, strip credentials
  from URLs.
- Production defaults: `CORS_ORIGIN` **required** (refuse to boot with `*` unless
  `RELAY_DEV=1`); add `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`,
  `Cross-Origin-Resource-Policy: same-site` on HTTP responses. WS: verify `Origin` header against
  the same allowlist (browsers don't enforce CORS on WS — F7's quiet twin).
- Global per-IP rate limiting on HTTP + WS message-rate cap per socket (protects Mode B admins who
  expose the relay publicly).

### 4.4 Data at rest (fixes F8)
- Relay gains optional `DATA_KEY` (32-byte, generated by compose/desktop supervisor on first
  boot): AES-256-GCM encrypt `.data.json` snapshots and upload blobs. Key lives in the
  environment/keychain, *not* next to the data — a stolen disk or leaked backup is unreadable.
- **Retention controls** (privacy feature, sells well): per-workspace message retention
  (forever / 90d / 30d / 24h) and upload GC for orphaned files. Enforced in the relay's save loop.
- Managed mode (A): document plainly that we hold the key — retention + at-rest encryption protect
  against *our* disk leaks, not against *us*. Honesty is the brand.

### 4.5 Desktop (Electron) hardening — non-negotiables from day one
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; a single narrow preload
  exposing a typed `window.gossipDesktop` IPC surface (service status, toggle, notifications).
  **No generic `ipcRenderer` exposure.**
- Strict CSP on the renderer (`default-src 'self'`; `connect-src` limited to the configured relay
  + LiveKit + Ollama origins); `webSecurity` stays on; deny `window.open`/navigation to
  non-allowlisted origins (`setWindowOpenHandler`).
- Secrets (LiveKit local secret, future cloud AI keys) via `safeStorage` (OS keychain) — never in
  a JSON config or `localStorage`.
- Auto-update **signed** (electron-updater; macOS notarization, Windows Authenticode) — an
  unsigned updater is a supply-chain backdoor into exactly the audience that came for privacy.
- Spawned services bind to `127.0.0.1` only, ports checked before spawn; child processes
  killed on quit (no orphan relays holding chat history).
- **Zero telemetry, zero crash upload** by default. If we ever add opt-in diagnostics it's a
  visible toggle, off, with a "show exactly what would be sent" preview.

### 4.6 What we deliberately do NOT build
- No accounts/emails/phone numbers (identity = keys, always).
- No server-side push gateway (APNs/FCM) for now — notifications stay device-local; revisit only
  for mobile, and then via the E2EE-friendly variants (encrypted payload push).
- No analytics SDKs, no third-party fonts/CDNs at runtime (fonts are bundled via `@fontsource`
  already — keep it that way).

---

## 5. Desktop client & the self-host toggle (least-effort UX)

### 5.1 Shell: Electron, one repo, no platform branches
Decision (2026-07-16 discussion): **Electron** over Tauri — Node main process makes the service
supervisor trivial, and bundled Chromium guarantees the Gossip SDK's WASM +
`SharedArrayBuffer`/COOP-COEP behavior on all three OSes. **No per-platform branches**: one
`apps/desktop` workspace package; macOS/Linux/Windows differences live in a CI build matrix
(GitHub Actions: `macos-latest` / `ubuntu-latest` / `windows-latest` → electron-builder →
`.dmg` / `.AppImage` + `.deb` / `.exe`). Web build keeps deploying to Vercel unchanged; the
renderer detects `window.gossipDesktop` and lights up desktop-only UI.

```
apps/desktop/
├── src/main/
│   ├── index.ts          # window, menu, single-instance, deep links (gossip://join/CODE)
│   ├── supervisor.ts     # LocalServices: install/spawn/health/stop per service
│   ├── services/
│   │   ├── relay.ts      # bundled server.mjs, spawn on 127.0.0.1:8788, DATA_DIR in userData
│   │   ├── livekit.ts    # bundled livekit-server binary + generated keys (safeStorage)
│   │   └── ollama.ts     # detect 11434 → else guided install; model pull w/ progress
│   ├── secrets.ts        # safeStorage wrapper
│   └── updater.ts        # signed auto-update
├── src/preload/index.ts  # typed contextBridge: status, toggle, notify, openExternal
└── electron-builder.yml  # per-OS targets, binary asset matrix (os × arch)
```

### 5.2 The toggle, concretely
Settings → **Self-hosting** (desktop only; web shows the panel disabled with a "get the desktop
app" link):

- **Master switch:** "Run Gossip services on this computer".
- Turning it ON walks a checklist UI, fully automated unless something needs consent:
  1. **Relay** — spawn bundled relay (`DATA_DIR` = app data dir, fresh `DATA_KEY` in keychain).
     ~1 s. ✅
  2. **Calls** — spawn bundled `livekit-server` with locally generated key/secret. ~1 s. ✅
  3. **AI** — detect Ollama; if missing, one consented download+install; then curated model
     picker with RAM/VRAM hints and a pull progress bar (this *is* SPEC §6.4's AI-engine page —
     same component, reused).
  4. Swap client base URLs → `127.0.0.1`; re-run health checks; done.
- Each service is also individually overridable (power users: "AI local, calls via LiveKit Cloud,
  channels on the org relay") — the master toggle is just the 100%-local preset.
- Turning it OFF: stop services (data stays on disk), restore managed URLs.
- **Data locality note in the panel**, always visible: where history/files/keys live in each mode.

### 5.3 Binary strategy
| Service | Strategy | Size |
|---|---|---|
| relay | **Bundled** (it's our own ~50 KB of JS; ship with the app's Node via Electron `utilityProcess`) | ~0 |
| livekit-server | **Bundled** per os/arch (single static Go binary) | ~30–40 MB |
| Ollama | **Download-on-demand** with consent + checksum verification (installers are ~1 GB+ with runtime; models more) | 0 until used |

All downloaded artifacts: pinned versions + SHA-256 verified from our release manifest (not
"latest" from a third-party URL) — supply-chain hygiene consistent with §4.5.

### 5.4 Org mode (`deploy/`)
- `deploy/docker-compose.yml` (relay, livekit, ollama, caddy) + `deploy/README.md` (10 lines:
  point DNS, set 2 env vars, `docker compose up -d`, share the invite link).
- First-boot init container generates: LiveKit keys, relay `DATA_KEY`, admin bootstrap invite.
- Invite links carry the origin (§2 Mode B) so member clients need **zero settings**.

---

## 6. Phased roadmap

Ordered so each phase ships something usable and nothing blocks demos. Security phase precedes
public self-host marketing on purpose.

| Phase | Scope | Key deliverables | Rough effort |
|---|---|---|---|
| **D1. Desktop shell** | Electron app running the existing renderer | `apps/desktop`, hardened BrowserWindow (§4.5), native notifications, CI matrix + signed installers | ~1 week |
| **D2. Relay auth** | F1–F4 fixes | ✅ **Step 1 (shipped):** signed-hello challenge–response, mnemonic-derived Ed25519 keys, TOFU pinning, session tokens — backward compatible, live. ✅ **Step 2 (shipped):** (2a) client sends the token on every relay HTTP call; (2b) AI context scoped to membership *always*, and token-requirement + LiveKit identity/membership checks behind `RELAY_REQUIRE_AUTH` (deployed **off**). Verified both modes + real browser under enforcement. **▶ To go live:** `fly secrets set RELAY_REQUIRE_AUTH=1` once client adoption is confirmed. ⏳ **Step 3:** reject unsigned/mismatched hellos (flag day) after an in-app migration banner; rate limits + WS origin check + at-rest bits. | ~1–1.5 weeks |
| **D3. Supervisor + toggle** | Mode C | `supervisor.ts`, bundled relay + livekit, Self-hosting settings panel, Ollama flow (reuse AI-engine page), URL swapping | ~1.5 weeks |
| **D4. Org self-host** | Mode B | `deploy/` compose + caddy, key generation, invite-link origin adoption, self-host docs | ~0.5 week |
| **D5. At-rest + retention** | F5, F8 | `DATA_KEY` encryption, scrypt channel passwords, retention settings + GC | ~0.5 week |
| **D6. Polish & audit** | F6, F7 leftovers + review | Unfurl DNS-pinning, CORS/headers lockdown, threat-model doc refresh, external pen-test pass if budget allows | ~0.5 week |

Sequencing note: D1 and D2 are independent — parallelizable. D3 depends on D1; D4 depends on D2
(never advertise an org-exposed relay while `hello` is unauthenticated).

---

## 7. Honest privacy statements per mode (for UI + site)

Because "private" claims that overreach are how trust dies (SPEC §14: honest privacy claims):

- **DMs, every mode:** end-to-end encrypted via Gossip. Nobody — not us, not your org admin — can
  read them.
- **Mode A:** channels, files, and AI prompts are encrypted in transit and stored on our servers;
  we can technically access them and will publish a transparency/retention policy. AI recaps of
  channels run on our models.
- **Mode B:** channels, files, and AI run on your organization's hardware. We never receive them.
  Your admin holds the keys.
- **Mode C:** everything except DM transport lives on your own computer. AI reasoning never
  leaves your GPU.

---

## 8. Decisions taken / still open

**Taken (2026-07-16):**
- Electron (not Tauri) for the desktop shell.
- One branch, CI matrix — no per-platform branches.
- Gossip SDK **stays**; DMs remain E2EE in all modes.
- Relay auth via Gossip-derived keypairs (no accounts/PII), challenge–response.

**Open:**
1. Managed AI in Mode A: keep the PC-Ollama tunnel, move to a rented GPU box, or route to
   Anthropic with per-workspace opt-in? (Cost vs. privacy optics.)
2. LiveKit in Mode A: LiveKit Cloud vs. self-run SFU on Fly — cost/scale call.
3. Upload quota defaults for managed mode.
4. Flag-day policy for rejecting unsigned hellos on the managed relay (needs an in-app migration
   banner first).
5. Whether Mode C should offer an optional tunnel (Cloudflare/Tailscale) preset so a laptop relay
   is reachable by teammates — powerful, but support-burden-heavy. Suggest: defer, document LAN
   only.
