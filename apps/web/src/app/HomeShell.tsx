import { Outlet } from "react-router-dom";
import { WorkspaceRail } from "./WorkspaceRail";
import { DmSidebar } from "./DmSidebar";
import { usePendingContactRedirect } from "@/lib/usePendingContactRedirect";
import { useDmNotifications } from "@/lib/useDmNotifications";

/**
 * Personal home space (/home) — Discord-style: DMs and DM calls live here,
 * fully outside any workspace. Same rail as the workspace shell (so switching
 * is one click), but the sidebar lists conversations instead of channels.
 */
export function HomeShell() {
  usePendingContactRedirect();
  useDmNotifications();

  return (
    <div className="relative z-10 flex h-screen w-screen overflow-hidden bg-paper font-stack text-ink">
      <WorkspaceRail />
      <DmSidebar />
      <main className="flex min-w-0 flex-1 flex-col bg-paper">
        <Outlet />
      </main>
    </div>
  );
}
