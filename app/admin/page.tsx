"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Shield } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useActiveAlertTotal, useAlerts, useDevices, useHealth, useLatestTelemetry, useVehicles } from "@/lib/hooks";
import { vehicleLabel } from "@/lib/format";
import { Badge, ErrorBanner, PageHeader } from "@/components/ui";
import { AdminStats } from "@/components/admin/admin-stats";
import { EventMonitor } from "@/components/admin/event-monitor";
import { EventSimulator } from "@/components/admin/event-simulator";
import { AdminRefreshNote, DeviceConnectivityPanel, RecentAlertsPanel, SystemHealthPanel } from "@/components/admin/system-panels";
import type { LocalEvent, Scenario } from "@/components/admin/types";
import { scenarios } from "@/components/admin/types";

export default function AdminPage() {
  const { isAdmin, user } = useAuth();
  const vehicles = useVehicles({ page: 1, page_size: 100 });
  const devices = useDevices({ page: 1, page_size: 100 });
  const alerts = useAlerts({ page: 1, page_size: 8 });
  const alertTotal = useActiveAlertTotal();
  const telemetry = useLatestTelemetry();
  const health = useHealth();
  const [vehicleId, setVehicleId] = useState("");
  const [scenario, setScenario] = useState<Scenario>("vehicle_moves");
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const vehicleOptions = useMemo(() => (vehicles.data?.items ?? []).map(vehicle => ({
    id: vehicle.id,
    label: vehicleLabel(vehicle),
    detail: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
  })), [vehicles.data]);
  const vehicleNames = useMemo(() => new Map(vehicleOptions.map(vehicle => [vehicle.id, vehicle.label])), [vehicleOptions]);
  const getVehicleLabel = (id: string) => vehicleNames.get(id) ?? id.slice(0, 8);
  const onlineDevices = devices.data?.items.filter(device => device.connection_status === "online").length ?? 0;
  const criticalAlerts = alerts.data?.items.filter(alert => alert.severity === "critical" && !alert.resolved_at).length ?? 0;
  const dataError = vehicles.error ?? devices.error ?? alerts.error ?? telemetry.error;

  if (!isAdmin) {
    return <div className="card mx-auto max-w-xl p-8 text-center"><Shield className="mx-auto mb-3 size-8 text-warn" /><h1 className="text-xl font-semibold">Admin access required</h1><p className="mt-2 text-sm text-muted">Your account does not have permission to open the operations console.</p><Link href="/" className="mt-5 inline-flex text-sm text-brand-2">Return to dashboard</Link></div>;
  }

  function simulate(event: FormEvent) {
    event.preventDefault();
    const selectedVehicle = vehicleOptions.find(vehicle => vehicle.id === vehicleId);
    if (!selectedVehicle) return;
    const selectedScenario = scenarios.find(item => item.id === scenario);
    if (!selectedScenario) return;

    setEvents(current => [{
      id: crypto.randomUUID(),
      type: selectedScenario.event,
      vehicle: selectedVehicle.label,
      at: new Date().toISOString(),
      detail: selectedScenario.detail,
    }, ...current].slice(0, 30));
    setShowPreview(true);
  }

  return <>
    <PageHeader title="Admin / Operations" subtitle="Platform diagnostics and controlled integration test tools" actions={<Badge tone="purple"><Shield className="size-3" /> Admin only</Badge>} />
    {dataError && <div className="mb-5"><ErrorBanner error={dataError} onRetry={() => { void vehicles.refetch(); void devices.refetch(); void alerts.refetch(); void telemetry.refetch(); }} /></div>}

    <AdminStats
      apiOnline={health.data === true}
      apiLoading={health.isLoading}
      vehicleCount={vehicles.data?.pagination.total_items}
      deviceCount={devices.data?.pagination.total_items}
      onlineDevices={onlineDevices}
      activeAlerts={alertTotal.data}
      criticalAlerts={criticalAlerts}
    />

    <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
      <EventSimulator vehicles={vehicleOptions} vehicleId={vehicleId} scenario={scenario} username={user?.username ?? "admin"} onVehicleChange={setVehicleId} onScenarioChange={setScenario} onSimulate={simulate} />
      <EventMonitor events={events} hasPreview={showPreview} onClear={() => { setEvents([]); setShowPreview(false); }} />
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <SystemHealthPanel apiLoading={health.isLoading} apiOnline={health.data === true} telemetryLoading={telemetry.isLoading} telemetryError={!!telemetry.error} telemetryCount={telemetry.data?.length ?? 0} />
      <RecentAlertsPanel alerts={alerts.data?.items ?? []} loading={alerts.isLoading} vehicleLabel={getVehicleLabel} />
    </div>

    <DeviceConnectivityPanel devices={devices.data?.items ?? []} loading={devices.isLoading} vehicleLabel={getVehicleLabel} />
    <AdminRefreshNote />
  </>;
}
