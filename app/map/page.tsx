"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { ErrorBanner, Spinner } from "@/components/ui";
import { useAlerts, useLatestTelemetry } from "@/lib/hooks";
import type { AlertSeverity } from "@/lib/types";

const FleetMap = dynamic(() => import("@/components/fleet-map").then((module) => module.FleetMap), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[420px] place-items-center text-sm text-muted">Loading map…</div>,
});

export default function MapPage() {
  const latest = useLatestTelemetry();
  const alerts = useAlerts({ active: true, page: 1, page_size: 100 });
  const worstAlert = useMemo(() => {
    const result = new Map<string, AlertSeverity>();
    for (const alert of alerts.data?.items ?? []) {
      if (alert.severity === "critical" || !result.has(alert.vehicle_id)) {
        result.set(alert.vehicle_id, alert.severity);
      }
    }
    return result;
  }, [alerts.data]);

  return (
    <div className="relative h-full min-h-[420px]">
      <FleetMap latest={latest.data ?? []} worstAlert={worstAlert} fullScreen updatedAt={latest.dataUpdatedAt || undefined} />
      {latest.isLoading && (
        <div className="absolute inset-0 z-[600] grid place-items-center bg-bg/35 backdrop-blur-[1px]">
          <Spinner label="Loading live positions" />
        </div>
      )}
      {latest.error && (
        <div className="absolute left-1/2 top-4 z-[600] w-[min(90%,32rem)] -translate-x-1/2">
          <ErrorBanner error={latest.error} onRetry={() => void latest.refetch()} />
        </div>
      )}
    </div>
  );
}
