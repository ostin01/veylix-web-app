"use client";

import Link from "next/link";
import { useState } from "react";
import { AckButton, AlertStateBadge, SeverityBadge } from "@/components/alerts";
import { Badge, EmptyState, ErrorBanner, PageHeader, Pager, Spinner, Table, cx } from "@/components/ui";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useAlertSummary, useAlerts, useVehicleLookup, useVehicles } from "@/lib/hooks";
import type { AlertSeverity } from "@/lib/types";

type View = "active" | "resolved" | "all";
const VIEWS: { id: View; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];

export default function AlertsPage() {
  const [view, setView] = useState<View>("active");
  const [vehicleId, setVehicleId] = useState("");
  const [severity, setSeverity] = useState<AlertSeverity | "">("");
  const [sort, setSort] = useState<"created_at" | "last_observed_at" | "severity">("created_at");
  const [page, setPage] = useState(1);
  const summary = useAlertSummary(vehicleId || undefined);

  const vehicles = useVehicles({ page: 1, page_size: 100 });
  const lookup = useVehicleLookup();
  const { data, isLoading, error, refetch } = useAlerts({
    page,
    page_size: 15,
    vehicle_id: vehicleId,
    active: view === "all" ? "" : view === "active",
    severity,
    sort_by: sort,
    sort_order: "desc",
  });

  return (
    <>
      <PageHeader title="Alerts" subtitle="Diagnostic alerts raised from vehicle telemetry. Resolved automatically when readings return to normal." />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <div role="tablist" className="flex rounded-lg border border-line p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => {
                setView(v.id);
                setPage(1);
              }}
              className={cx("rounded-md px-3.5 py-1.5 text-sm transition", view === v.id ? "bg-brand text-white" : "text-muted hover:text-ink")}
            >
              {v.label}
            </button>
          ))}
        </div>
        <select
          className="input w-auto"
          value={vehicleId}
          onChange={(e) => {
            setVehicleId(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by vehicle"
        >
          <option value="">All vehicles</option>
          {vehicles.data?.items.map((v) => (
            <option key={v.id} value={v.id}>
              {lookup.label(v.id)}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value as AlertSeverity | "");
            setPage(1);
          }}
          aria-label="Filter by severity"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
        </select>
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort alerts">
          <option value="created_at">Newest first</option>
          <option value="last_observed_at">Last seen</option>
          <option value="severity">Severity</option>
        </select>
        {summary.data && (
          <p className="ml-auto text-sm text-muted">
            <span className="text-bad">{summary.data.active_by_severity.critical} critical</span> ·{" "}
            <span className="text-warn">{summary.data.active_by_severity.warning} warning</span> open
          </p>
        )}
      </div>

      <div className="card overflow-hidden">
        {error ? (
          <div className="p-4">
            <ErrorBanner error={error} onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <Spinner />
        ) : data!.items.length === 0 ? (
          <EmptyState
            title={view === "active" ? "No active alerts" : "No alerts found"}
            hint="Alerts appear when a signal crosses its threshold, e.g. low battery or high motor temperature."
          />
        ) : (
          <>
            <Table head={["Severity", "Vehicle", "Alert", "First seen", "Last seen", "State", ""]}>
              {data!.items.map((a) => (
                <tr key={a.id} className="hover:bg-white/[.02]">
                  <td className="px-4 py-3">
                    <SeverityBadge severity={a.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/vehicles/${a.vehicle_id}`} className="font-medium hover:text-brand">
                      {lookup.label(a.vehicle_id)}
                    </Link>
                  </td>
                  <td className="max-w-sm px-4 py-3">
                    <div className="flex items-center gap-2"><p>{a.message}</p>{a.is_simulated && <Badge tone="amber">Test simulation</Badge>}</div>
                    <p className="text-xs text-muted">Threshold: {a.threshold}</p>
                  </td>
                  <td className="px-4 py-3 text-muted" title={formatDateTime(a.first_observed_at)}>
                    {timeAgo(a.first_observed_at)}
                  </td>
                  <td className="px-4 py-3 text-muted" title={formatDateTime(a.last_observed_at)}>
                    {timeAgo(a.last_observed_at)}
                  </td>
                  <td className="px-4 py-3">
                    <AlertStateBadge alert={a} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AckButton alert={a} />
                  </td>
                </tr>
              ))}
            </Table>
            <Pager pagination={data!.pagination} onPage={setPage} />
          </>
        )}
      </div>
    </>
  );
}
