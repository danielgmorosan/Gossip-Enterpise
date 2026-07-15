import { useEffect } from "react";
import { Outlet, useParams, useMatch } from "react-router-dom";
import { WorkspaceRail } from "./WorkspaceRail";
import { ChannelSidebar } from "./ChannelSidebar";
import { useRelay } from "@/stores/useRelay";
import { useContactsLive } from "@/stores/useContacts";
import { usePendingContactRedirect } from "@/lib/usePendingContactRedirect";
import { useDmNotifications } from "@/lib/useDmNotifications";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { workspaceId } = useParams();
  // Discord-mobile split: at the workspace root the rail+sidebar ARE the
  // screen; a content route (channel, call, members…) takes over full-screen
  // and its header carries the back affordance. Desktop shows both, as ever.
  const atRoot = !!useMatch({ path: "/w/:workspaceId", end: true });

  useEffect(() => {
    if (workspaceId) useRelay.getState().openWorkspace(workspaceId);
  }, [workspaceId]);

  // Contacts stay live inside workspaces too (member DM shortcuts, avatars),
  // and stashed /contact/:handle links resolve to /home/dm from here as well.
  useContactsLive();
  usePendingContactRedirect();
  useDmNotifications();

  return (
    <div className="relative z-10 flex h-dvh w-screen overflow-hidden bg-paper font-stack text-ink">
      <div className={cn("flex min-w-0 shrink-0 max-md:flex-1", !atRoot && "max-md:hidden")}>
        <WorkspaceRail />
        <ChannelSidebar />
      </div>
      <main className={cn("flex min-w-0 flex-1 flex-col bg-paper", atRoot && "max-md:hidden")}>
        <Outlet />
      </main>
    </div>
  );
}
