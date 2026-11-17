import { Activity, ArrowUpRight, Battery, CheckCircle2, Clock3, Radio, WifiOff, Wrench } from "lucide-react";
import Link from "next/link";
import { Badge, EmptyState, Spinner, Table } from "@/components/ui";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { Alert, Device } from "@/lib/types";

function HealthRow({ icon: Icon, label, value, ok }: { icon: typeof Activity; label: string; value: string; ok: boolean }) {
  return <div className="flex items-center gap-3 px-5 py-3.5"><Icon className="size-4 text-muted" /><span className="flex-1 text-sm">{label}</span><span className={`text-xs ${ok ? "text-green-300" : "text-muted"}`}>{value}</span>{ok ? <CheckCircle2 className="size-4 text-ok" /> : <WifiOff className="size-4 text-muted" />}</div>;
}

export function SystemHealthPanel({ apiLoading, apiOnline, telemetryLoading, telemetryError, telemetryCount }: {
  apiLoading: boolean; apiOnline: boolean; telemetryLoading: boolean; telemetryError: boolean; telemetryCount: number;
}) {
  return <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="font-semibold">System health</h2><p className="mt-1 text-xs text-muted">Signals currently exposed by the frontend API</p></div><Wrench className="size-4 text-muted" /></div><div className="divide-y divide-line/70">
    <HealthRow icon={Activity} label="Backend API" value={apiLoading ? "Checking" : apiOnline ? "Reachable" : "Unreachable"} ok={apiOnline} />
    <HealthRow icon={Battery} label="Latest telemetry endpoint" value={telemetryLoading ? "Checking" : telemetryError ? "Unavailable" : `${telemetryCount} vehicles reporting`} ok={!telemetryError && !telemetryLoading} />
    <HealthRow icon={Radio} label="MQTT ingestion pipeline" value="Not connected to frontend" ok={false} />
    <HealthRow icon={Activity} label="Live event stream (SSE)" value="Not available" ok={false} />
  </div></section>;
}

export function RecentAlertsPanel({ alerts, loading, vehicleLabel }: { alerts: Alert[]; loading: boolean; vehicleLabel: (id: string) => string }) {
  return <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="font-semibold">Recent alerts</h2><p className="mt-1 text-xs text-muted">Latest alerts available from the API</p></div><Link className="inline-flex items-center gap-1 text-xs text-brand-2 hover:text-white" href="/alerts">View alerts <ArrowUpRight className="size-3.5" /></Link></div>
    {loading ? <Spinner /> : alerts.length ? <Table head={["Alert", "Vehicle", "Severity", "Observed"]}>{alerts.slice(0, 6).map(alert => <tr key={alert.id}><td className="px-4 py-3"><p className="font-medium">{alert.message}</p><p className="mt-0.5 font-mono text-[10px] text-muted">{alert.code}</p></td><td className="px-4 py-3 text-muted">{vehicleLabel(alert.vehicle_id)}</td><td className="px-4 py-3"><Badge tone={alert.severity === "critical" ? "red" : "amber"}>{alert.severity}</Badge></td><td className="whitespace-nowrap px-4 py-3 text-xs text-muted" title={formatDateTime(alert.first_observed_at)}>{timeAgo(alert.first_observed_at)}</td></tr>)}</Table> : <EmptyState title="No alerts returned" hint="The alert endpoint has no records to show." />}
  </section>;
}

export function DeviceConnectivityPanel({ devices, loading, vehicleLabel }: { devices: Device[]; loading: boolean; vehicleLabel: (id: string) => string }) {
  return <section className="card mt-6 overflow-hidden"><div className="border-b border-line px-5 py-4"><h2 className="font-semibold">Device connectivity</h2><p className="mt-1 text-xs text-muted">Read-only device status; connectivity is maintained by the telemetry/heartbeat pipeline.</p></div>
    {loading ? <Spinner /> : devices.length ? <Table head={["Device", "Vehicle", "Status", "Last seen"]}>{devices.slice(0, 8).map(device => <tr key={device.id}><td className="px-4 py-3"><p className="font-medium">{device.serial_number}</p><p className="text-xs text-muted">{device.device_type}{device.firmware_version ? ` · ${device.firmware_version}` : ""}</p></td><td className="px-4 py-3 text-muted">{device.vehicle_id ? vehicleLabel(device.vehicle_id) : "Unassigned"}</td><td className="px-4 py-3"><Badge tone={device.connection_status === "online" ? "green" : device.connection_status === "offline" ? "red" : "gray"}>{device.connection_status}</Badge></td><td className="px-4 py-3 text-xs text-muted">{device.last_seen_at ? timeAgo(device.last_seen_at) : "Never"}</td></tr>)}</Table> : <EmptyState title="No devices registered" hint="Registered devices will appear here." />}
  </section>;
}

export function AdminRefreshNote() {
  return <p className="mt-4 flex items-center gap-2 text-xs text-muted"><Clock3 className="size-3.5" /> Data refreshes using the existing API polling. True event testing and streaming need backend endpoints and MQTT ingestion.</p>;
}
