# RALPH-2.md — Gossip Workspace autonomous task loop (batch 2)

Same loop, second batch of work. You are Claude Code running the **Ralph** pattern: each run, pick
**one** task from the backlog below, complete it, verify it, record progress, and **stop**. The loop
re-invokes you with fresh context for the next task.

## Shared rules — read these first, they apply unchanged
- `CLAUDE.md` (repo root) — product spec + architecture + privacy non-negotiables. Source of truth.
- `ralph/RALPH.md` **§0–§3** — the loop procedure, the **golden rules/guardrails**, the environment &
  commands, and (critically) the **NO-COMMIT policy + per-task checkpoint/restore** mechanism. All of
  it applies here verbatim. In particular:
  - **Never `git commit`, never `git push`, never touch the remote.** Leave work uncommitted in the
    working tree; the human tests and commits.
  - **Checkpoint at task start / restore-only-this-task on failure** (RALPH.md §3). Never
    `git checkout -- .` or `git clean -fd` blindly.
  - Never touch crypto/WASM (`vendor/gossip/**`, `**/gossip-sdk/**`, `**/generated/wasm/**`).
  - AI never sees DM content. No secrets in the frontend. Respect monorepo boundaries. Local-first.
  - Honest privacy/security labels. One task per run, small diffs, no drive-by refactors.
- `ralph/CHECKUP.md` **Part A** (universal gate) — run it **after every task**, before you stop. Then
  run the task-specific checks in **§Checkups** at the bottom of *this* file.

Progress is tracked by the `[x]`/`[!]` checkboxes here and by `ralph/PROGRESS.md`. If a task can't be
done safely, restore the checkpoint, mark it `[!]` with a reason, log it, stop. Never fake a result.

---

## Batch-2 guardrails (in addition to the shared ones)

1. **Access control is a server concern, not a CSS trick.** Tasks T2-07 (roles/bans) and T2-08
   (invite-only private channels) are only *real* if enforced at the **relay** (`services/relay`) /
   transport, not just hidden in the client. If the relay can't yet enforce membership/role/ban
   checks, implement the data model + management UI + client-side gating, but mark the **enforcement**
   sub-part `[!]` "relay enforcement required — client gating is UX only, not a security boundary,"
   and say so plainly in any UI (per the "honest labels" rule). Do **not** ship UI that implies a
   channel is secured when only the client hides it.

2. **The em-dash sweep (T2-01) must not touch code.** Only rewrite user-visible copy. Never alter
   operators, CSS, ranges, generated files, lockfiles, dependencies, or the `ralph/`/`CLAUDE.md` docs.
   Review every hit; a blind global replace is forbidden.

3. **This batch overlaps batch 1.** T2-06 (call UI layout) overlaps `RALPH.md` T-07 (call brand
   restyle). Check whether T-07 has run (`ralph/PROGRESS.md`): if yes, T2-06 focuses on layout,
   tile-sizing, dark-mode button fixes, and the chat panel; if no, T2-06 does the branded restyle
   *and* the layout. Don't undo T-07's work.

---

## Task backlog (batch 2)

Legend: `[ ]` todo · `[x]` done · `[!]` blocked (reason inline). Effort S/M/L · Risk Low/Med/High.
Do top-to-bottom: recon → safe reversible wins → medium UI → heavy security/architecture last.

---

### [x] T2-00 — Recon for batch 2 (no feature code) · Effort S · Risk Low
**Goal:** Append a "## Batch 2 recon" section to `ralph/FINDINGS.md` so later tasks branch correctly.
No product code changes.

**Record, with real paths + short quotes:**
- Every source file under `apps/web/**` and `packages/ui/**` containing an em dash `—` (U+2014).
  Command: `grep -rInP "\x{2014}" apps/web packages/ui` (also note en dash `–` U+2013 hits). Classify
  each hit as **copy** (rewrite) or **code/keep**.
- Does `@gossip/ui` already export a **Tooltip**/`title` primitive? Path + API, or "absent."
- The **two code formatters** the human mentions: find both, their component/lib, and *why* each is
  broken. Is any syntax-highlighter present (Shiki/Prism/highlight.js)?
- Routes/pages that **lack a back button** (settings subpages, profile, channel/member management,
  etc.). List the route → component paths.
- Channel model: is there a public/private/visibility field? Membership model? Where is join/entry
  gated today (client only? relay?). Path in `db/**`, `features/channels/**`, `services/relay/**`.
