"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { Button, EmptyState, ErrorBanner, Modal, PageHeader, Pager, Spinner, Table } from "@/components/ui";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useDeadLetters } from "@/lib/hooks";
import type { DeadLetter } from "@/lib/types";

function decodePayload(b64: string): string {
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  } catch {
    return "(payload could not be decoded)";
  }
}

export default function QuarantinePage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useDeadLetters({ page, page_size: 15 });
  const [open, setOpen] = useState<DeadLetter | null>(null);

  return (
    <>
      <PageHeader
        title="Quarantine"
        subtitle="Telemetry messages the consumer rejected or could not process. Nothing is silently dropped."
      />

      <div className="card overflow-hidden">
        {error ? (
          <div className="p-4">
            <ErrorBanner error={error} onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <Spinner />
        ) : data!.items.length === 0 ? (
          <EmptyState title="Nothing quarantined" hint="Invalid, unregistered or unassigned-device messages will be listed here with the reason they were rejected." />
        ) : (
          <>
            <Table head={["Last seen", "Error", "Reason", "Topic", "Attempts", ""]}>
              {data!.items.map((d) => (
                <tr key={d.id} className="hover:bg-white/[.02]">
                  <td className="px-4 py-3 text-muted" title={formatDateTime(d.last_seen_at)}>
                    {timeAgo(d.last_seen_at)}
                  </td>
                  <td className="px-4 py-3 font-medium">{d.error_type}</td>
                  <td className="max-w-md px-4 py-3 text-muted">
                    <p className="line-clamp-2" title={d.reason}>
                      {d.reason}
                    </p>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-muted" title={d.topic}>
                    {d.topic}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">{d.attempts}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setOpen(d)}>
                      <Eye className="size-4" /> Payload
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
            <Pager pagination={data!.pagination} onPage={setPage} />
          </>
        )}
      </div>

      {open && (
        <Modal title="Quarantined message" onClose={() => setOpen(null)} width="max-w-2xl">
          <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Error</dt>
              <dd>{open.error_type}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">First seen</dt>
              <dd>{formatDateTime(open.first_seen_at)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-muted">Reason</dt>
              <dd className="break-words">{open.reason}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-muted">Topic</dt>
              <dd className="break-all font-mono text-xs">{open.topic}</dd>
            </div>
          </dl>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted">Payload</p>
          <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-bg p-3 text-xs">{decodePayload(open.payload_base64)}</pre>
        </Modal>
      )}
    </>
  );
}
