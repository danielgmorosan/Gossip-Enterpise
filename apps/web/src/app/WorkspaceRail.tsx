import { Link, useParams } from "react-router-dom";
import { Plus, Mail, Calendar, FileText, NotebookPen, Video, Settings } from "lucide-react";
import { Avatar, BrandLogo } from "@gossip/ui/stack";
import { useRelay } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { cn } from "@/lib/utils";

const dock = [
  { id: "mail", icon: Mail, label: "Mail" },
  { id: "calendar", icon: Calendar, label: "Calendar" },
  { id: "files", icon: FileText, label: "Files" },
  { id: "notes", icon: NotebookPen, label: "Notes" },
  { id: "calls", icon: Video, label: "Calls" },
];

export function WorkspaceRail() {
  const { workspaceId } = useParams();
  const myWorkspaces = useRelay((s) => s.myWorkspaces);
  const displayName = useSession((s) => s.displayName) || "You";
  const userId = useSession((s) => s.userId);

  return (
    <aside className="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 border-r border-line bg-paper-2 py-3 font-stack">
      <Link to={workspaceId ? `/w/${workspaceId}` : "/welcome"} className="mb-1 grid size-10 place-items-center">
        <BrandLogo src="/icon-mark.png" height={28} alt="Gossip" className="transition-transform hover:scale-105" />
      </Link>

      <div className="my-1 h-px w-8 bg-line" />

      <div className="flex flex-col items-center gap-2.5">
        {myWorkspaces.map((w) => (
          <Link key={w.id} to={`/w/${w.id}`} title={w.name} className="group relative flex items-center justify-center">
            <span
              className={cn(
                "absolute -left-2 w-1 rounded-r-full bg-ink transition-all",
                w.id === workspaceId ? "h-7 opacity-100" : "h-0 opacity-0 group-hover:h-3 group-hover:opacity-60",
              )}
            />
            <span
              className={cn(
                "grid size-11 place-items-center rounded-card text-base font-bold transition-all",
                w.id === workspaceId
                  ? "rounded-control bg-field text-ink ring-1 ring-line-strong"
                  : "bg-field/60 text-ink-mute hover:rounded-control hover:bg-field hover:text-ink",
              )}
            >
              {w.name[0]?.toUpperCase() ?? "?"}
            </span>
          </Link>
        ))}
        <Link
          to="/workspace/create"
          title="Create or join a workspace"
          className="grid size-11 place-items-center rounded-card border border-dashed border-line-strong text-ink-mute transition-all hover:rounded-control hover:border-ink hover:text-ink"
        >
          <Plus className="size-5" />
        </Link>
      </div>

      <div className="my-1 h-px w-8 bg-line" />

      {/* Mini-app dock */}
      <div className="flex flex-col items-center gap-1.5">
        {dock.map((d) => (
          <Link
            key={d.id}
            to={workspaceId ? `/w/${workspaceId}/apps/${d.id}` : "/welcome"}
            title={d.label}
            className="grid size-10 place-items-center rounded-control text-ink-faint transition-colors hover:bg-field hover:text-ink"
          >
            <d.icon className="size-[18px]" />
          </Link>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-2">
        <Link to="/settings/profile" title="Settings" className="grid size-10 place-items-center rounded-control text-ink-faint transition-colors hover:bg-field hover:text-ink">
          <Settings className="size-[18px]" />
        </Link>
        <Link to="/settings/profile" title={displayName}>
          <Avatar name={displayName} id={userId ?? displayName} className="!size-9 !text-[13px]" />
        </Link>
      </div>
    </aside>
  );
}
