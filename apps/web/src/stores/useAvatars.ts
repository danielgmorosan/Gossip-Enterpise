import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dicebearUri } from "@/lib/avatar";

/**
 * Local avatar choices, keyed by user handle. Local-first: persisted to
 * localStorage only - no avatar data or PII leaves the device. Without an
 * override, avatars are deterministic DiceBear identicons seeded by the
 * handle (so every device renders the same default for a given user).
 *
 * Known gap: a custom upload / reseed is visible only on this device until
 * the relay/member protocol carries avatars - peers still see the
 * deterministic default.
 */
export type AvatarOverride = { kind: "seed"; seed: string } | { kind: "image"; dataUrl: string };

interface AvatarsState {
  overrides: Record<string, AvatarOverride>;
  setOverride: (userId: string, override: AvatarOverride) => void;
  clearOverride: (userId: string) => void;
}

export const useAvatars = create<AvatarsState>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (userId, override) =>
        set((s) => ({ overrides: { ...s.overrides, [userId]: override } })),
      clearOverride: (userId) =>
        set((s) => {
          const next = { ...s.overrides };
          delete next[userId];
          return { overrides: next };
        }),
    }),
    { name: "gossip-avatars" },
  ),
);

export function resolveAvatarSrc(
  userId: string | null | undefined,
  overrides: Record<string, AvatarOverride>,
): string | undefined {
  if (!userId) return undefined;
  const o = overrides[userId];
  if (o?.kind === "image") return o.dataUrl;
  return dicebearUri(o?.kind === "seed" ? o.seed : userId);
}
