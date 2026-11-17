import { Activity, AlertTriangle, CircleDot, Wifi, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

function Stat({ label, value, note, icon: Icon, tone = "text-brand-2" }: { label: string; value: ReactNode; note: string; icon: LucideIcon; tone?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between"><span className="text-sm text-muted">{label}</span><Icon className={`size-5 ${tone}`} /></div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}

export function AdminStats({ apiOnline, apiLoading, vehicleCount, deviceCount, onlineDevices, activeAlerts, criticalAlerts }: {
  apiOnline: boolean; apiLoading: boolean; vehicleCount?: number; deviceCount?: number; onlineDevices: number; activeAlerts?: number; criticalAlerts: number;
}) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Backend API" value={apiLoading ? "…" : apiOnline ? "Online" : "Offline"} note="Health endpoint" icon={Activity} tone={apiOnline ? "text-ok" : "text-bad"} />
      <Stat label="Vehicles" value={vehicleCount ?? "—"} note="Registered fleet" icon={CircleDot} />
      <Stat label="Devices online" value={`${onlineDevices} / ${deviceCount ?? "—"}`} note="Current connectivity state" icon={Wifi} tone="text-ok" />
      <Stat label="Active alerts" value={activeAlerts ?? "—"} note={`${criticalAlerts} critical in latest page`} icon={AlertTriangle} tone={criticalAlerts ? "text-bad" : "text-warn"} />
    </div>
  );
}
