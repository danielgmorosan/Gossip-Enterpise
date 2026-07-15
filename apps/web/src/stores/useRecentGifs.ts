import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Recently-picked GIFs (T3), most-recent first, capped. Local only. */
export interface RecentGif {
  id: string;
  preview: string;
  url: string;
}

const CAP = 16;

interface RecentGifsState {
  recent: RecentGif[];
  push: (gif: RecentGif) => void;
}

export const useRecentGifs = create<RecentGifsState>()(
  persist(
    (set) => ({
      recent: [],
      push: (gif) =>
        set((s) => ({
          recent: [gif, ...s.recent.filter((g) => g.id !== gif.id)].slice(0, CAP),
        })),
    }),
    { name: "gossip-recent-gifs" },
  ),
);
