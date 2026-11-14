"use client";

import { useMemo } from "react";
import { parseUtc } from "@/lib/format";
import { useVehicleTelemetry } from "@/lib/hooks";

const W = 320;
const H = 96;

export function SignalChart({
  vehicleId,
  signal,
  title,
  unit,
  color,
  domain,
  decimals = 0,
}: {
  vehicleId: string;
  signal: string;
  title: string;
  unit: string;
  color: string;
  domain?: [number, number];
  decimals?: number;
}) {
  const { data, isLoading } = useVehicleTelemetry(vehicleId, { signal_name: signal, page_size: 60 });

  const chart = useMemo(() => {
    // API returns newest first; draw oldest -> newest.
    const pts = (data?.items ?? [])
      .filter((r) => r.value_numeric != null)
      .map((r) => ({ t: parseUtc(r.observed_at).getTime(), v: r.value_numeric as number }))
      .reverse();
    if (pts.length < 2) return { pts, path: "", area: "", last: pts.at(-1)?.v };
    const t0 = pts[0]!.t;
    const t1 = pts.at(-1)!.t || t0 + 1;
    const vs = pts.map((p) => p.v);
    let lo = domain ? domain[0] : Math.min(...vs);
    let hi = domain ? domain[1] : Math.max(...vs);
    if (hi - lo < 1e-6) {
      lo -= 1;
      hi += 1;
    }
    const x = (t: number) => 6 + ((t - t0) / Math.max(t1 - t0, 1)) * (W - 12);
    const y = (v: number) => H - 8 - ((v - lo) / (hi - lo)) * (H - 20);
    const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
    const area = `${path} L${x(pts.at(-1)!.t).toFixed(1)} ${H} L${x(pts[0]!.t).toFixed(1)} ${H} Z`;
    return { pts, path, area, last: pts.at(-1)!.v };
  }, [data, domain]);

  const gradId = `g-${signal}`;
  return (
    <div className="rounded-xl border border-line bg-bg/40 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-muted">{title}</p>
        <p className="text-lg font-semibold tabular-nums">
          {chart.last != null ? chart.last.toFixed(decimals) : "—"} <span className="text-xs font-normal text-muted">{unit}</span>
        </p>
      </div>
      {isLoading ? (
        <div className="mt-3 h-24 animate-pulse rounded bg-surface-2" />
      ) : chart.pts.length < 2 ? (
        <p className="mt-3 grid h-24 place-items-center text-xs text-muted">Waiting for more readings…</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-24 w-full" role="img" aria-label={`${title} over time`}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.35" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={chart.area} fill={`url(#${gradId})`} />
          <path d={chart.path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
