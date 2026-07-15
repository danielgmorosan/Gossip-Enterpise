import { Outlet, useMatch, useSearchParams } from "react-router-dom";
import { WorkspaceRail } from "./WorkspaceRail";
import { DmSidebar } from "./DmSidebar";
import { usePendingContactRedirect } from "@/lib/usePendingContactRedirect";
import { useDmNotifications } from "@/lib/useDmNotifications";
import { cn } from "@/lib/utils";

/**
 * Personal home space (/home) — Discord-style: DMs and DM calls live here,
 * fully outside any workspace. Same rail as the workspace shell (so switching
 * is one click), but the sidebar lists conversations instead of channels.
 *
 * Mobile split: /home shows rail+sidebar as the screen; a DM (or
 * /home?view=contacts, which the sidebar's Contacts row targets) takes over
 * full-screen with a back affordance in its header. Desktop shows both.
 */
export function HomeShell() {
  usePendingContactRedirect();
  useDmNotifications();

  const atRoot = !!useMatch({ path: "/home", end: true });
  const [params] = useSearchParams();
  const contactsView = params.get("view") === "contacts";
  const showMain = !atRoot || contactsView;

  return (
    <div className="relative z-10 flex h-dvh w-screen overflow-hidden bg-paper font-stack text-ink">
      <div className={cn("flex min-w-0 shrink-0 max-md:flex-1", showMain && "max-md:hidden")}>
        <WorkspaceRail />
        <DmSidebar />
      </div>
      <main className={cn("flex min-w-0 flex-1 flex-col bg-paper", !showMain && "max-md:hidden")}>
        <Outlet />
      </main>
    </div>
  );
}
