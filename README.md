# Gossip Workspace

A decentralized, privacy-first Slack competitor on Gossip's E2E messaging stack. See
[`docs/SPEC.md`](docs/SPEC.md) for the full product spec.

## Monorepo layout (pnpm + Turborepo)

```
apps/
  web/                 # the workspace frontend (React 19 + Vite + Tailwind v4)
packages/
  ui/                  # @gossip/ui — shared design system (dark + mint, the brand)
  openclaw-bridge/     # @gossip/openclaw-bridge — typed client for the AI gateway
  miniapp-sdk/         # @gossip/miniapp-sdk — sandboxed host<->miniapp postMessage contract
  config/              # @gossip/config — shared tsconfig base
services/
  openclaw/            # OpenClaw gateway config + channel-plugin notes (sidecar)
  relay/               # optional self-hosted message-transfer relay (enterprise)
vendor/
  gossip/              # (to add) git submodule: massalabs/gossip @ dev — consume gossip-sdk
```

## Develop

```bash
pnpm install
pnpm dev          # all dev tasks via turbo
pnpm dev:web      # just the web app (http://localhost:5173)
pnpm typecheck
pnpm build
```

Copy `apps/web/.env.example` to `apps/web/.env` first.

## Status
Phase 0–1 UI built (mock data). Next: add the `vendor/gossip` submodule and wire `gossip-sdk` for
real E2E DMs (Phase 2).