- Workspace **roles** today: does `WorkspaceMember` (CLAUDE.md §9) carry a role? What values? Any
  permission or ban tables? Where are role checks enforced (if anywhere)?
- **@mention** handling: is there existing parsing/linkifying of `@name`? Where? Is there a member
  list to drive an autocomplete?
- **Notifications:** any existing store/stream/toaster/unread-count infra? Event sources available
  (message stream, channel membership events, DM invites, call start signals)?
- **Call UI:** stack (LiveKit / Jitsi-iframe / stub), the call components + layout files, where the
  mic/cam buttons and video tiles are styled, and whether a text-chat panel exists in the call view.

**Acceptance:** `ralph/FINDINGS.md` answers every bullet with real paths. Diff is inside `ralph/` only.

---

### [x] T2-01 — Remove em dashes from visible copy · Effort M · Risk Med
**Goal:** No `—` in user-facing text (it "reads too AI"). Replace with natural punctuation.

**Approach:** From FINDINGS, go hit-by-hit through the **copy** occurrences only. Replace each `—`
with the right fix for the sentence: a comma, colon, parentheses, or " - " (spaced hyphen) — whatever
reads naturally; rewrite the phrase if needed. **Skip** anything classified code/keep, plus
`node_modules`, `vendor`, `dist`, generated files, lockfiles, and the `ralph/`+`CLAUDE.md` docs.
(Optional: do the same for stray en dashes `–` used as punctuation.) Do not introduce a lint rule or
mass-`sed`; this is a reviewed edit.

**Acceptance:** `grep -rInP "\x{2014}" apps/web packages/ui` returns only intentional code/keep hits
(document any); the UI reads naturally; nothing non-copy changed. See §Checkups T2-01.

---

### [x] T2-02 — Tooltips on icon controls · Effort M · Risk Low
**Goal:** Hover/focus tooltips on bold, italic, and other icon-only controls across the app.

**Approach:** Use `@gossip/ui`'s tooltip if it exists (FINDINGS); else build one accessible tooltip
component (hover **and** keyboard focus, small open delay, `aria-describedby`, Esc to dismiss, themed
with tokens) and place it in `packages/ui`. Apply first to the composer toolbar (bold/italic/code/
emoji/attach/"+"), then sweep other icon-only buttons (call controls, headers, sidebar actions) and
give each a concise label.

**Acceptance:** Icon-only controls show a branded tooltip on hover and on keyboard focus; labels are
accurate; works in both DM and channel and in settings. See §Checkups T2-02.

---

### [x] T2-03 — Back buttons where navigation dead-ends · Effort S–M · Risk Low
**Goal:** Consistent back navigation on pages that currently strip it.

**Approach:** Add a shared `BackButton` (in `packages/ui` or `components/`) that navigates to the
sensible parent route (prefer an explicit parent over raw `history.back()` so deep-links behave), with
an icon + accessible label + tooltip (T2-02). Add it to each route FINDINGS flagged. Keep placement
consistent (top-left of the page/panel header).

**Acceptance:** Every flagged route has a working, consistent back affordance that lands on the right
parent even on a fresh deep-link load. See §Checkups T2-03.

---

### [x] T2-04 — Fix code blocks: highlight + one-click copy · Effort M–L · Risk Med
**Goal:** The two code formatters render correctly, look like a real code viewer, and have instant
copy.

