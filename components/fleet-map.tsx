"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { parseUtc, timeAgo, vehicleLabel } from "@/lib/format";
import type { AlertSeverity, Vehicle, VehicleLatestTelemetry } from "@/lib/types";

// A reading older than this is drawn as "stale".
const STALE_AFTER_MS = 2 * 60 * 1000;

const COLORS = {
  moving: "#22c55e",
  parked: "#3b82f6",
  warning: "#f59e0b",
  critical: "#ef4444",
  stale: "#64748b",
} as const;
type MarkerState = keyof typeof COLORS;

const LEGEND: { state: MarkerState; label: string }[] = [
  { state: "moving", label: "Moving" },
  { state: "parked", label: "Parked" },
  { state: "warning", label: "Warning" },
  { state: "critical", label: "Critical" },
  { state: "stale", label: "No recent data" },
];

const W = 800;
const H = 360;
const PAD = 70;

interface Point {
  vehicle: Vehicle;
  latest: VehicleLatestTelemetry;
  lat: number;
  lon: number;
  state: MarkerState;
  stale: boolean;
  x: number;
  y: number;
}

export function FleetMap({
  vehicles,
  latest,
  worstAlert,
}: {
  vehicles: Vehicle[];
  latest: VehicleLatestTelemetry[];
  worstAlert: Map<string, AlertSeverity>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { points, reporting } = useMemo(() => {
    const byId = new Map(vehicles.map((v) => [v.id, v]));
    const now = Date.now();
    const raw: Omit<Point, "x" | "y">[] = [];
    for (const l of latest) {
      const vehicle = byId.get(l.vehicle_id);
      const lat = l.latitude?.value;
      const lon = l.longitude?.value;
      if (!vehicle || lat == null || lon == null) continue;
      const observed = Math.max(parseUtc(l.latitude!.observed_at).getTime(), parseUtc(l.longitude!.observed_at).getTime());
      const stale = now - observed > STALE_AFTER_MS;
      const alert = worstAlert.get(vehicle.id);
      const speed = l.speed_kmh?.value ?? 0;
      const state: MarkerState = alert ?? (stale ? "stale" : speed >= 1 ? "moving" : "parked");
      raw.push({ vehicle, latest: l, lat, lon, state, stale });
    }
    if (raw.length === 0) return { points: [] as Point[], reporting: 0 };

    // Equirectangular projection fitted to the bounding box of all vehicles.
    const lats = raw.map((p) => p.lat);
    const lons = raw.map((p) => p.lon);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const kx = Math.cos((midLat * Math.PI) / 180);
    const minX = Math.min(...lons) * kx;
    const maxX = Math.max(...lons) * kx;
    const minY = Math.min(...lats);
    const maxY = Math.max(...lats);
    // Never zoom in closer than ~0.02 degrees so one vehicle doesn't look like a jump.
    const spanX = Math.max(maxX - minX, 0.02);
    const spanY = Math.max(maxY - minY, 0.02);
    const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const projected = raw.map((p) => ({
      ...p,
      x: W / 2 + (p.lon * kx - cx) * scale,
      y: H / 2 - (p.lat - cy) * scale,
    }));
    return { points: projected, reporting: projected.length };
  }, [vehicles, latest, worstAlert]);

  const selected = points.find((p) => p.vehicle.id === selectedId) ?? null;

  return (
    <div
      className="relative h-[360px] overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(rgba(31,42,72,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(31,42,72,.5) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
      }}
    >
      {points.length === 0 ? (
        <div className="grid h-full place-items-center px-6 text-center">
          <div>
            <p className="font-medium">No vehicle positions yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Assign a device to a vehicle and start the simulator. Positions appear here as soon as telemetry is stored.
            </p>
          </div>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" role="img" aria-label="Schematic vehicle positions" onClick={() => setSelectedId(null)}>
          {points.map((p) => {
            const color = COLORS[p.state];
            const isSel = p.vehicle.id === selectedId;
            return (
              <g
                key={p.vehicle.id}
                transform={`translate(${p.x} ${p.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${vehicleLabel(p.vehicle)}, ${p.state}`}
                style={{ cursor: "pointer", outline: "none" }}
                opacity={p.stale ? 0.55 : 1}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(p.vehicle.id);
                }}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedId(p.vehicle.id)}
              >
                <circle r={isSel ? 26 : 20} fill={color} opacity={0.18} />
                <circle r={isSel ? 11 : 8} fill={color} stroke="#070b18" strokeWidth={2} />
                <text y={-16} textAnchor="middle" fontSize="12" fill="#cbd5f5" style={{ pointerEvents: "none" }}>
                  {vehicleLabel(p.vehicle)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      <ul className="absolute bottom-3 left-3 space-y-1.5 rounded-lg border border-line bg-bg/80 px-3 py-2.5 text-xs backdrop-blur">
        {LEGEND.map((l) => (
          <li key={l.state} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: COLORS[l.state] }} />
            {l.label}
          </li>
        ))}
      </ul>

      <p className="absolute right-3 top-3 rounded-md border border-line bg-bg/80 px-2.5 py-1 text-xs text-muted backdrop-blur">
        {reporting} of {vehicles.length} reporting position · schematic view
      </p>

      {selected && (
        <div className="absolute right-3 top-12 w-60 rounded-xl border border-line bg-surface-2/95 p-4 text-sm shadow-xl backdrop-blur">
          <div className="flex items-center gap-2 font-medium">
            <span className="size-2.5 rounded-full" style={{ background: COLORS[selected.state] }} />
            {vehicleLabel(selected.vehicle)}
          </div>
          <p className="mt-1 text-xs text-muted">
            {selected.vehicle.year} {selected.vehicle.make} {selected.vehicle.model}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <dt className="text-muted">Speed</dt>
            <dd className="text-right tabular-nums">{selected.latest.speed_kmh?.value != null ? `${selected.latest.speed_kmh.value.toFixed(0)} km/h` : "—"}</dd>
            <dt className="text-muted">Battery</dt>
            <dd className="text-right tabular-nums">{selected.latest.battery_soc_percent?.value != null ? `${selected.latest.battery_soc_percent.value.toFixed(0)}%` : "—"}</dd>
            <dt className="text-muted">Updated</dt>
            <dd className="text-right">{timeAgo(selected.latest.latitude?.observed_at)}</dd>
          </dl>
          <Link href={`/vehicles/${selected.vehicle.id}`} className="mt-3 inline-block text-xs text-brand hover:underline">
            View details →
          </Link>
        </div>
      )}
    </div>
  );
}
