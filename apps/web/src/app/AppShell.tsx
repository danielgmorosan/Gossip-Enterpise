import { useEffect } from "react";
import { Outlet, Navigate, useParams, useMatch } from "react-router-dom";
import { WorkspaceRail } from "./WorkspaceRail";
import { ChannelSidebar } from "./ChannelSidebar";
import { useRelay } from "@/stores/useRelay";
import { useContactsLive } from "@/stores/useContacts";
import { usePendingContactRedirect } from "@/lib/usePendingContactRedirect";
import { useDmNotifications } from "@/lib/useDmNotifications";
import { useLockGuard } from "@/lib/useLockGuard";
import { cn } from "@/lib/utils";
import { ScreenSourcePicker } from "@/components/call/ScreenSourcePicker";

export function AppShell() {
  const { workspaceId } = useParams();
  const locked = useLockGuard();
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

  if (locked) return <Navigate to="/identity/unlock" replace />;

  return (
    <div className="relative z-10 flex h-dvh w-screen overflow-hidden bg-paper font-stack text-ink">
      <div className={cn("flex min-w-0 shrink-0 max-md:flex-1", !atRoot && "max-md:hidden")}>
        <WorkspaceRail />
        <ChannelSidebar />
      </div>
      <main className={cn("flex min-w-0 flex-1 flex-col bg-paper", atRoot && "max-md:hidden")}>
        <Outlet />
      </main>
      {/* Desktop-shell screen-share picker (no-op in the browser). Lives here
          so it survives navigating away from the call view mid-share. */}
      <ScreenSourcePicker />
    </div>
  );
}
