import { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { WorkspaceRail } from "./WorkspaceRail";
import { ChannelSidebar } from "./ChannelSidebar";
import { useRelay } from "@/stores/useRelay";
import { useContactsLive } from "@/stores/useContacts";
import { usePendingContactRedirect } from "@/lib/usePendingContactRedirect";
import { useDmNotifications } from "@/lib/useDmNotifications";

export function AppShell() {
  const { workspaceId } = useParams();

  useEffect(() => {
    if (workspaceId) useRelay.getState().openWorkspace(workspaceId);
  }, [workspaceId]);

  // Contacts stay live inside workspaces too (member DM shortcuts, avatars),
  // and stashed /contact/:handle links resolve to /home/dm from here as well.
  useContactsLive();
  usePendingContactRedirect();
  useDmNotifications();

  return (
    <div className="relative z-10 flex h-screen w-screen overflow-hidden bg-paper font-stack text-ink">
      <WorkspaceRail />
      <ChannelSidebar />
      <main className="flex min-w-0 flex-1 flex-col bg-paper">
        <Outlet />
      </main>
    </div>
  );
}
