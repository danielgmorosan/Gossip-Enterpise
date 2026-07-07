import { Outlet } from "react-router-dom";
import { ShieldCheck, Cpu, Network } from "lucide-react";
import { AuthLayout, DecorPanel, BrandLogo } from "@gossip/ui/stack";

const pillars = [
  { icon: ShieldCheck, title: "Truly private DMs", desc: "Post-quantum end-to-end encryption. No server can read them." },
  { icon: Cpu, title: "Your own AI", desc: "OpenClaw runs on a local model. Sensitive reasoning never leaves your machines." },
  { icon: Network, title: "No vendor to subpoena", desc: "Self-hostable relay and on-chain resilience on the Massa network." },
];

export function OnboardingLayout() {
  return (
    <AuthLayout
      panel={
        <DecorPanel align="start">
          <div className="flex h-full w-full max-w-md flex-col items-start">
            <div className="flex flex-1 flex-col justify-center">
              <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-ink">
                Slack, but the messages are <span className="text-ink-mute">actually private.</span>
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-mute">
                A decentralized, privacy-first workspace built on Gossip's end-to-end encrypted stack —
                with a self-hosted AI assistant you control.
              </p>

              <div className="mt-10 space-y-4">
                {pillars.map((p) => (
                  <div key={p.title} className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-control bg-field text-ink">
                      <p.icon className="size-[18px]" />
                    </span>
                    <div>
                      <div className="text-[14px] font-semibold text-ink">{p.title}</div>
                      <div className="text-[13px] text-ink-mute">{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="font-mono text-[11px] text-ink-faint">
              net.massa.gossip · no PII · passphrase identity
            </div>
          </div>
        </DecorPanel>
      }
    >
      <BrandLogo src="/icon.png" height={26} className="mb-8" />
      <Outlet />
    </AuthLayout>
  );
}
