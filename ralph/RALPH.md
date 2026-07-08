# RALPH.md — Gossip Workspace autonomous task loop

You are Claude Code running in an **unattended loop** (the "Ralph" pattern). This file is fed to you
on every iteration. Your job each run is to pick **exactly one** task from the backlog, complete it,
verify it against `ralph/CHECKUP.md`, record progress, and **stop**. The loop will re-invoke you with
fresh context for the next task.

**Do NOT commit and do NOT push.** The human tests everything locally first and makes the real commit
themselves. See §3 for the exact rules and the per-task checkpoint mechanism that lets a failed task
be undone without destroying earlier tasks' uncommitted work.

Read this whole file before doing anything. `CLAUDE.md` at the repo root is the product spec and the
source of truth for architecture and privacy rules — obey it.

---

## 0. How the loop works (do this every run)

1. **Read** `CLAUDE.md`, this file, `ralph/CHECKUP.md`, and (if they exist) `ralph/FINDINGS.md` and
   `ralph/PROGRESS.md`.
2. **Checkpoint** the working tree (§3, "Per-task checkpoint") so this task can be rolled back in
   isolation later without touching earlier tasks' uncommitted work.
3. **Pick the task**: the first backlog item marked `[ ]` (top to bottom). Skip `[x]` (done) and
   `[!]` (blocked). If every task is `[x]` or `[!]`, write "ALL TASKS COMPLETE OR BLOCKED" to
   `ralph/PROGRESS.md` and stop.
4. **Do only that one task.** Do not start, scaffold, or "quickly also fix" anything else.
5. **Verify** using `ralph/CHECKUP.md` — the universal gate **plus** the task-specific checks.
6. **If verification passes**: **do not commit, do not push.** Leave the changes in the working tree,
   flip the task to `[x]` in this file, append a one-paragraph entry to `ralph/PROGRESS.md`, then stop.
7. **If you cannot complete it safely** (missing dependency, capability doesn't exist, would violate a
   guardrail, or checkup keeps failing after a reasonable fix attempt): **restore the checkpoint**
   (§3, "Restore only this task") so **only this task's** changes are undone and earlier tasks' work
   stays intact. Mark the task `[!]` with a short reason inline, log it in `ralph/PROGRESS.md`, then
   stop. Never leave broken or half-done changes in the working tree. Never fake/mock/stub around a
   missing capability to force a green result.

One task per run. Small, focused diffs. When in doubt, stop and flag rather than guess.

---

## 1. Golden rules (never violate — these override any task)

From `CLAUDE.md §14`, plus this loop's no-commit rule. A task is **not** worth breaking them.

- **Never commit, never push, never touch the remote.** No `git commit`, no `git push`, no
  fetch-and-reset, no branch operations against `origin`. Nothing from this loop may reach GitHub.
  The human commits after they've tested.
- **Never touch the crypto or WASM.** No edits under `vendor/gossip/**`, `**/gossip-sdk/**`, or any
  `**/generated/wasm/**`. Treat E2E DMs as a sealed component. If a task seems to need this, it's
  BLOCKED.
- **AI never sees DM content.** OpenClaw / the local model may only operate on channel content the
  requesting user can already access. The only DM-adjacent AI allowed is rewriting **the current
  user's own outgoing draft**, and that must use the **local** route only — never send DM drafts to
  the cloud route, never persist them, never read received DM messages.
- **No secrets in the frontend bundle.** No API keys, tokens, or provider credentials in
  `apps/web/**`. Keys live in the gateway / OS keychain.
- **Respect monorepo boundaries.** Shared UI → `packages/ui`. AI access → only via
  `packages/openclaw-bridge`. Mini-app calls → only via `packages/miniapp-sdk`.
- **Local-first.** Persist to the on-device Drizzle/wa-sqlite DB; only relay what transport needs.
- **Honest privacy labels.** v1 channels are "workspace-confidential," not E2E. Don't imply E2E in
  any new channel UI.
- **Stay in scope.** Only do work described by a backlog task here. Don't start features from later
  `CLAUDE.md` phases that aren't in this backlog.
