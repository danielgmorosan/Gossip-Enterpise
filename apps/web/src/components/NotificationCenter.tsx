import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Settings2, AtSign, MessageSquare, Users, Phone, Lock } from "lucide-react";
import { Tooltip } from "@gossip/ui/stack";
import { useNotifications, type AppNotification, type NotifType } from "@/stores/useNotifications";
import { cn } from "@/lib/utils";

const typeIcon: Record<NotifType, typeof Bell> = {
  message: MessageSquare,
  mention: AtSign,
  membership: Users,
  dm: Lock,
  call: Phone,
};

function relTime(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/**
 * Rail bell + notification inbox (T2-09): unread badge, read/unread state,
 * mark-all-read, and per-item deep links.
 */
export function NotificationCenter() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const items = useNotifications((s) => s.items);
  const unread = items.filter((n) => !n.read).length;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (n: AppNotification) => {
    useNotifications.getState().markRead(n.id);
    setOpen(false);
    nav(n.link);
  };

  return (
    <>
      <Tooltip label="Notifications" side="right">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
          aria-expanded={open}
          className={cn(
            "relative grid size-10 place-items-center rounded-control transition-colors",
            open ? "bg-field text-ink" : "text-ink-faint hover:bg-field hover:text-ink",
          )}
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-ink px-1 text-[9px] font-bold leading-4 text-paper">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </Tooltip>

      {open && (
        <div
          ref={panelRef}
          className="st-pop-in fixed bottom-4 left-[80px] z-50 flex max-h-[70vh] w-96 flex-col rounded-card border border-line bg-paper font-stack shadow-[var(--st-shadow-card)]"
        >
          <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Bell className="size-4 text-ink-mute" />
            <span className="text-[13.5px] font-semibold text-ink">Notifications</span>
            {unread > 0 && <span className="text-[11px] text-ink-faint">{unread} unread</span>}
            <div className="ml-auto flex items-center gap-0.5">
              <Tooltip label="Mark all read" side="bottom">
                <button
                  onClick={() => useNotifications.getState().markAllRead()}
                  aria-label="Mark all read"
                  className="grid size-7 place-items-center rounded-control text-ink-faint hover:bg-field hover:text-ink"
                >
                  <CheckCheck className="size-4" />
                </button>
              </Tooltip>
              <Tooltip label="Notification settings" side="bottom">
                <button
                  onClick={() => {
                    setOpen(false);
                    nav("/settings/notifications");
                  }}
                  aria-label="Notification settings"
                  className="grid size-7 place-items-center rounded-control text-ink-faint hover:bg-field hover:text-ink"
                >
                  <Settings2 className="size-4" />
                </button>
              </Tooltip>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-10 text-center text-[13px] text-ink-faint">Nothing yet. You're all caught up.</p>
            )}
            {items.map((n) => {
              const Icon = typeIcon[n.type];
              return (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={cn(
                    "flex w-full items-start gap-2.5 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-paper-2",
                    !n.read && "bg-field/40",
                  )}
                >
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-control bg-field text-ink-mute">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={cn("truncate text-[13px]", n.read ? "text-ink-mute" : "font-semibold text-ink")}>{n.title}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-ink-faint">{relTime(n.ts)}</span>
                    </span>
                    <span className="line-clamp-2 text-[12.5px] leading-snug text-ink-mute">{n.body}</span>
                  </span>
                  {!n.read && <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
