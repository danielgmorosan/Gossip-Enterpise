# CHECKUP.md — verification protocol for the Ralph loop

Run this **after finishing a task, before you stop** (`RALPH.md §0 step 5`). Two parts:
- **Part A — Universal gate:** runs for *every* task. All must pass.
- **Part B — Task-specific checks:** find the section matching the task id you just did.

This loop **does not commit**. If anything in Part A or the relevant Part B section fails and you can't
fix it with a small, in-scope change: **restore the checkpoint** (`RALPH.md §3`) so only this task is
undone, mark the task `[!]` in `RALPH.md` with the reason, log it, and stop. Never leave broken
changes in the working tree. Never edit these checks to make them pass.

---

## Part A — Universal gate (every task)

### A1. Build health
- [ ] `pnpm install` completes cleanly **if** you changed dependencies (else skip).
- [ ] `pnpm typecheck` — **no new errors** vs the pre-task baseline. (Pre-existing unrelated errors
      don't block, but you must not add any.)
- [ ] `pnpm lint` — no new errors/warnings from your files.
- [ ] `pnpm build` — succeeds.
- [ ] If a relevant package has a `test` script, `pnpm --filter <pkg> test` passes.

### A2. Runtime smoke
- [ ] `pnpm dev:web` boots; the app loads at http://localhost:5173 with **no new console errors** on
      the screen(s) you changed.
- [ ] http://localhost:5173/dev/styleguide still renders and is **visually unchanged** (unless the
      task explicitly edits the design system). This is the brand-regression guard.
- [ ] If you can't drive a browser here, record the runtime/visual items as **"needs human eyeball"**
      in `ralph/PROGRESS.md` — do not claim they passed.

### A3. Guardrail audit (run `git diff --stat` and `git status` and read them)
- [ ] **No commit and no push happened.** `git log -1` shows the same HEAD as before this run; the
      working tree still holds your changes uncommitted. No remote was contacted.
- [ ] **No changes** under `vendor/gossip/**`, `**/gossip-sdk/**`, or `**/generated/wasm/**`.
- [ ] **No secrets** added to `apps/web/**` (grep your diff for `sk-`, `api_key`, `apiKey`, `secret`,
      `token`, `Bearer`).
- [ ] **No AI-reads-DM path** introduced: nothing sends received/stored DM content to OpenClaw or any
      model; any AI draft-rewrite is the user's own unsent draft on the **local** route only.
- [ ] **No `.env`, build output, or lockfile churn** that isn't intentional for this task.
- [ ] Monorepo boundaries respected (shared UI in `packages/ui`, AI via `openclaw-bridge`, mini-apps
      via `miniapp-sdk`).
- [ ] New channel UI does **not** claim/imply E2E (channels are "workspace-confidential").

### A4. Scope & hygiene
- [ ] The working-tree diff for this task touches **only** files needed for it (no drive-by
      refactors). Earlier tasks' uncommitted changes are still present and untouched.
- [ ] No `TODO`-that-lies, no fake/mock success paths standing in for a missing capability.
- [ ] The `ralph/.ralph_*` scratch files were cleaned up (and are gitignored).
- [ ] The task id is recorded in `ralph/PROGRESS.md`.

If A1–A4 all pass → proceed to the Part B section for your task.

---

## Part B — Task-specific checks

> For browser checks you can't automate, do them if you can drive a browser; otherwise mark
> "needs human eyeball" per A2.

### T-00 — Recon
- [ ] `ralph/FINDINGS.md` exists and answers **every** bullet in the task with real file paths.
- [ ] Call stack is stated unambiguously: **LiveKit** / **Jitsi-iframe** / **stub**.
- [ ] gossip-sdk message-mutation + attachment support is stated (with exported names or "absent").
- [ ] `vendor/gossip` presence and DM data source (real vs mock) are stated.
- [ ] No product code changed (diff is inside `ralph/` only).

### T-01 — Emoji picker
- [ ] Picker opens from the composer toolbar in **both** DM and channel views.
- [ ] Selecting an emoji inserts it **at the cursor** (not always end-of-text).
- [ ] Glyphs render in the chosen consistent set — spot-check 2–3 that they are **not** the OS default.
- [ ] Panel styled with `@gossip/ui` tokens (dark + mint); keyboard-navigable; closes on Esc/outside.

### T-02 — Bold / italic / code
- [ ] Toolbar buttons + Cmd/Ctrl-B / Cmd/Ctrl-I work; code + fenced code block produce correct output.
- [ ] Rendered messages show correct bold/italic/inline-code/code-block for both DM and channel.
- [ ] **XSS-safe:** input like `<img src=x onerror=alert(1)>` or `[x](javascript:...)` renders inert.
      No unsanitised `dangerouslySetInnerHTML`.

### T-03 — "+" popover
- [ ] "+" opens a branded popover in both composers; closes on outside-click/Esc; focus-trapped.
- [ ] "Attach" opens the OS file picker. If T-13 isn't done, upload is a visible no-op/"coming soon"
      — **not** a faked success.

