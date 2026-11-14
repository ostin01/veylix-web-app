export type Slice = { label: string; value: number; color: string };

export function Donut({ slices, centerLabel = "Total" }: { slices: Slice[]; centerLabel?: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="size-36 shrink-0" role="img" aria-label={`${centerLabel}: ${total}`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="#1a2442" strokeWidth="16" />
      {total > 0 &&
        slices
          .filter((s) => s.value > 0)
          .map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="16"
                strokeDasharray={`${Math.max(len - 2, 0)} ${c - Math.max(len - 2, 0)}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += len;
            return el;
          })}
      <text x="70" y="68" textAnchor="middle" fill="#e8ecf8" fontSize="26" fontWeight="600">
        {total}
      </text>
      <text x="70" y="86" textAnchor="middle" fill="#8b96b8" fontSize="11">
        {centerLabel}
      </text>
    </svg>
  );
}

export function Legend({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  return (
    <ul className="flex-1 space-y-2.5 text-sm">
      {slices.map((s) => (
        <li key={s.label} className="flex items-center gap-2.5">
          <span className="size-2.5 rounded-full" style={{ background: s.color }} />
          <span className="flex-1 text-muted">{s.label}</span>
          <span className="tabular-nums">{s.value}</span>
          <span className="w-10 text-right tabular-nums text-muted">{total ? Math.round((s.value / total) * 100) : 0}%</span>
        </li>
      ))}
    </ul>
  );
}
