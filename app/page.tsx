"use client";

import { AlertTriangle, Car, CheckCircle2, Layers, Map as MapIcon, MapPin, Radio } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { SeverityBadge } from "@/components/alerts";
import { Donut, Legend } from "@/components/donut";
import dynamic from "next/dynamic";
import { Badge, EmptyState, ErrorBanner, PageHeader, Spinner, connectionTone } from "@/components/ui";
import { pct, timeAgo, titleCase } from "@/lib/format";
import {
  useAlertSummary,
  useAlerts,
  useDeviceTotal,
  useDevices,
  useFleetTotal,
  useFleets,
  useLatestTelemetry,
  useVehicleLookup,
  useVehicleTotal,
} from "@/lib/hooks";
import type { AlertSeverity } from "@/lib/types";

// Leaflet touches `window`, so the map is client-only.
const FleetMap = dynamic(() => import("@/components/fleet-map").then((m) => m.FleetMap), {
  ssr: false,
  loading: () => <div className="grid h-[420px] place-items-center text-sm text-muted">Loading map…</div>,
});

function Kpi({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: ReactNode; hint?: string; tone: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`grid size-12 place-items-center rounded-xl ${tone}`}>{icon}</div>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="text-3xl font-semibold tabular-nums leading-tight">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-medium">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function FleetRow({ id, name, location }: { id: string; name: string; location: string | null }) {
  const { data } = useVehicleTotal({ fleet_id: id });
  return (
    <li className="flex items-center justify-between px-5 py-3">
      <div className="min-w-0">
        <Link href={`/vehicles?fleet_id=${id}`} className="truncate font-medium hover:text-brand">
          {name}
        </Link>
        <p className="truncate text-xs text-muted">{location ?? "No location"}</p>
      </div>
      <span className="text-sm tabular-nums text-muted">
        {data ?? "–"} {data === 1 ? "vehicle" : "vehicles"}
      </span>
    </li>
  );
}

