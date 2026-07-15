import { useEffect, useState } from "react";
import { gossipSdk, generateMnemonic } from "@/lib/sdk";

type StepState = { name: string; ok: boolean | null; detail?: string };

/** Dev-only smoke test: runs the full gossip-sdk crypto pipeline in the browser. */
export function SdkSmoke() {
  const [steps, setSteps] = useState<StepState[]>([
    { name: "1. init() - load WASM (crypto + wa-sqlite)", ok: null },
    { name: "2. generateMnemonic() - BIP39", ok: null },
    { name: "3. openSession() - derive keys", ok: null },
    { name: "4. selfMessages.send() - encrypt + store", ok: null },
    { name: "5. selfMessages.getMessages() - decrypt", ok: null },
  ]);
  const [userId, setUserId] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const set = (i: number, ok: boolean, detail?: string) =>
      !cancelled && setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ok, detail } : st)));

    (async () => {
      try {
        await gossipSdk.init({
          protocolBaseUrl: import.meta.env.VITE_GOSSIP_API_URL ?? "https://api.usegossip.com",
        });
        set(0, true, "WASM ready");
      } catch (e) {
        return set(0, false, String(e));
      }

      let mnemonic = "";
      try {
        mnemonic = generateMnemonic();
        set(1, true, `${mnemonic.split(" ").length} words`);
      } catch (e) {
        return set(1, false, String(e));
      }

      try {
        if (!gossipSdk.isSessionOpen) await gossipSdk.openSession({ mnemonic });
        if (!cancelled) setUserId(gossipSdk.userId);
        set(2, true, gossipSdk.userId.slice(0, 28) + "…");
      } catch (e) {
        return set(2, false, String(e));
      }

      try {
        await gossipSdk.selfMessages.ensureDiscussionExists();
        await gossipSdk.selfMessages.send("smoke @ " + new Date().toISOString());
        set(3, true, "sent");
      } catch (e) {
        return set(3, false, String(e));
      }

      try {
        const msgs = await gossipSdk.selfMessages.getMessages();
        if (!cancelled) setMessages(msgs.map((m) => m.content));
        set(4, true, `${msgs.length} decrypted`);
      } catch (e) {
        return set(4, false, String(e));
      }
      if (!cancelled) setDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const allOk = steps.every((s) => s.ok === true);

  return (
    <div className="relative z-10 mx-auto max-w-2xl p-10 font-mono text-sm">
      <h1 className="mb-1 font-display text-2xl font-bold text-text">gossip-sdk smoke test</h1>
      <p className="mb-6 text-muted">Real crypto pipeline in the browser.</p>
      <div
        className="mb-6 inline-block rounded-lg px-3 py-1 font-bold"
        style={{
          background: done && allOk ? "var(--accent)" : "var(--slate)",
          color: done && allOk ? "var(--accent-ink)" : "var(--text)",
        }}
        data-smoke-status={done ? (allOk ? "PASS" : "FAIL") : "RUNNING"}
      >
        {done ? (allOk ? "✓ ALL PASS" : "✗ FAILED") : "… running"}
      </div>
      <ul className="space-y-2" data-steps>
        {steps.map((s) => (
          <li key={s.name} className="flex items-start gap-3">
            <span style={{ color: s.ok === null ? "var(--text-faint)" : s.ok ? "var(--accent)" : "var(--danger)" }}>
              {s.ok === null ? "…" : s.ok ? "✓" : "✗"}
            </span>
            <span className="text-text">
              {s.name}
              {s.detail && <span className="text-muted"> - {s.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
      {userId && <p className="mt-6 break-all text-muted">userId: <span className="text-accent">{userId}</span></p>}
      {messages.length > 0 && <pre className="mt-2 whitespace-pre-wrap text-muted">decrypted: {JSON.stringify(messages, null, 2)}</pre>}
    </div>
  );
}
