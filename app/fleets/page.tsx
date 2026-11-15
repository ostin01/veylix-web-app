"use client";

import { useAuth } from "@/lib/auth";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  Modal,
  PageHeader,
  Pager,
  Spinner,
  Table,
  useToast,
} from "@/components/ui";
import { api, nullable } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApiMutation, useFleets } from "@/lib/hooks";
import type { Fleet } from "@/lib/types";

function FleetForm({ fleet, onClose }: { fleet?: Fleet; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(fleet?.name ?? "");
  const [description, setDescription] = useState(fleet?.description ?? "");
  const [location, setLocation] = useState(fleet?.location ?? "");
  const save = useApiMutation(() => {
    const body = { name: name.trim(), description: nullable(description), location: nullable(location) };
    return fleet ? api.fleets.update(fleet.id, body) : api.fleets.create(body);
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined, {
      onSuccess: () => {
        toast(fleet ? "Fleet updated" : "Fleet created");
        onClose();
      },
    });
  };

  return (
    <Modal title={fleet ? "Edit fleet" : "New fleet"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <input className="input" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Location" hint="Optional, e.g. a depot or city">
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {save.error && <ErrorBanner error={save.error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!name.trim()}>
            {fleet ? "Save changes" : "Create fleet"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function FleetsPage() {
  const { canWrite } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useFleets({ page, page_size: 10 });
  const [editing, setEditing] = useState<Fleet | "new" | null>(null);
  const [deleting, setDeleting] = useState<Fleet | null>(null);
  const remove = useApiMutation((id: string) => api.fleets.remove(id));

  return (
    <>
      <PageHeader
        title="Fleets"
        subtitle="Group vehicles by depot, region or customer."
        actions={
          canWrite ? (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> New fleet
            </Button>
          ) : undefined
        }
      />

      <div className="card overflow-hidden">
        {error ? (
          <div className="p-4">
            <ErrorBanner error={error} onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <Spinner />
        ) : data!.items.length === 0 ? (
          <EmptyState
            title="No fleets yet"
            hint="A fleet is required before you can register vehicles."
            action={canWrite ? <Button onClick={() => setEditing("new")}>Create your first fleet</Button> : undefined}
          />
        ) : (
          <>
            <Table head={["Name", "Location", "Description", "Created", ""]}>
              {data!.items.map((f) => (
                <tr key={f.id} className="hover:bg-white/[.02]">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/vehicles?fleet_id=${f.id}`} className="hover:text-brand">
                      {f.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{f.location ?? "—"}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted">{f.description ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(f.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canWrite && <>
                      <Button size="sm" variant="subtle" onClick={() => setEditing(f)} aria-label={`Edit ${f.name}`}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="subtle" onClick={() => setDeleting(f)} aria-label={`Delete ${f.name}`}>
                        <Trash2 className="size-4" />
                      </Button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
            <Pager pagination={data!.pagination} onPage={setPage} />
          </>
        )}
      </div>

      {editing && <FleetForm fleet={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete fleet"
          message={
            <>
              Delete <strong className="text-ink">{deleting.name}</strong>? A fleet that still has vehicles cannot be deleted.
            </>
          }
          loading={remove.isPending}
          error={remove.error}
          onClose={() => {
            remove.reset();
            setDeleting(null);
          }}
          onConfirm={() =>
            remove.mutate(deleting.id, {
              onSuccess: () => {
                toast("Fleet deleted");
                setDeleting(null);
              },
            })
          }
        />
      )}
    </>
  );
}
