"use client";

import { useAuth } from "@/lib/auth";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { VehicleForm } from "@/components/vehicle-form";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Pager,
  Spinner,
  Table,
  useToast,
  vehicleStatusTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { titleCase, vehicleLabel } from "@/lib/format";
import { useApiMutation, useFleets, useVehicles } from "@/lib/hooks";
import type { Vehicle, VehicleStatus } from "@/lib/types";

function VehiclesView() {
  const { canWrite } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();

  const urlSearch = params.get("search") ?? "";
  const fleetId = params.get("fleet_id") ?? "";
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [status, setStatus] = useState<VehicleStatus | "">("");
  const [sortBy, setSortBy] = useState<"created_at" | "make" | "model">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);

  // Keep the box in sync when the top-bar search navigates here.
  useEffect(() => {
    setSearchInput(urlSearch);
    setPage(1);
  }, [urlSearch]);

  const fleets = useFleets({ page: 1, page_size: 100 });
  const fleetName = (id: string) => fleets.data?.items.find((f) => f.id === id)?.name ?? "—";

  const { data, isLoading, error, refetch } = useVehicles({
    page,
    page_size: 10,
    fleet_id: fleetId,
    status,
    search: urlSearch,
    sort_by: sortBy,
    sort_order: sortOrder,
  });
  const remove = useApiMutation((id: string) => api.vehicles.remove(id));

  const setUrl = (next: { search?: string; fleet_id?: string }) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    setPage(1);
    router.replace(`/vehicles${sp.toString() ? `?${sp}` : ""}`);
  };

  return (
    <>
      <PageHeader
        title="Vehicles"
        subtitle="Register, search and manage every vehicle."
        actions={
          canWrite ? (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Register vehicle
            </Button>
          ) : undefined
        }
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setUrl({ search: searchInput.trim() });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="Search VIN, registration, make or model"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search vehicles"
          />
        </form>
        <select className="input w-auto" value={fleetId} onChange={(e) => setUrl({ fleet_id: e.target.value })} aria-label="Filter by fleet">
          <option value="">All fleets</option>
          {fleets.data?.items.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as VehicleStatus | "");
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          className="input w-auto"
          value={`${sortBy}:${sortOrder}`}
          onChange={(e) => {
            const [by, order] = e.target.value.split(":");
            setSortBy(by as typeof sortBy);
            setSortOrder(order as typeof sortOrder);
          }}
          aria-label="Sort"
        >
          <option value="created_at:desc">Newest first</option>
          <option value="created_at:asc">Oldest first</option>
          <option value="make:asc">Make A–Z</option>
          <option value="model:asc">Model A–Z</option>
        </select>
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
            title={urlSearch || fleetId || status ? "No vehicles match these filters" : "No vehicles yet"}
            hint={urlSearch || fleetId || status ? "Try clearing a filter." : "Register your first vehicle to get started."}
          />
        ) : (
          <>
            <Table head={["Vehicle", "Fleet", "Type", "VIN", "Registration", "Status", ""]}>
              {data!.items.map((v) => (
                <tr key={v.id} className="hover:bg-white/[.02]">
                  <td className="px-4 py-3">
                    <Link href={`/vehicles/${v.id}`} className="font-medium hover:text-brand">
                      {vehicleLabel(v)}
                    </Link>
                    <p className="text-xs text-muted">
                      {v.year} {v.make} {v.model}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted">{fleetName(v.fleet_id)}</td>
                  <td className="px-4 py-3 text-muted">{titleCase(v.vehicle_type)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{v.vin ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{v.registration_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={vehicleStatusTone[v.status]}>{titleCase(v.status)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canWrite && <>
                      <Button size="sm" variant="subtle" onClick={() => setEditing(v)} aria-label={`Edit ${vehicleLabel(v)}`}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="subtle" onClick={() => setDeleting(v)} aria-label={`Delete ${vehicleLabel(v)}`}>
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

      {editing && <VehicleForm vehicle={editing === "new" ? undefined : editing} defaultFleetId={fleetId} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete vehicle"
          message={
            <>
              Delete <strong className="text-ink">{vehicleLabel(deleting)}</strong>? Vehicles with device assignment or telemetry history cannot be deleted — set them to inactive instead.
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
                toast("Vehicle deleted");
                setDeleting(null);
              },
            })
          }
        />
      )}
    </>
  );
}

export default function VehiclesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <VehiclesView />
    </Suspense>
  );
}
