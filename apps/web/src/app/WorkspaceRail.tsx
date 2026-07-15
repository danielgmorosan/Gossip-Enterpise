import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Plus, Mail, Calendar, FileText, NotebookPen, Video, Settings, LogOut, Trash2 } from "lucide-react";
import { BrandLogo, Tooltip } from "@gossip/ui/stack";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ContextMenu, ConfirmDialog } from "@/components/ContextMenu";
import { StatusMenu } from "@/components/StatusMenu";
import { useRelay, type MyWorkspace } from "@/stores/useRelay";
import { longPressProps } from "@/lib/longPress";
import { useNotifications } from "@/stores/useNotifications";
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
  const { pathname } = useLocation();
  const onHome = pathname.startsWith("/home");
  const myWorkspaces = useRelay((s) => s.myWorkspaces);
  // DM unread total badges the home (DM) button, Discord-style.
  const dmUnread = useNotifications((s) => Object.values(s.unreadByDm).reduce((a, b) => a + b, 0));

  // Right-click a workspace (T3): leave it, or delete it if you're the owner.
  const nav = useNavigate();
  const [menu, setMenu] = useState<{ x: number; y: number; ws: MyWorkspace } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "leave" | "delete"; ws: MyWorkspace } | null>(null);
  const confirmAction = async (): Promise<string | null> => {
    if (!confirm) return null;
    const res =
      confirm.kind === "delete"
        ? await useRelay.getState().deleteWorkspace(confirm.ws.id)
        : await useRelay.getState().leaveWorkspace(confirm.ws.id);
    if (!res.ok) return res.error;
    if (workspaceId === confirm.ws.id) nav("/home");
    return null;
  };

  return (
    <aside className="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 border-r border-line bg-paper-2 py-3 font-stack">
      {/* Personal home (Discord-style): brand button = DMs, outside any workspace. */}
      <Tooltip label="Direct messages" side="right" className="mb-1">
      <Link to="/home" className="group relative flex items-center justify-center">
        <span
          className={cn(
            "absolute -left-2 w-1 rounded-r-full bg-ink transition-all",
            onHome ? "h-7 opacity-100" : "h-0 opacity-0 group-hover:h-3 group-hover:opacity-60",
          )}
        />
        <span
          className={cn(
            "grid size-11 place-items-center rounded-card transition-all",
            onHome ? "rounded-control bg-field ring-1 ring-line-strong" : "hover:rounded-control hover:bg-field",
          )}
        >
          <BrandLogo src="/icon-mark.png" height={26} alt="Gossip" className="transition-transform group-hover:scale-105" />
          {dmUnread > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-ink px-1 text-[9px] font-bold leading-4 text-paper">
              {dmUnread > 99 ? "99+" : dmUnread}
            </span>
          )}
        </span>
      </Link>
      </Tooltip>

      <div className="my-1 h-px w-8 bg-line" />

      <div className="flex flex-col items-center gap-2.5">
        {myWorkspaces.map((w) => (
          <Tooltip key={w.id} label={w.name} side="right">
            <Link
              to={`/w/${w.id}`}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, ws: w });
              }}
              {...longPressProps((x, y) => setMenu({ x, y, ws: w }))}
              className="group relative flex items-center justify-center"
            >
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
          </Tooltip>
        ))}
        <Tooltip label="Create or join a workspace" side="right">
          <Link
            to="/workspace/create"
            aria-label="Create or join a workspace"
            className="grid size-11 place-items-center rounded-card border border-dashed border-line-strong text-ink-mute transition-all hover:rounded-control hover:border-ink hover:text-ink"
          >
            <Plus className="size-5" />
          </Link>
        </Tooltip>
      </div>

      {/* Mini-app dock - workspace-scoped, so only shown inside one */}
      {workspaceId && (
        <>
          <div className="my-1 h-px w-8 bg-line" />
          <div className="flex flex-col items-center gap-1.5">
            {dock.map((d) => (
              <Tooltip key={d.id} label={d.label} side="right">
                <Link
                  to={`/w/${workspaceId}/apps/${d.id}`}
                  aria-label={d.label}
                  className="grid size-10 place-items-center rounded-control text-ink-faint transition-colors hover:bg-field hover:text-ink"
                >
                  <d.icon className="size-[18px]" />
                </Link>
              </Tooltip>
            ))}
          </div>
        </>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          header={menu.ws.name}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Leave workspace",
              icon: <LogOut className="size-4" />,
              onClick: () => setConfirm({ kind: "leave", ws: menu.ws }),
            },
            {
              label: "Delete workspace (owner)",
              icon: <Trash2 className="size-4" />,
              danger: true,
              onClick: () => setConfirm({ kind: "delete", ws: menu.ws }),
            },
          ]}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.kind === "delete" ? `Delete "${confirm.ws.name}"?` : `Leave "${confirm.ws.name}"?`}
          body={
            confirm.kind === "delete"
              ? "This permanently deletes the workspace for EVERYONE: all channels, messages, and uploads. There is no undo."
              : "You'll lose access to its channels until someone invites you back. Your E2E DMs are unaffected."
          }
          confirmLabel={confirm.kind === "delete" ? "Delete workspace" : "Leave workspace"}
          onConfirm={confirmAction}
          onClose={() => setConfirm(null)}
        />
      )}

      <div className="mt-auto flex flex-col items-center gap-2">
        <NotificationCenter />
        <Tooltip label="Settings" side="right">
          <Link
            to="/settings/profile"
            state={{ from: pathname }}
            aria-label="Settings"
            className="grid size-10 place-items-center rounded-control text-ink-faint transition-colors hover:bg-field hover:text-ink"
          >
            <Settings className="size-[18px]" />
          </Link>
        </Tooltip>
        <StatusMenu />
      </div>
    </aside>
  );
}
