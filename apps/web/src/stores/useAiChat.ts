import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Gossip AI conversation memory (T3). Turns live here (persisted locally,
 * keyed per workspace / per channel panel) instead of component state, so
 * navigating away from the AI pane no longer wipes the conversation.
 * Local-only, like everything AI-related: nothing syncs anywhere.
 */
export interface AiTurn {
  role: "user" | "assistant";
  text: string;
  model?: string;
}

const CAP = 100; // turns kept per conversation

interface AiChatState {
  turnsByKey: Record<string, AiTurn[]>;
  append: (key: string, turn: AiTurn) => void;
  clear: (key: string) => void;
}

export const useAiChat = create<AiChatState>()(
  persist(
    (set) => ({
      turnsByKey: {},
      append: (key, turn) =>
        set((s) => ({
          turnsByKey: { ...s.turnsByKey, [key]: [...(s.turnsByKey[key] ?? []), turn].slice(-CAP) },
        })),
      clear: (key) =>
        set((s) => {
          const next = { ...s.turnsByKey };
          delete next[key];
          return { turnsByKey: next };
        }),
    }),
    { name: "gossip-ai-chat" },
  ),
);
