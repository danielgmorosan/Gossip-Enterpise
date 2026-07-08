import { cn, colorForId, initials } from "../../utils";

export function Avatar({
  name,
  id,
  src,
  size = "md",
  className,
}: {
  name: string;
  id?: string;
  /** Optional image source (data URI or URL). Falls back to initials. */
  src?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const px = size === "sm" ? "size-5 text-[10px]" : "size-6 text-[11px]";
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        className={cn("inline-block shrink-0 rounded-full bg-field object-cover", px, className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-ink",
        px,
        className,
      )}
      style={{ backgroundColor: colorForId(id ?? name) }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