export default function OverviewPage() {
  const vehicles = useVehicleTotal();
  const active = useVehicleTotal({ status: "active" });
  const inactive = useVehicleTotal({ status: "inactive" });
  const maintenance = useVehicleTotal({ status: "maintenance" });
  const devices = useDeviceTotal();
  const online = useDeviceTotal({ connection_status: "online" });
  const offline = useDeviceTotal({ connection_status: "offline" });
  const unknown = useDeviceTotal({ connection_status: "unknown" });
  const fleetTotal = useFleetTotal();
  const fleets = useFleets({ page: 1, page_size: 5 });
  const recentDevices = useDevices({ page: 1, page_size: 5, sort_by: "created_at", sort_order: "desc" });

  const latest = useLatestTelemetry();
  const activeAlerts = useAlerts({ active: true, page: 1, page_size: 100 });
  const alertSummary = useAlertSummary();
  const lookup = useVehicleLookup();

  // Worst active severity per vehicle, used to colour map markers.
  const worstAlert = useMemo(() => {
    const m = new Map<string, AlertSeverity>();
    for (const a of activeAlerts.data?.items ?? []) {
      if (a.severity === "critical" || !m.has(a.vehicle_id)) m.set(a.vehicle_id, a.severity);
    }
    return m;
  }, [activeAlerts.data]);

  const loadError = vehicles.error ?? devices.error ?? fleets.error;
  const n = (q: { data?: number }) => q.data ?? 0;
  const vehicleSlices = [
    { label: "Active", value: n(active), color: "#22c55e" },
    { label: "Maintenance", value: n(maintenance), color: "#f59e0b" },
    { label: "Inactive", value: n(inactive), color: "#64748b" },
  ];
  const deviceSlices = [
    { label: "Online", value: n(online), color: "#22c55e" },
    { label: "Offline", value: n(offline), color: "#ef4444" },
    { label: "Unknown", value: n(unknown), color: "#64748b" },
  ];

  return (
    <>
      <PageHeader title="Fleet Overview" subtitle="Live data from the Veylix API. Positions refresh every 5 seconds." />

      {loadError != null && (
        <div className="mb-6">
          <ErrorBanner error={loadError} onRetry={() => window.location.reload()} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<Car className="size-6 text-blue-400" />} tone="bg-brand-2/15" label="Total vehicles" value={vehicles.data ?? "–"} hint={`${n(fleetTotal)} ${n(fleetTotal) === 1 ? "fleet" : "fleets"}`} />
        <Kpi icon={<CheckCircle2 className="size-6 text-green-400" />} tone="bg-ok/15" label="Active vehicles" value={active.data ?? "–"} hint={`${n(maintenance)} in maintenance`} />
        <Kpi
          icon={<AlertTriangle className="size-6 text-amber-300" />}
          tone="bg-warn/15"
          label="Open alerts"
          value={alertSummary.data?.active_alerts ?? "–"}
          hint={`${alertSummary.data?.vehicles_with_active_alerts ?? 0} ${alertSummary.data?.vehicles_with_active_alerts === 1 ? "vehicle" : "vehicles"} affected · ${alertSummary.data?.active_by_severity.critical ?? 0} critical`}
        />
        <Kpi
          icon={<Radio className="size-6 text-violet-300" />}
          tone="bg-brand/15"
          label="Device connectivity"
          value={n(devices) ? pct(n(online), n(devices)) : "–"}
          hint={`${n(online)} of ${n(devices)} devices online`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel
            title="Fleet Live Location"
            icon={<MapPin className="size-4 text-muted" />}
            action={
              <Link href="/map" className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface-2">
                <MapIcon className="size-4" />
                View on map
              </Link>
            }
          >
            {latest.isLoading ? (
              <div className="h-[360px]">
                <Spinner />
              </div>
            ) : latest.error ? (
              <div className="p-4">
                <ErrorBanner error={latest.error} />
              </div>
            ) : (
              <FleetMap latest={(latest.data ?? []).slice(0, 100)} worstAlert={worstAlert} />
            )}
          </Panel>
        </div>

        <Panel
          title="Recent Alerts"
          icon={<AlertTriangle className="size-4 text-muted" />}
          action={
            <Link href="/alerts" className="text-xs text-brand hover:underline">
              View all
            </Link>
          }
        >
          {activeAlerts.isLoading ? (
            <Spinner />
          ) : (activeAlerts.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No open alerts" hint="Alerts are raised automatically when telemetry crosses a diagnostic threshold." />
          ) : (
            <ul className="divide-y divide-line/70">
              {activeAlerts.data!.items.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/vehicles/${a.vehicle_id}`} className="block truncate font-medium hover:text-brand">
                      {lookup.label(a.vehicle_id)}
                    </Link>
                    <p className="truncate text-xs text-muted" title={a.message}>
                      {a.message}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <SeverityBadge severity={a.severity} />
                    <span className="text-[11px] text-muted">{timeAgo(a.last_observed_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Vehicle Status">
          <div className="flex items-center gap-5 p-5">
            <Donut centerLabel="Vehicles" slices={vehicleSlices} />
            <Legend slices={vehicleSlices} />
          </div>
        </Panel>

        <Panel
          title="Device Connectivity"
          action={
            <Link href="/devices" className="text-xs text-brand hover:underline">
              Manage
            </Link>
          }
        >
          <div className="flex items-center gap-5 p-5">
            <Donut centerLabel="Devices" slices={deviceSlices} />
            <Legend slices={deviceSlices} />
          </div>
          {(recentDevices.data?.items.length ?? 0) > 0 && (
            <ul className="divide-y divide-line/70 border-t border-line">
              {recentDevices.data!.items.slice(0, 3).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="truncate">{d.serial_number}</span>
                  <Badge tone={connectionTone[d.connection_status]}>{titleCase(d.connection_status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Fleets"
          icon={<Layers className="size-4 text-muted" />}
          action={
            <Link href="/fleets" className="text-xs text-brand hover:underline">
              Manage
            </Link>
          }
        >
          {fleets.isLoading ? (
            <Spinner />
          ) : (fleets.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No fleets yet" hint="Create a fleet, then register vehicles in it." />
          ) : (
            <ul className="divide-y divide-line/70">
              {fleets.data!.items.map((f) => (
                <FleetRow key={f.id} id={f.id} name={f.name} location={f.location} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