- **TypeScript strict**, additive changes, no drive-by refactors of unrelated code.

---

## 2. Environment & commands

- Monorepo: pnpm workspaces + Turborepo. Node `>=20`, `pnpm@9.15.0`. Web app package is `@gossip/web`.
- Install (only if you changed deps): `pnpm install`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Build: `pnpm build`
- Run the web app: `pnpm dev:web` → http://localhost:5173
- Design system styleguide (visual reference + regression guard): http://localhost:5173/dev/styleguide
- Tests: there is no root `test` script. If a package defines one, run `pnpm --filter <pkg> test`.
  Add a *tiny* test only where a task calls for it (pure-logic helpers) — don't build a test harness.

**Git is used only for checkpoint/restore below — never to commit or push.** If a command needs the
browser (visual/console checks) and you can't drive one, do the static checks you can
(typecheck/lint/build) and record visual items as **"needs human eyeball"** in `ralph/PROGRESS.md`.

---

## 3. No commits — leave work in the working tree (with safe per-task rollback)

The human reviews the accumulated diff, tests locally, and makes the real commit themselves. So this
loop **never** runs `git commit` or `git push`. Progress is tracked purely by the `[x]`/`[!]`
checkboxes in this file and by `ralph/PROGRESS.md` — both are just uncommitted files in the working
tree, which is fine.

Because many tasks pile up as uncommitted changes, you must isolate each one so a **failed** task can
be rolled back **without** wiping earlier tasks' work. **Never** use bare `git checkout -- .` or
`git clean -fd` — those destroy every uncommitted task. Use the checkpoint below instead.

**Per-task checkpoint (run in step 0.2, at task start):**
```bash
git rev-parse HEAD > ralph/.ralph_head
CP=$(git stash create); if [ -n "$CP" ]; then echo "$CP" > ralph/.ralph_cp; else rm -f ralph/.ralph_cp; fi
git status --porcelain -uall | awk '/^\?\?/{print substr($0,4)}' | sort > ralph/.ralph_untracked_before
```
`git stash create` snapshots the current working tree **without** changing it or adding to the stash
list — it just gives you a commit object to restore from if needed.

**Restore only this task (run in step 0.7, on failure):**
```bash
# 1) revert edits this task made to tracked files, back to the snapshot (keeps earlier tasks' work):
if [ -f ralph/.ralph_cp ]; then git checkout "$(cat ralph/.ralph_cp)" -- . ; else git checkout "$(cat ralph/.ralph_head)" -- . ; fi
# 2) delete ONLY the files THIS task newly created (never earlier tasks' files):
git status --porcelain -uall | awk '/^\?\?/{print substr($0,4)}' | sort > ralph/.ralph_untracked_after
comm -13 ralph/.ralph_untracked_before ralph/.ralph_untracked_after | grep -v '^ralph/\.ralph_' | xargs -r rm -f
rm -f ralph/.ralph_cp ralph/.ralph_head ralph/.ralph_untracked_before ralph/.ralph_untracked_after
```

On **success**, just delete the scratch files (`rm -f ralph/.ralph_cp ralph/.ralph_head
ralph/.ralph_untracked_*`) and leave all your task changes in place — do **not** commit them.

The `ralph/.ralph_*` files are scratch; add them to `.gitignore` so they never clutter the human's
review. You may reference tasks by their id (e.g. `T-05`) in `ralph/PROGRESS.md`, but there are no
commit messages because there are no commits.

---

## 4. Reality check before you trust the backlog (important)

The repo is at **Phase 0–1: UI built on mock data**, and per the README the `vendor/gossip` submodule
may not be wired yet ("Next: add the vendor/gossip submodule and wire gossip-sdk"). So:

- Some DM features the human requested depend on the **Gossip SDK**, which may **not be present or
  wired**. Where a task says "capability-gated on gossip-sdk," first check whether `vendor/gossip`
  exists and exposes the needed API. If it doesn't, mark the task `[!]` "SDK not vendored / API
  absent — Phase 2 prerequisite" and move on. **Do not invent an SDK API.**
