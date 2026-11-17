"use client";

import { Trash2 } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { LocalEvent } from "./types";

export function EventMonitor({ events, hasPreview, onClear }: { events: LocalEvent[]; hasPreview: boolean; onClear: () => void }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="font-semibold">Live event monitor</h2><p className="mt-1 text-xs text-muted">Recent frontend preview events</p></div><Badge tone="gray"><span className="size-1.5 rounded-full bg-muted" /> SSE unavailable</Badge></div>
      {hasPreview && <div className="border-b border-warn/20 bg-warn/5 px-5 py-2 text-xs text-amber-200">Preview events below are local to this browser and are not a live stream.</div>}
      {events.length ? <div className="max-h-[300px] overflow-y-auto divide-y divide-line/70">{events.map(event => <div key={event.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-5 py-3"><span className="mt-1.5 size-2 rounded-full bg-warn" /><div className="min-w-0"><p className="truncate font-mono text-xs text-brand-2">{event.type}</p><p className="mt-1 truncate text-xs text-muted">{event.detail} · {event.vehicle}</p></div><time className="text-[11px] text-muted" title={formatDateTime(event.at)}>{timeAgo(event.at)}</time></div>)}</div> : <EmptyState title="No preview events yet" hint="Choose a vehicle and scenario to add a clearly marked local preview." />}
      <div className="border-t border-line px-5 py-3"><Button variant="subtle" size="sm" disabled={!events.length} onClick={onClear}><Trash2 className="size-3.5" /> Clear local preview</Button></div>
    </section>
  );
}