**Approach:** From FINDINGS, fix the root cause of each broken formatter (don't paper over it).
Consolidate on one syntax highlighter — recommend **Shiki** (VS Code themes, "cool coder" look; run
its async highlight at render and cache) or **Prism**/`react-syntax-highlighter` if lighter is
preferred. Render code blocks in a themed container: monospace, dark code surface consistent with
`@gossip/ui`, optional language label, and a **Copy** button (top-right, copies raw source, shows a
"Copied" state). Keep inline code distinct from block code. Stay **XSS-safe** (highlighter must not
inject raw HTML from message content). Works in DM + channel.

**Acceptance:** Both code paths render highlighted; a Copy button copies the exact source with visible
feedback; inline vs block are visually distinct; no XSS. See §Checkups T2-04.

---

### [x] T2-05 — @mention autocomplete popover · Effort M · Risk Med
**Goal:** Typing `@` opens a filtered member picker with keyboard nav; selecting inserts a mention.

**Approach:** Detect the `@` trigger + query in the composer; show a branded popover listing workspace
members/contacts (from the existing member source in FINDINGS), filtering as the user types. Arrow-key
navigation, Enter/Tab to select, Esc to dismiss, click to select; small enter/exit animation. Insert a
**structured mention token** (id + display) that renders highlighted in the message and can drive
notifications (T2-09). If existing `@` parsing is separate, unify on this token. Accessible (listbox
semantics).

**Acceptance:** `@` opens the picker, filters live, keyboard + mouse selection work, the inserted
mention renders highlighted and resolves to a real member. See §Checkups T2-05.

---

### [x] T2-06 — Call UI layout: sizing, dark-mode buttons, chat panel · Effort L · Risk Med–High
**Goal:** A Discord-like call view: reasonably-sized video tiles (not full-screen), themed controls
(mic/cam not white-on-dark), and text chat within the call.

**Approach (branch on call stack — FINDINGS; coordinate with batch-1 T-07 per Batch-2 guardrail #3):**
- **LiveKit / custom UI:** replace the oversized video with a responsive **participant grid** (tiles
  cap at a sane max size and reflow by count); restyle mic/cam/screenshare/leave controls with
  `@gossip/ui` tokens so they read correctly in dark mode (no white blobs); add a **text-chat panel**
  under/beside the call (reuse the message composer + list). Speaking indicator, mute state, and a
  compact layout when few participants.
- **Jitsi-iframe:** tile sizing and internal chat are the iframe's; you can only adjust container
  size + `interfaceConfigOverwrite`. Do what the iframe allows, then mark `[!]` "Discord-style call
  layout + in-call chat need LiveKit-level control (CLAUDE.md §7)."

**Acceptance:** Video tiles are appropriately sized and reflow; controls look correct in dark mode;
text chat is usable during a call (LiveKit path); or a clean `[!]` for Jitsi with rationale. See
§Checkups T2-06.

---

### [x] T2-07 — Workspace roles, permissions & bans · Effort L · Risk High
**Goal:** Owner / Administrator / Member roles; Owner picks an Admin's permissions when promoting;
ban/unban users.

**Approach:** Model roles on `WorkspaceMember` (CLAUDE.md §9): **Owner** (the creator; exactly one,
transferable later), **Administrator** (granular permissions the Owner selects at promotion —
e.g. manage channels, manage members, manage roles, ban), **Member**. Add a **ban** record
(banned user + reason + who/when) that blocks access and rejoin. Build the management UI (members list
with role + permission editor + ban/unban), gated so only Owner assigns Admins/permissions and only
Owner/permitted-Admins ban. **Enforcement:** per Batch-2 guardrail #1 — enforce at `services/relay`;
if not feasible now, ship model + UI + client gating and mark the enforcement sub-part `[!]` with a
clear "not yet a security boundary" note. Additive Drizzle migrations only.

**Acceptance:** Roles exist and display; Owner promotes to Admin with chosen permissions; ban blocks
access + rejoin; permission checks gate the actions; enforcement is real (relay) or explicitly flagged
as UX-only. See §Checkups T2-07.

---

### [x] T2-08 — Private channels are invite-only + managed · Effort L · Risk High
**Goal:** Private channels can't be entered by just anyone; membership is by invite; creator + Owner/
permitted-Admins manage them.

**Approach:** Extend the channel model with a real membership list for private channels. Only invited
members can view/join/read; non-members can't enter or see contents. Build an **invite** flow (invite
by member; optionally an invite link/code) and a **manage members** panel (add/remove) gated by
creator + role permissions (depends on **T2-07**). Per Batch-2 guardrail #1, gate at the **relay** so
non-members genuinely can't fetch messages; if relay enforcement isn't available, do model + invite +
management + client gating and mark enforcement `[!]` "client gating only — not yet a security
boundary," and label the channel's privacy honestly in the UI (workspace-confidential, not E2E).
Additive migrations only.

**Acceptance:** A non-invited user cannot enter/read a private channel; invited members can; creator/
permitted roles manage membership; enforcement is real or explicitly flagged. See §Checkups T2-08.

---

### [x] T2-09 — Notifications system · Effort L · Risk Med–High
**Goal:** Notifications the site currently lacks: new messages (esp. @mentions), someone joining a
channel, being added to a DM, a call starting, etc.

**Approach:** Build an in-app notification layer first: a notifications **store** (Zustand) fed by the
existing event streams (message stream, channel-membership events, DM invites, call-start signals),
**toasts** for live events, a **notification center**/inbox with read/unread, and **unread badges** on
channels/DMs + a global count. Then, as additive sub-parts: OS-level **Web Notifications** (ask
permission, respect it) and an optional **sound**. Per-user **settings** to mute channels/DMs/types.
**Privacy:** DM notification content stays on-device; never send DM content anywhere; mentions come
from T2-05's structured tokens. Deep-link each notification to its source (message/channel/DM/call).

**Acceptance:** The listed events produce in-app notifications with correct unread state and working
deep-links; OS notifications + sound respect permission/settings; no DM content leaves the device.
See §Checkups T2-09.

---

## §Checkups (batch 2)

**Every task:** run `CHECKUP.md` **Part A** (build health, runtime smoke, guardrail audit incl.
"no commit/push happened," scope & hygiene). Then the matching block below. On failure: restore the
checkpoint (RALPH.md §3), mark `[!]`, log, stop.

**T2-00 — Recon:** `ralph/FINDINGS.md` has a "Batch 2 recon" section answering every bullet with real
paths; call stack, channel/role/membership model, mention parsing, notification infra, and the two
code formatters are each stated; diff is inside `ralph/` only.

**T2-01 — Em dashes:** `grep -rInP "\x{2014}" apps/web packages/ui` returns only documented code/keep
hits; each changed string reads naturally; no code/CSS/deps/generated/docs touched (verify via diff).

**T2-02 — Tooltips:** bold/italic/code + other icon-only controls show a tooltip on **hover and on
keyboard focus**; dismiss on Esc/blur; labels accurate; themed; works in DM, channel, settings.

**T2-03 — Back buttons:** each flagged route shows a back control that lands on the correct parent —
test on a **fresh deep-link load**, not just after in-app navigation; consistent placement; accessible.

**T2-04 — Code blocks:** both formatters render highlighted (previously-broken cases fixed at root);
Copy copies the **exact raw source** with visible feedback; inline vs block distinct; malicious code
content renders inert (no XSS); works in DM + channel.

**T2-05 — @mentions:** typing `@` opens the picker with live filtering; ↑/↓ + Enter/Tab select, Esc
closes, click works; inserted mention renders highlighted and resolves to a real member id; accessible
listbox semantics.

**T2-06 — Call UI:** video tiles are sized sensibly and reflow with participant count (not full-site);
mic/cam/screenshare/leave controls are correctly themed in **dark mode** (no white-on-dark blobs);
in-call text chat usable (LiveKit) — or `[!]` documented for Jitsi; batch-1 T-07 work not undone.

**T2-07 — Roles/bans:** Owner/Admin/Member display correctly; **only Owner** can promote to Admin and
pick permissions; permission checks actually gate each admin action; ban blocks access **and** rejoin;
unban restores; migrations additive; enforcement is at the relay **or** the enforcement sub-part is
`[!]` and the UI doesn't overclaim security.

**T2-08 — Private channels:** a **non-invited** account cannot enter or read a private channel; invited
members can; creator + permitted roles can add/remove members; privacy labeled honestly; enforcement
real (relay) **or** flagged `[!]` as client-only; migrations additive.

**T2-09 — Notifications:** new message (+ @mention), channel-join, DM-add, and call-start each generate
an in-app notification with correct unread state and a working deep-link; unread badges/counts update
and clear; OS notifications + sound respect permission/mute settings; **no DM content leaves the
device** (check the diff — nothing ships DM bodies to any transport/log/model).

---

## Notes for the human (Daniel)

- Nothing is committed/pushed; review the working-tree diff, test locally, then commit yourself
  (recipe in `RALPH.md §6`). Failed tasks self-rollback in isolation.
- **The heavy three are T2-07, T2-08, T2-09** — roles, invite-only channels, and notifications are
  data-model + enforcement work, not quick UI. They're ordered last and the security ones are gated on
  relay enforcement: if the relay can't enforce yet (Phase 0–1), the loop will build model + UI +
  client gating and flag "not yet a security boundary" rather than pretend. That flag is your cue to
  wire relay-side checks (`services/relay`) before relying on private channels/bans.
- T2-06 depends on the LiveKit-vs-Jitsi decision (same as batch-1 T-07/T-12/T-15). If it blocks on
  Jitsi, that's the signal to consolidate on LiveKit (`CLAUDE.md §7`).
- Run it the same way: `claude -p "$(cat ralph/RALPH-2.md)" --dangerously-skip-permissions` in a loop,
  on a throwaway branch, with `ralph/.ralph_*` gitignored.
