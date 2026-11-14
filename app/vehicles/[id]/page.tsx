"use client";

import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { AckButton, AlertStateBadge, SeverityBadge } from "@/components/alerts";
import { SignalChart } from "@/components/signal-chart";
import { VehicleForm } from "@/components/vehicle-form";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Spinner,
  Table,
  connectionTone,
  useToast,
  vehicleStatusTone,
  type Tone,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, timeAgo, titleCase, vehicleLabel } from "@/lib/format";
import { useAlerts, useApiMutation, useDevices, useFleet, useVehicle, useVehicleHealth, useVehicleTelemetry } from "@/lib/hooks";
import type { HealthIndicatorStatus, TelemetryReading, VehicleHealthStatus } from "@/lib/types";

const INDICATOR_LABELS: Record<string, string> = {
  battery_soc_percent: "Battery charge",
  battery_voltage_v: "Battery voltage",
  motor_temperature_c: "Motor temperature",
  tire_pressure_psi: "Tire pressure",
  speed_kmh: "Speed",
  rpm: "Motor RPM",
  vehicle_state: "Vehicle state",
};

const healthTone: Record<VehicleHealthStatus, Tone> = { healthy: "green", warning: "amber", critical: "red", unknown: "gray" };
const indicatorTone: Record<HealthIndicatorStatus, Tone> = { normal: "green", warning: "amber", critical: "red", unknown: "gray" };

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: string | null; unit?: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg/40 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {value ?? "—"} {value != null && unit && <span className="text-xs font-normal text-muted">{unit}</span>}
      </p>
    </div>
  );
}

function num(r: TelemetryReading | undefined, digits = 0): string | null {
  return r?.value_numeric != null ? r.value_numeric.toFixed(digits) : null;
}

