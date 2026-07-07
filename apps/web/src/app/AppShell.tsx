import { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { WorkspaceRail } from "./WorkspaceRail";
import { ChannelSidebar } from "./ChannelSidebar";
import { useRelay } from "@/stores/useRelay";

export function AppShell() {
  const { workspaceId } = useParams();

  useEffect(() => {
    if (workspaceId) useRelay.getState().openWorkspace(workspaceId);
  }, [workspaceId]);

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
