import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
// @ts-expect-error — vite-plugin-cross-origin-isolation has no .d.ts
import crossOriginIsolation from "vite-plugin-cross-origin-isolation";
import path from "node:path";

// COOP/COEP headers are required for SharedArrayBuffer, which the gossip-sdk
// secure-storage WASM (wasm-bindgen-rayon) needs. localhost is a secure context,
// so no HTTPS/mkcert is required in dev.
const coopCoep = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

// Dev backend for the channel relay (group chats, LiveKit tokens, uploads, AI).
// Defaults to the PRODUCTION Fly relay so local dev sees your real workspaces
// and joins real LiveKit calls. The relay pins CORS/WS to https://umbry.chat, so
// we proxy server-side (no browser CORS) and spoof that Origin on the forwarded
// request. To use a relay running locally instead:
//   RELAY_TARGET=http://localhost:8788 RELAY_ORIGIN= pnpm --filter @umbry/web dev
const RELAY_TARGET = process.env.RELAY_TARGET ?? "https://gossip-relay-danielgm.fly.dev";
const RELAY_ORIGIN = process.env.RELAY_ORIGIN ?? "https://umbry.chat";
const relayHttp = {
  target: RELAY_TARGET,
  changeOrigin: true,
  secure: true,
  ...(RELAY_ORIGIN ? { headers: { Origin: RELAY_ORIGIN } } : {}),
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crossOriginIsolation(),
    nodePolyfills({ protocolImports: true }),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Consume the SDK *source* so Vite processes its `new URL('*.wasm', import.meta.url)`
      // and serves the WASM correctly (mirrors gossip's own app). Types still come from
      // the package's dist .d.ts via tsc. The submodule must be built first.
      "@massalabs/gossip-sdk": path.resolve(
        __dirname,
        "../../vendor/gossip/gossip-sdk/src",
      ),
    },
  },
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    // wa-sqlite ships a .wasm that the dep optimizer doesn't relocate to
    // .vite/deps, so its runtime fetch 404s → HTML. Exclude it so it's served
    // from node_modules with its wasm intact. Same for the SDK (consumed as source).
    exclude: ["wa-sqlite", "@massalabs/gossip-sdk"],
  },
  server: {
    port: 5173,
    host: true, // bind 0.0.0.0 so a tunnel (cloudflared) can reach it
    allowedHosts: true, // accept the temporary *.trycloudflare.com host
    // Allow serving the gossip-sdk that lives in the submodule (outside apps/web).
    fs: { allow: [path.resolve(__dirname, "../..")] },
    headers: coopCoep,
    // Proxy the Gossip relay so the browser talks same-origin (api.usegossip.com
    // blocks CORS from localhost). The SDK uses protocolBaseUrl="/gossip-relay" in dev.
    proxy: {
      "/gossip-relay": {
        target: "https://api.usegossip.com",
        changeOrigin: true,
        secure: true,
        // The relay's API lives under /api (root returns "Gossip API v1 …").
        rewrite: (p) => p.replace(/^\/gossip-relay/, "/api"),
      },
      // Our own channel relay (group chats), WebSocket — see services/relay.
      "/group-ws": {
        ...relayHttp,
        target: RELAY_TARGET.replace(/^http/, "ws"),
        ws: true,
        rewrite: (p) => p.replace(/^\/group-ws/, ""),
      },
      // LiveKit token (signed server-side) + config, served by the relay.
      "/livekit-token": relayHttp,
      "/livekit-config": relayHttp,
      // OpenClaw AI gateway (lives in the relay; only sees channel data, never DMs).
      "/openclaw": relayHttp,
      // Channel attachments (upload + download), served by the relay.
      "/uploads": relayHttp,
      // Link previews (OG metadata for channel messages), served by the relay.
      "/unfurl": relayHttp,
      // Live call-room participant counts (DM call presence), served by the relay.
      "/room-count": relayHttp,
      // GIF search proxy (keeps the API key server-side), served by the relay.
      "/gif-search": relayHttp,
    },
  },
  preview: { headers: coopCoep },
  build: { target: "esnext" },
  worker: { format: "es" },
});
