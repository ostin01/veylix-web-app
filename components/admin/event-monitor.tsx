"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { Badge, Button, EmptyState, Spinner } from "@/components/ui";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { LocalEvent } from "./types";

export function EventMonitor({ events, loading, refreshing, clearing, onRefresh, onClear }: {
  events: LocalEvent[];
  loading: boolean;
  refreshing: boolean;
  clearing: boolean;
  onRefresh: () => void;
  onClear: () => void;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="font-semibold">Recent test events</h2><p className="mt-1 text-xs text-muted">Simulation outcomes; loaded on demand</p></div><Badge tone="gray">No polling</Badge></div>
      <div className="border-b border-line px-5 py-2 text-xs text-muted">Simulated records are marked and can be removed with Clear test data.</div>
      {loading ? <Spinner /> : events.length ? <div className="max-h-[300px] overflow-y-auto divide-y divide-line/70">{events.map(event => <div key={event.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-5 py-3"><span className="mt-1.5 size-2 rounded-full bg-warn" /><div className="min-w-0"><p className="truncate font-mono text-xs text-brand-2">{event.type}</p><p className="mt-1 truncate text-xs text-muted">{event.detail} · {event.vehicle} · by {event.triggered_by}</p><p className="mt-1 text-[10px] text-amber-200">Simulated · {event.outcome}</p></div><time className="text-[11px] text-muted" title={formatDateTime(event.at)}>{timeAgo(event.at)}</time></div>)}</div> : <EmptyState title="No simulation events yet" hint="Choose a vehicle and scenario to run a backend simulation." />}
      <div className="flex items-center gap-2 border-t border-line px-5 py-3"><Button variant="subtle" size="sm" onClick={onRefresh} disabled={refreshing}><RefreshCw className="size-3.5" /> {refreshing ? "Loading…" : "Refresh"}</Button><Button variant="subtle" size="sm" disabled={!events.length || clearing} onClick={onClear}><Trash2 className="size-3.5" /> {clearing ? "Clearing…" : "Clear test data"}</Button></div>
    </section>
  );
}
