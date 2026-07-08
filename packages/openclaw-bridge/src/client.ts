import type { AiJobRequest, AiJobResult, GatewayHealth, RewriteRequest, RewriteResult } from "./types";

export interface OpenClawClientOptions {
  /** Base URL of the OpenClaw gateway, e.g. http://127.0.0.1:8787 */
  baseUrl: string;
  /** Bearer/session token issued to the signed-in member. */
  token?: string;
  /** Use the in-memory mock instead of network calls (UI dev / offline). */
  mock?: boolean;
  fetchImpl?: typeof fetch;
}

/**
 * Typed client for the OpenClaw gateway. The frontend only ever talks to OpenClaw
 * through this — model API keys live in the gateway, never the bundle.
 */
export class OpenClawClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly mock: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OpenClawClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token;
    this.mock = opts.mock ?? false;
    // Bind fetch to globalThis — storing it as a class property and calling
    // `this.fetchImpl(...)` would otherwise invoke it with `this` = the client
    // instance ("'fetch' called on an object that does not implement Window").
    this.fetchImpl = (opts.fetchImpl ?? globalThis.fetch).bind(globalThis);
  }

  async health(): Promise<GatewayHealth> {
    if (this.mock) return mockHealth();
    return this.get<GatewayHealth>("/health");
  }

  /** Run an AI job (recap / notes / qa). Scope is enforced server-side too. */
  async runJob(req: AiJobRequest): Promise<AiJobResult> {
    if (this.mock) return mockJob(req);
    return this.post<AiJobResult>("/jobs", req);
  }

  /**
   * Rewrite the user's OWN unsent draft. Local route only (typed + enforced
   * by the gateway) — never cloud, never persisted, never logged.
   */
  async rewriteDraft(req: RewriteRequest): Promise<RewriteResult> {
    if (this.mock) {
      await delay(300);
      return { text: req.draft.trim(), route: "local", createdAt: new Date().toISOString() };
    }
    return this.post<RewriteResult>("/rewrite", req);
  }

  /** Stream tokens for an interactive ask. Falls back to runJob when not streaming. */
  async *streamJob(req: AiJobRequest): AsyncGenerator<string, void, unknown> {
    if (this.mock) {
      const { text } = await mockJob(req);
      for (const chunk of text.split(/(?<=\s)/)) {
        await delay(12);
        yield chunk;
      }
      return;
    }
    const res = await this.fetchImpl(`${this.baseUrl}/jobs/stream`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(req),
    });
    if (!res.body) throw new Error("No stream body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  }

  private headers(): HeadersInit {
    return {
      "content-type": "application/json",
      ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
    };
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`OpenClaw ${path}: ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenClaw ${path}: ${res.status}`);
    return res.json() as Promise<T>;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mockHealth(): GatewayHealth {
  return {
    ok: true,
    defaultRoute: "local",
    ollama: { reachable: true, baseUrl: "http://127.0.0.1:11434", model: "qwen2.5:14b" },
    anthropic: { configured: false },
  };
}

async function mockJob(req: AiJobRequest): Promise<AiJobResult> {
  await delay(400);
  return {
    id: `job_${Math.random().toString(36).slice(2, 8)}`,
    type: req.type,
    route: req.route ?? "local",
    text:
      req.type === "recap"
        ? "Recap (scoped to your channels): the team aligned on dark + mint theming, monospace for cryptographic identity, and distinct E2E-DM vs. confidential-channel headers."
        : req.type === "notes"
          ? "Meeting notes: 1) Relay seam shipped. 2) DMs stay E2E. Action items: add per-workspace relay URL setting."
          : "Based on the channels you can access, the pricing decision was deferred pending the relay self-host doc.",
    citations: req.channelScope.slice(0, 2).map((c, i) => ({ channelId: c, messageId: `m${i}`, ts: "09:1" + i })),
    createdAt: new Date().toISOString(),
  };
}
