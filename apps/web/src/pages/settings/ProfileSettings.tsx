import { useRef, useState } from "react";
import { Copy, Check, Dices, Upload, ArrowRight, Share2, Link2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { contactLink } from "@/lib/contact";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup, SettingRow } from "./parts";
import { Button, Field, Input } from "@gossip/ui/stack";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { useSession } from "@/stores/useSession";
import { useAvatars, type AvatarOverride } from "@/stores/useAvatars";
import { dicebearUri, randomSeed, fileToAvatarDataUrl } from "@/lib/avatar";
import { truncateHandle } from "@/lib/utils";

export function ProfileSettings() {
  const userId = useSession((s) => s.userId);
  const displayName = useSession((s) => s.displayName);
  const setDisplayName = useSession((s) => s.setDisplayName);
  const [name, setName] = useState(displayName);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const overrides = useAvatars((s) => s.overrides);
  const setOverride = useAvatars((s) => s.setOverride);
  const clearOverride = useAvatars((s) => s.clearOverride);
  const [pendingAvatar, setPendingAvatar] = useState<AvatarOverride | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasOverride = !!(userId && overrides[userId]);
  const pendingSrc =
    pendingAvatar === null
      ? null
      : pendingAvatar.kind === "image"
        ? pendingAvatar.dataUrl
        : dicebearUri(pendingAvatar.seed);

  const savePendingAvatar = () => {
    if (userId && pendingAvatar) setOverride(userId, pendingAvatar);
    setPendingAvatar(null);
  };

  const onAvatarFile = async (file: File | undefined) => {
    if (!file) return;
    setAvatarError(null);
    try {
      setPendingAvatar({ kind: "image", dataUrl: await fileToAvatarDataUrl(file) });
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : "Could not process that image.");
    }
  };

  const save = () => {
    setDisplayName(name.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <SettingsPage title="Profile" desc="How you appear across the workspace. Your identity carries no PII.">
      <SettingGroup title="Identity">
        <SettingRow
          label={
            <div className="flex items-center gap-3">
              <Avatar name={displayName || "You"} id={userId ?? displayName} className="!size-12 !text-[16px]" />
              <div>
                <div className="text-[15px] font-semibold text-ink">{displayName || "You"}</div>
                <div className="font-mono text-[11px] text-ink-faint">
                  {userId ? truncateHandle(userId, 16, 8) : "session locked"}
                </div>
              </div>
            </div>
          }
        />
        <SettingRow
          label="Pseudonymous handle"
          desc="Derived from your passphrase. This is your canonical, server-blind identity."
          control={
            <Button
              variant="secondary"
              size="sm"
              disabled={!userId}
              onClick={() => {
                if (!userId) return;
                navigator.clipboard?.writeText(userId);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-4 text-positive" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          }
        />
      </SettingGroup>

      <SettingGroup title="Share my contact">
        <SettingRow
          label={
            <div className="flex items-start gap-4">
              {userId ? (
                <div className="shrink-0 rounded-card border border-line bg-white p-2.5">
                  {/* Fixed black-on-white for reliable scanning in both themes. */}
                  <QRCodeSVG value={contactLink(userId, displayName)} size={124} bgColor="#ffffff" fgColor="#0a0a0a" marginSize={0} />
                </div>
              ) : (
                <div className="grid size-[145px] shrink-0 place-items-center rounded-card border border-line bg-field text-[12px] text-ink-faint">
                  session locked
                </div>
              )}
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-ink">Scan or send a link</div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-ink-mute">
                  Opens an encrypted DM with you. Shares only your <span className="font-mono">public</span> handle, never your passphrase.
                </div>
                {userId && (
                  <div className="mt-2 break-all rounded-control bg-field px-2 py-1.5 font-mono text-[11px] text-ink-mute">
                    {contactLink(userId, displayName)}
                  </div>
                )}
              </div>
            </div>
          }
          control={
            <div className="flex flex-col items-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!userId}
                onClick={() => {
                  if (!userId) return;
                  navigator.clipboard?.writeText(contactLink(userId, displayName));
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 1500);
                }}
              >
                {linkCopied ? <Check className="size-4 text-positive" /> : <Link2 className="size-4" />}
                {linkCopied ? "Copied" : "Copy link"}
              </Button>
              {typeof navigator.share === "function" && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!userId}
                  onClick={() => {
                    if (!userId) return;
                    void navigator
                      .share({ title: "DM me on Gossip", url: contactLink(userId, displayName) })
                      .catch(() => {});
                  }}
                >
                  <Share2 className="size-4" /> Share…
                </Button>
              )}
            </div>
          }
        />
      </SettingGroup>

      <SettingGroup title="Avatar">
        <SettingRow
          label={
            <div className="flex items-center gap-4">
              <Avatar name={displayName || "You"} id={userId ?? displayName} className="!size-14 !text-[18px]" />
              {pendingSrc && (
                <>
                  <ArrowRight className="size-4 shrink-0 text-ink-faint" />
                  <img src={pendingSrc} alt="New avatar preview" className="size-14 shrink-0 rounded-full bg-field object-cover" />
                </>
              )}
              <div>
                <div className="text-[14px] font-medium text-ink">
                  {pendingAvatar ? "Preview (not saved yet)" : hasOverride ? "Custom avatar" : "Default avatar"}
                </div>
                <div className="text-[12px] text-ink-mute">
                  Deterministic from your handle. Regenerate or upload your own; it stays on this device.
                </div>
                {avatarError && <div className="mt-0.5 text-[12px] text-negative">{avatarError}</div>}
              </div>
            </div>
          }
          control={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {pendingAvatar ? (
                <>
                  {pendingAvatar.kind === "seed" && (
                    <Button variant="secondary" size="sm" onClick={() => setPendingAvatar({ kind: "seed", seed: randomSeed() })}>
                      <Dices className="size-4" /> Try another
                    </Button>
                  )}
                  <Button size="sm" onClick={savePendingAvatar}>
                    <Check className="size-4" /> Save avatar
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setPendingAvatar(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!userId}
                    onClick={() => setPendingAvatar({ kind: "seed", seed: randomSeed() })}
                  >
                    <Dices className="size-4" /> Regenerate
                  </Button>
                  <Button variant="secondary" size="sm" disabled={!userId} onClick={() => fileRef.current?.click()}>
                    <Upload className="size-4" /> Upload…
                  </Button>
                  {hasOverride && (
                    <Button variant="secondary" size="sm" onClick={() => userId && clearOverride(userId)}>
                      Reset to default
                    </Button>
                  )}
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void onAvatarFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          }
        />
      </SettingGroup>

      <SettingGroup title="Display">
        <div className="space-y-4 px-4 py-4">
          <Field label="Display name" hint="Shown to other members in group channels. Separate from your handle.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daniel" />
          </Field>
          <Button size="sm" onClick={save} disabled={!name.trim() || name.trim() === displayName}>
            {saved ? <><Check className="size-4" /> Saved</> : "Save"}
          </Button>
        </div>
      </SettingGroup>
    </SettingsPage>
  );
}
