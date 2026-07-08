import { useEffect } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { WorkspaceRail } from "./WorkspaceRail";
import { ChannelSidebar } from "./ChannelSidebar";
import { useRelay } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { useContacts } from "@/stores/useContacts";
import { takePendingContact } from "@/lib/contact";

export function AppShell() {
  const { workspaceId } = useParams();
  const nav = useNavigate();
  const sessionOpen = useSession((s) => s.status === "open");

  useEffect(() => {
    if (workspaceId) useRelay.getState().openWorkspace(workspaceId);
  }, [workspaceId]);

  // Resolve a stashed contact link (/contact/:handle visited while locked):
  // once we're unlocked and inside a workspace, open the DM they asked for.
  useEffect(() => {
    if (!workspaceId || !sessionOpen) return;
    const pending = takePendingContact();
    if (!pending || pending.handle === useSession.getState().userId) return;
    const known = useContacts.getState().contacts.some((c) => c.userId === pending.handle);
    if (!known) void useContacts.getState().add(pending.handle, pending.name ?? pending.handle.slice(0, 12));
    nav(`/w/${workspaceId}/dm/${encodeURIComponent(pending.handle)}`);
  }, [workspaceId, sessionOpen, nav]);

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
