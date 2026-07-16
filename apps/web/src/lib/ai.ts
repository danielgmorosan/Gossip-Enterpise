// Gossip AI client. The frontend only ever talks to the gateway (relay) over HTTP -
// the model runs locally (Ollama) and only sees channel data, never DMs.
import { relayUrl } from "./relayBase";
import { relayAuthHeader } from "@/stores/useRelay";

export interface AiCitation {
  channelId: string;
  messageId: string;
  ts: string;
}
export interface AiResult {
  id: string;
  type: "recap" | "notes" | "qa";
  route: "local" | "cloud";
  model: string;
  text: string;
  citations: AiCitation[];
  createdAt: string;
}
export interface AiHealth {
  ok: boolean;
  route: "local" | "cloud";
  model: string;
  ollama: boolean;
  hasModel: boolean;
}

export async function aiHealth(): Promise<AiHealth> {
  return fetch(relayUrl("/openclaw/health")).then((r) => r.json());
}

export async function runAiJob(req: {
  workspaceId: string;
  channelScope: string[];
  type: "recap" | "notes" | "qa";
  prompt?: string;
}): Promise<AiResult> {
  const res = await fetch(relayUrl("/openclaw/jobs"), {
    method: "POST",
    headers: { "content-type": "application/json", ...relayAuthHeader() },
    body: JSON.stringify(req),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "AI request failed");
  return data as AiResult;
}
