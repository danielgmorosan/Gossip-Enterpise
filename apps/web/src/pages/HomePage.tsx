import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, UserPlus, MessageSquareLock, Phone, Copy, Check, Lock, Link2 } from "lucide-react";
import { Button, Tooltip } from "@gossip/ui/stack";
import { PaneHeader } from "@/components/chat/PaneHeader";
import { NewDmDialog } from "@/components/chat/NewDmDialog";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { useSession } from "@/stores/useSession";
import { useContacts } from "@/stores/useContacts";
import { contactLink } from "@/lib/contact";
import { truncateHandle } from "@/lib/utils";

/**
 * Home landing (/home) - the Discord-"Friends"-style contacts page. Lists
 * everyone you can DM, lets you start a chat or call, and shares your
 * contact link so others can reach you. No workspace required.
 */
export function HomePage() {
  const status = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);
  const displayName = useSession((s) => s.displayName);
  const contacts = useContacts((s) => s.contacts);
  const [newDm, setNewDm] = useState(false);
  const [copied, setCopied] = useState(false);

  if (status !== "open") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PaneHeader
          icon={<span className="grid size-7 place-items-center rounded-control bg-field text-ink"><Users className="size-4" /></span>}
          title="Contacts"
        />
        <div className="grid flex-1 place-items-center p-6">
          <div className="max-w-sm text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-card bg-field text-ink">
              <Lock className="size-6" />
            </span>
            <h2 className="mt-3 text-xl font-bold tracking-tight text-ink">Session locked</h2>
            <p className="mt-1 text-[14px] text-ink-mute">Open your encrypted session to see your contacts and messages.</p>
            <Link to="/identity/unlock"><Button className="mt-4">Unlock session</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const copyLink = () => {
    if (!userId) return;
    navigator.clipboard?.writeText(contactLink(userId, displayName ?? undefined));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader
        icon={<span className="grid size-7 place-items-center rounded-control bg-field text-ink"><Users className="size-4" /></span>}
        title="Contacts"
        subtitle={contacts.length > 0 ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"}` : undefined}
        actions={
          <Button size="sm" onClick={() => setNewDm(true)}>
            <UserPlus className="size-4" /> New message
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-3xl">
          {/* Share your contact link */}
          <div className="mb-6 flex items-center gap-3 rounded-card border border-line bg-paper-2 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-control bg-field text-ink">
              <Link2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink">Your contact link</div>
              <p className="truncate text-[12.5px] text-ink-mute">
                Share it so anyone can start an end-to-end encrypted DM with you, no workspace needed.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={copyLink} disabled={!userId}>
              {copied ? <><Check className="size-4 text-positive" /> Copied</> : <><Copy className="size-4" /> Copy link</>}
            </Button>
          </div>

          {/* Contact list */}
          {contacts.length === 0 ? (
            <div className="grid place-items-center py-16 text-center">
              <span className="grid size-12 place-items-center rounded-card bg-field text-ink">
                <MessageSquareLock className="size-6" />
              </span>
              <h2 className="mt-3 text-xl font-bold tracking-tight text-ink">No contacts yet</h2>
              <p className="mt-1 max-w-sm text-[14px] leading-relaxed text-ink-mute">
                Add someone by their gossip ID, or share your contact link above. Every conversation is end-to-end encrypted.
              </p>
              <Button className="mt-4" onClick={() => setNewDm(true)}>
                <UserPlus className="size-4" /> Add a contact
              </Button>
            </div>
          ) : (
            <>
              <div className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                All contacts · {contacts.length}
              </div>
              <div className="divide-y divide-line rounded-card border border-line bg-paper">
                {contacts.map((c) => (
                  <div key={c.userId} className="group flex items-center gap-3 px-3 py-2.5">
                    <Avatar name={c.name} id={c.userId} className="!size-9 !text-[13px]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium text-ink">{c.name}</div>
                      <div className="truncate font-mono text-[10.5px] text-ink-faint">{truncateHandle(c.userId, 14, 8)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <Tooltip label={`Message ${c.name}`}>
                        <Link
                          to={`/home/dm/${encodeURIComponent(c.userId)}`}
                          aria-label={`Message ${c.name}`}
                          className="grid size-8 place-items-center rounded-control text-ink-mute transition-colors hover:bg-field hover:text-ink"
                        >
                          <MessageSquareLock className="size-4" />
                        </Link>
                      </Tooltip>
                      <Tooltip label={`Call ${c.name}`}>
                        <Link
                          to={`/home/call/dm/${encodeURIComponent(c.userId)}`}
                          aria-label={`Call ${c.name}`}
                          className="grid size-8 place-items-center rounded-control text-ink-mute transition-colors hover:bg-field hover:text-ink"
                        >
                          <Phone className="size-4" />
                        </Link>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {newDm && <NewDmDialog onClose={() => setNewDm(false)} />}
    </div>
  );
}
