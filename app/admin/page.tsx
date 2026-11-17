"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useActiveAlertTotal, useAlerts, useDevices, useHealth, useLatestTelemetry, useVehicles } from "@/lib/hooks";
import { vehicleLabel } from "@/lib/format";
import { Badge, ErrorBanner, PageHeader } from "@/components/ui";
import { AdminStats } from "@/components/admin/admin-stats";
import { EventMonitor } from "@/components/admin/event-monitor";
import { EventSimulator } from "@/components/admin/event-simulator";
import { AdminRefreshNote, DeviceConnectivityPanel, RecentAlertsPanel, SystemHealthPanel } from "@/components/admin/system-panels";
import type { Scenario } from "@/components/admin/types";
import { scenarios } from "@/components/admin/types";

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const vehicles = useVehicles({ page: 1, page_size: 100 }, false);
  const devices = useDevices({ page: 1, page_size: 100 }, false);
  const alerts = useAlerts({ page: 1, page_size: 8 }, false);
  const alertTotal = useActiveAlertTotal(false);
  const telemetry = useLatestTelemetry();
  const health = useHealth(false);
  const system = useQuery({
    queryKey: ["admin-system"],
    queryFn: api.admin.system,
    enabled: isAdmin,
  });
  const events = useQuery({
    queryKey: ["admin-events"],
    queryFn: api.admin.events,
    enabled: isAdmin,
  });
  const [vehicleId, setVehicleId] = useState("");
  const [scenario, setScenario] = useState<Scenario>("vehicle_moves");

  const simulation = useMutation({
    mutationFn: () => api.admin.simulate(vehicleId, scenario),
    onSuccess: async () => {
      await Promise.all(["admin-events", "alerts", "alerts-summary", "telemetry-latest", "vehicles", "devices", "vehicle-health"].map(queryKey => queryClient.invalidateQueries({ queryKey: [queryKey], refetchType: "active" })));
    },
  });
  const clearEvents = useMutation({
    mutationFn: api.admin.clearEvents,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ refetchType: "active" });
    },
  });

  const vehicleOptions = useMemo(() => (vehicles.data?.items ?? []).map(vehicle => ({
    id: vehicle.id,
    label: vehicleLabel(vehicle),
    detail: vehicle.year + " " + vehicle.make + " " + vehicle.model,
  })), [vehicles.data]);
  const vehicleNames = useMemo(() => new Map(vehicleOptions.map(vehicle => [vehicle.id, vehicle.label])), [vehicleOptions]);
  const getVehicleLabel = (id: string) => vehicleNames.get(id) ?? id.slice(0, 8);
  const onlineDevices = devices.data?.items.filter(device => device.connection_status === "online").length ?? 0;
  const criticalAlerts = alerts.data?.items.filter(alert => alert.severity === "critical" && !alert.resolved_at).length ?? 0;
  const dataError = vehicles.error ?? devices.error ?? alerts.error ?? telemetry.error ?? system.error ?? events.error ?? simulation.error ?? clearEvents.error;

  if (!isAdmin) {
    return <div className="card mx-auto max-w-xl p-8 text-center"><Shield className="mx-auto mb-3 size-8 text-warn" /><h1 className="text-xl font-semibold">Admin access required</h1><p className="mt-2 text-sm text-muted">Your account does not have permission to open the operations console.</p><Link href="/" className="mt-5 inline-flex text-sm text-brand-2">Return to dashboard</Link></div>;
  }

  const refreshSnapshot = () => {
    void vehicles.refetch();
    void devices.refetch();
    void alerts.refetch();
    void alertTotal.refetch();
    void telemetry.refetch();
    void health.refetch();
    void system.refetch();
    void events.refetch();
  };

  return <>
    <PageHeader title="Admin / Operations" subtitle="Platform diagnostics and controlled integration test tools" actions={<Badge tone="purple"><Shield className="size-3" /> Admin only</Badge>} />
    {dataError && <div className="mb-5"><ErrorBanner error={dataError} onRetry={refreshSnapshot} /></div>}

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
      <EventSimulator
        vehicles={vehicleOptions}
        vehicleId={vehicleId}
        scenario={scenario}
        onVehicleChange={setVehicleId}
        onScenarioChange={setScenario}
        onSimulate={() => simulation.mutate()}
        pending={simulation.isPending}
      />
      <EventMonitor
        events={events.data?.items ?? []}
        loading={events.isLoading}
        refreshing={events.isFetching}
        clearing={clearEvents.isPending}
        onRefresh={() => void events.refetch()}
        onClear={() => clearEvents.mutate()}
      />
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <SystemHealthPanel
        apiLoading={health.isLoading}
        apiOnline={health.data === true}
        databaseStatus={system.data?.database}
        telemetryLoading={telemetry.isLoading}
        telemetryError={!!telemetry.error}
        telemetryCount={telemetry.data?.length ?? 0}
      />
      <RecentAlertsPanel alerts={alerts.data?.items ?? []} loading={alerts.isLoading} vehicleLabel={getVehicleLabel} />
    </div>

    <DeviceConnectivityPanel devices={devices.data?.items ?? []} loading={devices.isLoading} vehicleLabel={getVehicleLabel} />
    <AdminRefreshNote onRefresh={refreshSnapshot} />
  </>;
}
