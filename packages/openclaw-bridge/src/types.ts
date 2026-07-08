/** Public contract for the OpenClaw gateway. Keys never live here — they stay in the gateway. */

export type AiRoute = "local" | "cloud";

export interface ModelInfo {
  id: string; // e.g. "qwen2.5:14b"
  provider: "ollama" | "anthropic";
  route: AiRoute;
}

export interface GatewayHealth {
  ok: boolean;
  defaultRoute: AiRoute;
  ollama: { reachable: boolean; baseUrl: string; model?: string };
  anthropic: { configured: boolean };
}

export type AiJobType = "recap" | "notes" | "qa";

export interface AiJobRequest {
  workspaceId: string;
  /** Channels the requester can access. The gateway must never exceed this scope. */
  channelScope: string[];
  type: AiJobType;
  prompt: string;
  /** Pin to a route; otherwise the gateway uses its default. */
  route?: AiRoute;
}

export interface AiCitation {
  channelId: string;
  messageId: string;
  ts: string;
}

export interface AiJobResult {
  id: string;
  type: AiJobType;
  route: AiRoute;
  text: string;
  citations: AiCitation[];
  createdAt: string;
}

export interface OpenClawError {
  code: "unauthorized" | "out_of_scope" | "gateway_unreachable" | "model_error";
  message: string;
}

/**
 * Draft rewriting ("improve this message"). Operates ONLY on the user's own
 * unsent draft and is pinned to the local route by type — the gateway refuses
 * anything else, so a DM draft can never reach a cloud provider. Drafts are
 * never persisted or logged.
 */
export interface RewriteRequest {
  /** The user's own unsent draft — the only content ever sent. */
  draft: string;
  /** Pinned: rewrites are local-model only. */
  route: "local";
}

export interface RewriteResult {
  text: string;
  route: "local";
  model?: string;
  createdAt: string;
}