### T-04 — Copy / share
- [ ] Copy + Share appear per-message in **both** DMs and channels.
- [ ] Copy puts the message text on the clipboard; Share yields a link (or text fallback if no
      per-message deep link exists — confirm it didn't invent a route).
- [ ] No changes to message storage/transport (check the diff).

### T-05 — Avatars
- [ ] A fresh identity gets a **deterministic** branded avatar (same seed → same avatar across
      reloads).
- [ ] **Regenerate** previews a new option and only persists on confirm.
- [ ] **Custom upload** validates type/size, downscales, persists, and survives reload.
- [ ] Avatar stored on the profile/member record; any Drizzle change is an **additive** migration.
- [ ] No avatar data or PII leaves the device.

### T-06 — Contact sharing
- [ ] "Share my contact" shows a copyable link **and** a scannable QR of that link.
- [ ] The link targets the **real** DM route (not an invented one) and shares only the **public**
      identity handle — nothing secret.
- [ ] Opening the link in-app resolves to starting/opening a DM with that identity.

### T-07 — Call UI restyle
- [ ] **LiveKit path:** call controls/tiles/tray use `@gossip/ui` tokens; matches `/dev/styleguide`
      look; no hard-coded off-brand colors.
- [ ] **Jitsi path:** theming applied via config only; task marked `[!]` with the iframe limitation
      documented. (Not a failure — an honest block.)
- [ ] `/dev/styleguide` itself unchanged.

### T-08 — DM calls
- [ ] A call can be started/joined from a DM; the other participant can join.
- [ ] **Channel calls still work** (regression check).
- [ ] Room naming uses opaque conversation ids — no DM content leaked into room names/signaling.

### T-09 — Channel edit/delete
- [ ] Author can edit a channel message; it shows an "edited" marker and persists.
- [ ] Author (or admin per role) can delete; a tombstone renders; persists across reload.
- [ ] Non-authors **cannot** edit/delete (permission enforced).
- [ ] Drizzle change is additive; local DB + relay stay consistent.

### T-10 — DM edit/delete
- [ ] **If SDK supports it:** edit/delete go through `gossip-sdk` only; local state mirrors; crypto
      boundary untouched.
- [ ] **If not:** task is `[!]` with the SDK gap written to `ralph/PROGRESS.md`; **no** fake
      local-only mutation was shipped.

### T-11 — AI rewrite
- [ ] Composer action returns a local-model rewrite of the user's **own draft**; accept replaces the
      draft, dismiss leaves it.
- [ ] Calls go through `packages/openclaw-bridge` on the **local** route; **no** DM draft hits the
      cloud route; nothing persisted/logged.
- [ ] No received-message content is ever read by the AI. No keys in the frontend.

### T-12 — Basic audio settings
- [ ] User can select **mic** and **speaker**; `setSinkId` used for output where supported.
- [ ] `echoCancellation` / `noiseSuppression` / `autoGainControl` toggles apply to the track.
- [ ] Selection persists and takes effect on the active/next call. (Jitsi-iframe → `[!]` per task.)

### T-13 — Attachments
- [ ] **Channels:** an image and a non-image file upload, persist (ref on `ChannelMessage`), and
      render (image preview + file card); size/type limits enforced with a clear error past the limit.
- [ ] **DMs:** works via SDK attachment API, **or** cleanly deferred `[!]` with the gap noted — no
      clear-text attachment sent around the E2E boundary.
- [ ] Full Files mini-app (Nextcloud/Storj) was **not** started (out of scope).

### T-14 — Persistent call + dock
- [ ] Start a call, then navigate across channel → DM → settings: the call **stays connected** and
      **audio continues**.
- [ ] The sidebar **CallDock** appears while active; mute/cam/screenshare/leave/return work.
- [ ] Leaving fully tears down (mic light off, no lingering tracks); **no duplicate sessions** after
      navigating/remounting.
- [ ] (Jitsi-iframe → `[!]` if the shell can't host a persistent iframe without a larger refactor,
      with required changes documented.)

### T-15 — Advanced audio
- [ ] Noise gate + gain audibly affect the **outgoing** track; VAD reflects speaking state.
- [ ] Threshold/gain controls persist.
- [ ] (Jitsi-iframe → `[!]` "requires LiveKit-level track control.")

---

## Part C — Recording results (every run)

Append to `ralph/PROGRESS.md` (no commit hash — nothing is committed):

```
## <ISO timestamp> — <task id>: <PASS | BLOCKED>
- What changed: <one or two sentences>
- Files: <key paths>  (left UNCOMMITTED in the working tree)
- Checkup: A1 ✔ A2 ✔ A3 ✔ A4 ✔ | B(<task>) ✔  (or note failures / "needs human eyeball")
- Notes / follow-ups / flags for Daniel: <…>
```

Then update the task's checkbox in `RALPH.md` (`[x]` done or `[!]` blocked + inline reason) and
**stop**. The loop will start the next task fresh.

## Part D — Stop conditions (halt, don't thrash)
- Same task fails checkup **twice** in a row after fix attempts → restore checkpoint, mark `[!]`, stop.
- Any guardrail in A3 would have to be broken to proceed → mark `[!]`, stop.
- A required capability (SDK API, LiveKit stack) is absent → mark `[!]` with the prerequisite, stop.
- All tasks `[x]`/`[!]` → write "ALL TASKS COMPLETE OR BLOCKED" to `ralph/PROGRESS.md`, stop.
