# Umbry self-host stack

Everything that isn't already end-to-end encrypted — channels, calls, files, and
AI — running on hardware you control.

DMs are **not** part of this. They ride the Gossip network E2EE whether you
self-host or not; there is nothing of ours in their path to replace.

## Most people don't need this

The desktop app self-hosts **without Docker**: Settings → Self-hosting →
Self-hosted → **Start**. The relay is bundled (Electron already ships a Node
runtime, so it's a 0 MB download), and LiveKit (~17 MB) and Ollama are fetched
on demand and checksum-verified. No admin rights, no WSL2, nothing installed
system-wide. See `apps/desktop/src/nativeStack.ts`.

**This compose stack is for the other case:** one shared box hosting a whole
team, where you want the services supervised by Docker rather than by somebody's
desktop app being open.

In the desktop app you can still reach it via the "Running a shared server for
your team?" link, which writes the `.env` (generating fresh LiveKit credentials)
and runs the compose project for you.

## By hand

```bash
cd services/selfhost
cp .env.example .env      # then fill in LIVEKIT_API_KEY / LIVEKIT_API_SECRET
docker compose up -d
```

Generate the LiveKit pair with:

```bash
openssl rand -hex 16      # LIVEKIT_API_KEY
openssl rand -hex 32      # LIVEKIT_API_SECRET
```

Then point Umbry at `http://localhost:8788` in **Settings → Self-hosting**.

## What's in it

| Service | Port | Role |
|---|---|---|
| `relay` | 8788 | Channels, uploads, LiveKit tokens, AI gateway |
| `livekit` | 7880 (+7881 TCP, 50000-50100/UDP) | Voice, video, screen share |
| `ollama` | internal only | The local AI model |

The relay reaches Ollama over the compose network (`OLLAMA_URL=http://ollama:11434`),
which is what makes AI work at all — a *managed* relay runs on our hardware and
cannot reach a model on your machine.

Ollama is deliberately **not** published to the host: it has no authentication,
and exposing it on a network is a bad default.

## Letting teammates connect

`UMBRY_HOST` in `.env` is the address **clients** use to reach this box. It
defaults to `localhost`, which only works for you.

- **LAN:** set it to your machine's LAN IP, e.g. `UMBRY_HOST=192.168.1.42`.
- **Internet:** set it to your domain, and put the relay behind HTTPS — the
  encrypted-messaging WASM needs a secure context, so plain HTTP will fail for
  anyone not on `localhost`. Pin `CORS_ORIGIN` to your app's origin at the same
  time; that also locks WebSocket upgrades to the same allowlist.

If calls connect but nobody can hear anything, `UMBRY_HOST` is almost always the
culprit — LiveKit advertises it as the media address.

## AI models

Pull them from **Settings → AI Engine**, which streams real download progress.
Models land on the machine running the relay, not on the client.

`AI_MODEL` in `.env` picks the active one. CPU inference works but is slow; on an
NVIDIA box, uncomment the GPU block in `docker-compose.yml` (needs the NVIDIA
Container Toolkit).

## Data

Two named volumes: `relay_data` (workspaces, channel history, uploads) and
`ollama_models` (downloaded weights). `docker compose down` stops the containers
but keeps both — use `down -v` only if you genuinely want to erase everything.
