import { Avatar } from "@gossip/ui/stack";
import { useAvatars, resolveAvatarSrc } from "@/stores/useAvatars";

/**
 * Drop-in replacement for the Stack `Avatar` that resolves an image source:
 * custom upload > regenerated seed > deterministic DiceBear identicon from
 * the handle. Same props as `Avatar`, so call sites can alias the import.
 */
export function UserAvatar({
  name,
  id,
  size,
  className,
}: {
  name: string;
  id?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const overrides = useAvatars((s) => s.overrides);
  const src = resolveAvatarSrc(id, overrides);
  return <Avatar name={name} id={id} size={size} className={className} src={src} />;
}