function HealthCard({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading, error } = useVehicleHealth(vehicleId);
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-medium">Vehicle health</h2>
        {data && <Badge tone={healthTone[data.status]}>{titleCase(data.status)}</Badge>}
      </div>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <div className="p-4">
          <ErrorBanner error={error} />
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2 px-5 pt-5">
            <span className="text-5xl font-semibold tabular-nums leading-none">{data!.score ?? "—"}</span>
            <span className="pb-1 text-sm text-muted">/ 100 health score</span>
          </div>
          <ul className="mt-4 divide-y divide-line/70 border-t border-line">
            {data!.indicators.map((i) => (
              <li key={i.signal_name} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div className="min-w-0">
                  <p>{INDICATOR_LABELS[i.signal_name] ?? i.signal_name}</p>
                  <p className="truncate text-xs text-muted" title={i.threshold ?? i.message}>
                    {i.status === "unknown" ? "No data yet" : i.value != null ? `${typeof i.value === "number" ? Number(i.value.toFixed(1)) : i.value} ${i.unit && i.unit !== "enum" ? i.unit : ""}` : ""}
                  </p>
                </div>
                <Badge tone={indicatorTone[i.status]}>{titleCase(i.status)}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: vehicle, isLoading, error, refetch } = useVehicle(id);
  const { data: fleet } = useFleet(vehicle?.fleet_id);
  const devices = useDevices({ vehicle_id: id, page: 1, page_size: 50 });
  const alerts = useAlerts({ vehicle_id: id, page: 1, page_size: 10 });
  // Newest ~3 messages worth of rows; the first row per signal is its latest value.
  const recent = useVehicleTelemetry(id, { page: 1, page_size: 30 });
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useApiMutation(() => api.vehicles.remove(id));

  const latest = useMemo(() => {
    const m = new Map<string, TelemetryReading>();
    for (const r of recent.data?.items ?? []) if (!m.has(r.signal_name)) m.set(r.signal_name, r);
    return m;
  }, [recent.data]);

  if (isLoading) return <Spinner />;
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="space-y-4">
        <Link href="/vehicles" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Vehicles
        </Link>
        {notFound ? <EmptyState title="Vehicle not found" hint="It may have been deleted." /> : <ErrorBanner error={error} onRetry={() => refetch()} />}
      </div>
    );
  }
  if (!vehicle) return null;

  const lat = latest.get("latitude")?.value_numeric;
  const lon = latest.get("longitude")?.value_numeric;
  const lastReading = recent.data?.items[0];
  const state = latest.get("vehicle_state")?.value_text;

  return (
    <>
      <Link href="/vehicles" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Vehicles
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{vehicleLabel(vehicle)}</h1>
            <Badge tone={vehicleStatusTone[vehicle.status]}>{titleCase(vehicle.status)}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-medium">Live telemetry</h2>
              <span className="text-xs text-muted">{lastReading ? `Updated ${timeAgo(lastReading.observed_at)}` : "No readings yet"}</span>
            </div>
            {recent.isLoading ? (
              <Spinner />
            ) : recent.error ? (
              <ErrorBanner error={recent.error} />
            ) : latest.size === 0 ? (
              <EmptyState title="No telemetry yet" hint="Assign a device to this vehicle and start the simulator. Readings appear here within a few seconds." />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Speed" value={num(latest.get("speed_kmh"))} unit="km/h" />
                <Metric label="Battery" value={num(latest.get("battery_soc_percent"))} unit="%" />
                <Metric label="Motor temp" value={num(latest.get("motor_temperature_c"), 1)} unit="°C" />
                <Metric label="Voltage" value={num(latest.get("battery_voltage_v"), 1)} unit="V" />
                <Metric label="RPM" value={num(latest.get("rpm"))} />
                <Metric label="Tire pressure" value={num(latest.get("tire_pressure_psi"), 1)} unit="psi" />
                <Metric label="Odometer" value={num(latest.get("odometer_km"), 1)} unit="km" />
                <Metric label="State" value={state ? titleCase(state) : null} />
              </div>
            )}
            {lat != null && lon != null && (
              <p className="mt-4 text-xs text-muted">
                Position: <span className="font-mono">{lat.toFixed(5)}, {lon.toFixed(5)}</span>
              </p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-medium">Recent history</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <SignalChart vehicleId={id} signal="speed_kmh" title="Speed" unit="km/h" color="#3b82f6" />
              <SignalChart vehicleId={id} signal="battery_soc_percent" title="Battery" unit="%" color="#22c55e" domain={[0, 100]} />
              <SignalChart vehicleId={id} signal="motor_temperature_c" title="Motor temp" unit="°C" color="#f59e0b" decimals={1} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <HealthCard vehicleId={id} />
          <section className="card p-5">
            <h2 className="mb-4 font-medium">Vehicle details</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Fleet">
                {fleet ? (
                  <Link href={`/vehicles?fleet_id=${fleet.id}`} className="hover:text-brand">
                    {fleet.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Detail>
              <Detail label="Type">{titleCase(vehicle.vehicle_type)}</Detail>
              <Detail label="VIN">
                <span className="break-all font-mono text-xs">{vehicle.vin ?? "—"}</span>
              </Detail>
              <Detail label="Registration">{vehicle.registration_number ?? "—"}</Detail>
              <Detail label="Registered">{formatDateTime(vehicle.created_at)}</Detail>
              <Detail label="Updated">{formatDateTime(vehicle.updated_at)}</Detail>
            </dl>
          </section>
        </div>
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-medium">Alerts</h2>
          <Link href="/alerts" className="text-xs text-brand hover:underline">
            All alerts
          </Link>
        </div>
        {alerts.isLoading ? (
          <Spinner />
        ) : alerts.error ? (
          <div className="p-4">
            <ErrorBanner error={alerts.error} />
          </div>
        ) : alerts.data!.items.length === 0 ? (
          <EmptyState title="No alerts for this vehicle" hint="Alerts are raised automatically when a reading crosses a threshold." />
        ) : (
          <Table head={["Severity", "Alert", "Last seen", "State", ""]}>
            {alerts.data!.items.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <SeverityBadge severity={a.severity} />
                </td>
                <td className="px-4 py-3">
                  <p>{a.message}</p>
                  <p className="text-xs text-muted">Threshold: {a.threshold}</p>
                </td>
                <td className="px-4 py-3 text-muted">{timeAgo(a.last_observed_at)}</td>
                <td className="px-4 py-3">
                  <AlertStateBadge alert={a} />
                </td>
                <td className="px-4 py-3 text-right">
                  <AckButton alert={a} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-medium">Assigned devices</h2>
          <Link href="/devices" className="text-xs text-brand hover:underline">
            Manage devices
          </Link>
        </div>
        {devices.isLoading ? (
          <Spinner />
        ) : devices.error ? (
          <div className="p-4">
            <ErrorBanner error={devices.error} />
          </div>
        ) : devices.data!.items.length === 0 ? (
          <EmptyState title="No device assigned" hint="Assign a telematics device from the Devices page to start receiving telemetry." />
        ) : (
          <Table head={["Serial number", "Type", "Firmware", "Connection", "Last seen"]}>
            {devices.data!.items.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium">{d.serial_number}</td>
                <td className="px-4 py-3 text-muted">{d.device_type}</td>
                <td className="px-4 py-3 text-muted">{d.firmware_version ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={connectionTone[d.connection_status]}>{titleCase(d.connection_status)}</Badge>
                </td>
                <td className="px-4 py-3 text-muted">{timeAgo(d.last_seen_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {editing && <VehicleForm vehicle={vehicle} onClose={() => setEditing(false)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete vehicle"
          message={
            <>
              Delete <strong className="text-ink">{vehicleLabel(vehicle)}</strong>? Vehicles with device assignment, telemetry or alert history cannot be deleted.
            </>
          }
          loading={remove.isPending}
          error={remove.error}
          onClose={() => {
            remove.reset();
            setDeleting(false);
          }}
          onConfirm={() =>
            remove.mutate(undefined, {
              onSuccess: () => {
                toast("Vehicle deleted");
                router.push("/vehicles");
              },
            })
          }
        />
      )}
    </>
  );
}
