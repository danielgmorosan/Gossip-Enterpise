import { useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { User, Building2, Plug, Cpu, ShieldCheck, Bell, Palette, ArrowLeft, Headphones } from "lucide-react";
import { BrandLogo } from "@gossip/ui/stack";
import { cn } from "@/lib/utils";
import { useRelay } from "@/stores/useRelay";

const groups = [
  {
    label: "Account",
    items: [
      { to: "profile", icon: User, label: "Profile" },
      { to: "security", icon: ShieldCheck, label: "Security" },
      { to: "notifications", icon: Bell, label: "Notifications" },
      { to: "calls", icon: Headphones, label: "Calls & audio" },
      { to: "appearance", icon: Palette, label: "Appearance" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "workspace", icon: Building2, label: "Workspace" },
      { to: "integrations", icon: Plug, label: "Integrations" },
      { to: "ai-engine", icon: Cpu, label: "AI Engine" },
    ],
  },
];

export function SettingsLayout() {
  const myWorkspaces = useRelay((s) => s.myWorkspaces);
  const location = useLocation();
  // Where the user came from (rail links pass state.from). Captured once at
  // mount so switching settings tabs doesn't lose it; a fresh deep-link has
  // no state and falls back to the first workspace, then /home (DMs work
  // without any workspace).
  const [from] = useState(() => {
    const f = (location.state as { from?: string } | null)?.from;
    return typeof f === "string" && f.startsWith("/") ? f : null;
  });
  const backTo = from ?? (myWorkspaces[0] ? `/w/${myWorkspaces[0].id}` : "/home");
  const backLabel = backTo.startsWith("/w/") ? "Back to workspace" : "Back to messages";

  return (
    <div className="relative z-10 flex h-screen w-screen overflow-hidden bg-paper font-stack text-ink">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-line bg-paper-2">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-4">
          <BrandLogo src="/icon-mark.png" height={24} />
          <div>
            <div className="text-[14px] font-semibold text-ink">Settings</div>
            <div className="text-[11px] text-ink-faint">{myWorkspaces[0]?.name ?? "Gossip"}</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g.label} className="mb-5">
              <div className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                {g.label}
              </div>
              <div className="space-y-0.5">
                {g.items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-control px-2.5 py-1.5 text-[13px] transition-colors outline-none",
                        "focus-visible:ring-2 focus-visible:ring-[color:var(--st-ring)]",
                        isActive
                          ? "bg-field font-medium text-ink"
                          : "text-ink-mute hover:bg-field/60 hover:text-ink",
                      )
                    }
                  >
                    <it.icon className="size-4" />
                    {it.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <Link
          to={backTo}
          className="m-3 flex items-center gap-2 rounded-control border border-line px-3 py-2.5 text-[13px] text-ink-mute transition-colors hover:bg-field hover:text-ink"
        >
          <ArrowLeft className="size-4" /> {backLabel}
        </Link>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-paper">
        <div className="mx-auto max-w-3xl px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function SettingsPage({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
      {desc && <p className="mt-1.5 text-[14px] text-ink-mute">{desc}</p>}
      <div className="mt-8 space-y-6">{children}</div>
    </div>
  );
}