- The call feature may be **LiveKit** or **Jitsi (iframe)** — this drastically changes what's
  possible. Deep call-UI restyling and custom audio processing are only feasible with LiveKit-level
  control; a Jitsi IFrame gives you almost none. Task **T-00** resolves this first.

**T-00 must run first** and its findings gate several later tasks.

---

## 5. Task backlog

Legend: `[ ]` todo · `[x]` done · `[!]` blocked (add reason inline).
Each task lists **Effort** (S/M/L) and **Risk** (Low/Med/High). Do them top-to-bottom.

> Ordering rationale: recon → safe self-contained UI wins → moderate data/SDK work →
> architectural/high-risk last. The unattended loop should knock out the easy, reversible wins first.

---

### [x] T-00 — Recon & inventory (no feature code) · Effort S · Risk Low
**Goal:** Produce `ralph/FINDINGS.md` so later tasks branch correctly. This task changes no product
code.

**Do:** Inspect the repo and record, with concrete file paths and short quotes:
- Call stack in use: grep for `livekit`, `@livekit`, `jitsi`, `JitsiMeetExternalAPI`, `lib-jitsi`.
  State clearly: **LiveKit**, **Jitsi-iframe**, or **stub/none**. Note the call component + route
  (`.../features/calls/**`, route `/w/:workspaceId/call/:channelId`).
- Is `vendor/gossip` present and does `gossip-sdk` expose message mutation (edit/delete), reactions,
  and attachments? Record the exact exported functions you find (or "absent").
- DM data source today: real `gossip-sdk` or mock/fixtures? Where (`features/messaging/**`,
  `stores/**`, `db/**`)?
- The shared **message composer** component path, and whether DM + channel share it.
- The **app shell / sidebar** component path (where a persistent call dock would live) and the
  top-level providers file (`apps/web/src/app/**`, `main.tsx`).
- Design tokens location in `packages/ui` (colors incl. the mint accent, spacing, radii, fonts) and
  the source of the `/dev/styleguide` route.
- Current avatar rendering (how member/user images are produced today).
- Zustand stores that exist and their shape.

**Acceptance:** `ralph/FINDINGS.md` exists and answers every bullet above with real paths. No changes
outside `ralph/`.

---

### [x] T-01 — Emoji picker in the composer · Effort M · Risk Low
**Goal:** A good-looking emoji picker in the shared message composer (DMs + channels), rendering a
**consistent, non-OS-default** emoji set.

**Approach:** Add a maintained React picker. Recommended: **`frimousse`** (headless, unstyled — themes
cleanly with `@gossip/ui` tokens) or **`emoji-mart`** (batteries-included). Render glyphs with a
consistent set (**Twemoji** or **Noto**) via a web font or sprite so they don't fall back to each OS's
native emoji. Trigger from a button in the composer toolbar; insert at cursor. Style strictly with
`@gossip/ui` tokens (dark + mint), no ad-hoc colors.

**Acceptance:** Picker opens from the composer in both DM and channel views, inserts the emoji at the
cursor, renders in the chosen consistent set (verify a couple of glyphs are *not* the OS default), and
matches brand styling. See `CHECKUP.md#T-01`.

---

### [x] T-02 — Rich text: bold / italic / code · Effort M · Risk Low
**Goal:** Bold, italic, and inline/code-block formatting in the composer, rendered correctly in
messages (both DM and channel).

**Approach:** Prefer a **markdown**-based approach (store `**bold**`, `*italic*`, `` `code` ``,
triple-backtick blocks) to keep it transport-agnostic and E2E-safe — no rich HTML over the wire.
Add toolbar buttons + keyboard shortcuts (Cmd/Ctrl-B/I). Render with a safe markdown renderer
(sanitise; no raw HTML). Reuse the app's existing renderer if one exists (check FINDINGS).

**Acceptance:** Toolbar produces bold, italic, inline code, and fenced code blocks that render
correctly and safely in sent messages. XSS-safe (no `dangerouslySetInnerHTML` on unsanitised input).
See `CHECKUP.md#T-02`.

