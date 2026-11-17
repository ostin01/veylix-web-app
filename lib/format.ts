// The API sends UTC. If a timestamp arrives without a zone (e.g. from SQLite
// in tests), treat it as UTC rather than local time.
export function parseUtc(iso: string): Date {
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "Never";
  const diff = Math.max(0, now - parseUtc(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return parseUtc(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function vehicleLabel(v: { name: string | null; make: string; model: string; registration_number: string | null }): string {
  return v.name?.trim() || v.registration_number || `${v.make} ${v.model}`;
}

export function initials(name: string): string {
  return name
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function pct(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}
