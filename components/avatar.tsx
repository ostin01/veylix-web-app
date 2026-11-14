import { cx } from "./ui";

export function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" }) {
  return (
    <div
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 font-semibold text-white",
        size === "sm" ? "size-9 text-xs" : "size-10 text-sm",
      )}
    >
      {initials}
    </div>
  );
}