---

### [x] T-03 — "+" more-options popover in composer · Effort S · Risk Low
**Goal:** A "+" button opening a popover for "add media / more options," to host attachment + future
actions.

**Approach:** Build the popover (branded, keyboard-accessible, closes on outside-click/Esc). Wire the
**Attach file/media** entry to a native file picker that hands off to T-13's attachment flow (if T-13
isn't done yet, the entry can open the picker and no-op the upload with a "coming soon" toast — but do
NOT fake a successful upload). Leave clearly-labelled placeholder entries for later options.

**Acceptance:** "+" opens a branded, accessible popover in both DM + channel composers; Attach opens
the OS file picker. See `CHECKUP.md#T-03`.

---

### [x] T-04 — Message actions: copy + share · Effort S · Risk Low
**Goal:** Per-message **Copy** and **Share** actions (hover/overflow menu), working in **both** DMs
and channels. (Edit/delete are separate tasks — T-09/T-10.)

**Approach:** Add a per-message actions menu. **Copy** = copy message text to clipboard. **Share** =
copy a deep link to the message (or the message text if per-message deep links don't exist yet — check
FINDINGS; don't invent a routing scheme, fall back to text). Purely client-side; no transport changes.

**Acceptance:** Copy and Share appear on messages in both surfaces and work. No changes to message
storage/transport. See `CHECKUP.md#T-04`.

---

### [x] T-05 — Avatar system (DiceBear + regenerate + custom upload) · Effort M · Risk Low
**Goal:** Auto-assigned, developer/hacker-flavored avatars with regenerate + custom upload.

**Approach:** Use **DiceBear** (`@dicebear/core` + `@dicebear/collection`). Pick a
hacker/dev-feeling style — recommend **`identicon`** (GitHub-style), **`pixel-art`**, or
**`bottts`**/`glass`. Seed deterministically from the user's stable identity handle/public key so the
default is stable per user. Add **Regenerate** (new random seed, preview before save) and **Custom
upload** (store locally per privacy model; validate type/size, downscale). Persist the avatar choice
on the profile/member record (`UserProfile` / `WorkspaceMember`, see `CLAUDE.md §9`) via an additive
Drizzle migration if needed.

**Acceptance:** New users get a deterministic branded avatar; Regenerate cycles options with preview;
custom upload works and persists; choice survives reload. No PII leaves the device. See
`CHECKUP.md#T-05`.

---

### [x] T-06 — Better contact sharing (deep link + QR) · Effort M · Risk Low
**Goal:** Share your contact so someone lands directly in a DM with you.

**Approach:** Generate a shareable link that opens/creates a DM to your identity (define/confirm the
route, e.g. `/w/:workspaceId/dm/new?to=<identity handle>` — check FINDINGS for the real DM route
before inventing one). Add a **QR code** of that link (`qrcode.react` or `qrcode`), plus copy-to-
clipboard and native share. Handle the inbound side: the target route resolves the handle and opens
the DM (or a "start DM" confirmation). Share the **public identity handle only** — never anything
secret.

**Acceptance:** A "Share my contact" surface shows a copyable link + QR; opening the link on the app
resolves to starting a DM with that identity. See `CHECKUP.md#T-06`.

---

### [x] T-07 — Restyle the call UI to brand · Effort M–L · Risk Med
**Goal:** Make the call window on-brand with `@gossip/ui` and `/dev/styleguide` (dark + mint).

**Branch on FINDINGS (T-00):**
- **LiveKit / custom UI:** restyle the call components (controls, tiles, tray) using `@gossip/ui`
  tokens and components. This is the intended path per `CLAUDE.md §7`.
- **Jitsi IFrame:** you can only theme via Jitsi `configOverwrite` / `interfaceConfigOverwrite`
  (colors, hidden buttons, toolbar). Full restyling is **not** possible inside the iframe. Apply the
  theming you can, then mark the task `[!]` "full call-UI restyle needs LiveKit migration — human
  decision required (CLAUDE.md §7 specifies LiveKit as primary)." Do not migrate stacks in an
  unattended loop.

**Acceptance:** Call surface visually matches the styleguide (or, for Jitsi, themed as far as the
iframe allows with the limitation flagged). Styleguide route itself unchanged. See `CHECKUP.md#T-07`.

---

### [x] T-08 — Start a call from a DM (not just channels) · Effort M · Risk Med
**Goal:** Allow starting a 1:1 call inside a private DM.

**Approach:** Generalize the call target from "channel only" to a **call target** that can be a
channel **or** a DM conversation. Add a call button to the DM header. Derive a stable room name from
the conversation id. Reuse the existing call surface/provider. Do not weaken the DM privacy model
(call signaling/room naming must not leak DM content; use opaque ids).

**Acceptance:** From a DM you can start/join a call with the other participant; channel calls still
work. See `CHECKUP.md#T-08`.

---

### [x] T-09 — Channel message edit + delete · Effort M · Risk Med
**Goal:** Edit and delete for **channel** messages (the "traditional" path).

**Approach:** Use the `ChannelMessage` model (`CLAUDE.md §9`). Add `editedAt` / soft-delete
(`deletedAt` or a `deleted` state) additively via Drizzle migration. Edit updates body + timestamp and
re-fans-out via the relay; delete soft-deletes and renders "message deleted." Only the author (or an
admin per role) can edit/delete. Keep local DB + relay consistent.

**Acceptance:** Author can edit (shows "edited") and delete (shows tombstone) a channel message;
permissions enforced; persists across reload. See `CHECKUP.md#T-09`.

---

### [x] T-10 — DM message edit + delete (capability-gated) · Effort M · Risk Med
**Goal:** Edit/delete for **DM** messages **iff** the Gossip SDK supports it.

**Approach:** From FINDINGS, check whether `gossip-sdk` exposes message edit/delete/retract.
- **If yes:** implement via the SDK only; never bypass the crypto boundary; mirror local DB state.
- **If no / SDK not vendored:** mark `[!]` "gossip-sdk has no message-mutation API (or not vendored)
  — flagged for devs; Phase 2 prerequisite." **Do not** implement a fake local-only edit that
  desyncs from the E2E channel.

**Acceptance:** Either working SDK-backed edit/delete in DMs, or a clean BLOCKED with the SDK gap
documented in `ralph/PROGRESS.md`. See `CHECKUP.md#T-10`.

---

### [x] T-11 — AI rewrite suggestions (local model) · Effort M · Risk Med
**Goal:** "Improve this message" suggestions on the user's **own draft**, via the local AI.

**Approach:** Add a composer action that sends the **current draft text only** to OpenClaw via
`packages/openclaw-bridge`, pinned to the **local** route, and shows suggestion(s) the user can accept
/ edit / dismiss. **Privacy (non-negotiable):** operate only on the user's own unsent draft; never on
received messages; for a DM draft, **local route only**, never cloud, never persisted, never logged.
No API keys in the frontend.

**Acceptance:** From the composer the user gets a local-model rewrite of their own draft; accepting
replaces the draft; nothing is sent to the cloud route for DM drafts; no received-message content is
read. See `CHECKUP.md#T-11`.

---

### [x] T-12 — Basic audio device settings · Effort M · Risk Med
**Goal:** Let users choose mic/speaker and toggle standard browser audio processing.

**Approach (LiveKit/custom only — if Jitsi-iframe, mark `[!]` deferring to the stack note in T-15):**
Enumerate devices (`navigator.mediaDevices.enumerateDevices`), let the user pick **input** (mic) and
**output** (speaker via `setSinkId` where supported), and toggle `echoCancellation`,
`noiseSuppression`, `autoGainControl` getUserMedia constraints. Persist selection to settings. Put it
on a call-settings panel styled with `@gossip/ui`.

**Acceptance:** User can select mic + speaker and toggle the three constraints; selection persists and
takes effect on the active/next call. See `CHECKUP.md#T-12`.

---

### [x] T-13 — Inline file / media attachments (channels; DM sub-part blocked: no SDK attachment API) · Effort L · Risk Med
**Goal:** Attach files/images to messages (wired to the T-03 "+" menu).

**Approach:**
- **Channels:** upload via the relay/channel transport; store an attachment ref on `ChannelMessage`;
  render image previews + generic file cards; enforce size/type limits.
- **DMs:** capability-gate on `gossip-sdk` attachment support (FINDINGS). If unsupported, mark that
  sub-part BLOCKED and ship channels-only, noting the gap. **Do not** send DM attachments in the
  clear around the E2E boundary.
This is **inline message attachments only** — the full Files mini-app (Nextcloud/Storj, `CLAUDE.md`
Phase 7) is explicitly out of scope for this loop.

**Acceptance:** In channels, attach an image + a file, they upload and render; DMs either work via SDK
or are cleanly deferred. Size/type limits enforced. See `CHECKUP.md#T-13`.

---

### [x] T-14 — Persistent call + Discord-style call dock · Effort L · Risk High
**Goal:** A call no longer ends when you navigate away; a mini call controller lives in the sidebar.

**Approach (architectural — the big one):** Lift call/media state out of the route component into a
**top-level provider** in `apps/web/src/app/**` (above the router) plus a global **Zustand call
store**, so the LiveKit Room / media session survives route changes. Add a persistent **CallDock** in
the shell/left sidebar (mute, cam, screenshare, leave, "return to call") shown whenever a call is
active, Discord-style. Ensure exactly one active session, clean teardown on leave, and no duplicate
media on remount. (If Jitsi-iframe: keeping the iframe mounted across routes is required — mark `[!]`
if the current shell can't host a persistent iframe without a larger refactor, and document what's
needed.)

**Acceptance:** Start a call, navigate across channels/DMs/settings — call stays connected, audio
continues, dock controls work, leaving fully tears down. No duplicate sessions. See `CHECKUP.md#T-14`.

---

### [x] T-15 — Advanced audio: noise gate / VAD / gain · Effort L · Risk High
**Goal:** Advanced audio: noise gate, voice-activity detection, per-device gain.

**Approach (LiveKit/custom only):** Build a Web Audio processing graph
(`getUserMedia → AudioWorklet noise gate + gain → destination/track`), add a threshold-based **noise
gate** and simple **VAD**, expose controls (threshold, gain) in advanced settings. If the app is
**Jitsi-iframe**, this is **not feasible** in-iframe — mark `[!]` "requires LiveKit-level track
control; blocked on stack (CLAUDE.md §7 specifies LiveKit as primary)."

**Acceptance:** With LiveKit, a working noise gate + gain audibly affects the outgoing track and
settings persist; otherwise a clean BLOCKED with rationale. See `CHECKUP.md#T-15`.

---

## 6. Notes for the human (Daniel)

- **Nothing is committed or pushed by the loop.** All of Ralph's work sits in your working tree as
  uncommitted changes. Failed tasks are auto-rolled-back in isolation (§3), so the tree should only
  ever contain *passing* task changes plus the `ralph/` bookkeeping files.
- **When you're happy after testing, commit it yourself:**
  ```bash
  git status                 # see everything Ralph changed
  git diff                   # review it
  pnpm dev:web               # test locally
  # if good — your own commit(s):
  git add -A
  git commit -m "feat: emoji, avatars, contact-sharing, ... (Ralph batch)"
  git push                   # only now does anything reach GitHub
  ```
- **To throw it all away:** `git checkout -- . && git clean -fd` (nukes every uncommitted change —
  make sure you have nothing else in-flight).
- **Track progress** via the `[x]`/`[!]` checkboxes above and `ralph/PROGRESS.md`.
- Several items you called "easy" are architectural (**T-14**), depend on the **LiveKit vs Jitsi**
  decision (**T-07/T-12/T-15**), or depend on **gossip-sdk** being vendored (**T-10/T-13 DMs**).
  They're ordered last / capability-gated so the loop banks the safe wins first and flags the rest
  instead of hacking around them. If lots block on "LiveKit vs Jitsi," make that call-stack decision
  (`CLAUDE.md §7 / §16.2`) before re-running.
