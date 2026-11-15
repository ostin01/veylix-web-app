"use client";

import { useAuth } from "@/lib/auth";
import { History, Link2, Link2Off, Pencil, Plus, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import {
  Badge,
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
  connectionTone,
  useToast,
} from "@/components/ui";
import { api, nullable } from "@/lib/api";
import { formatDateTime, timeAgo, titleCase, vehicleLabel } from "@/lib/format";
import { useApiMutation, useDeviceAssignments, useDevices, useVehicles } from "@/lib/hooks";
import type { Device, DeviceConnectionStatus, Vehicle } from "@/lib/types";

function useVehicleOptions() {
  return useVehicles({ page: 1, page_size: 100, sort_by: "make", sort_order: "asc" });
}

function VehicleSelect({ value, onChange, vehicles, required }: { value: string; onChange: (v: string) => void; vehicles: Vehicle[]; required?: boolean }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{required ? "Select a vehicle…" : "Unassigned"}</option>
      {vehicles.map((v) => (
        <option key={v.id} value={v.id}>
          {vehicleLabel(v)} — {v.year} {v.make} {v.model}
        </option>
      ))}
    </select>
  );
}

function RegisterForm({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const vehicles = useVehicleOptions();
  const [serial, setSerial] = useState("");
  const [type, setType] = useState("telematics");
  const [firmware, setFirmware] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const save = useApiMutation(() =>
    api.devices.create({
      serial_number: serial.trim(),
      device_type: type.trim(),
      firmware_version: nullable(firmware),
      vehicle_id: vehicleId || null,
    }),
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined, {
      onSuccess: () => {
        toast("Device registered");
        onClose();
      },
    });
  };
  return (
    <Modal title="Register device" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Serial number">
          <input className="input" required maxLength={100} value={serial} onChange={(e) => setSerial(e.target.value)} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Device type">
            <input className="input" required maxLength={50} value={type} onChange={(e) => setType(e.target.value)} />
          </Field>
          <Field label="Firmware version">
            <input className="input" maxLength={50} value={firmware} onChange={(e) => setFirmware(e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Assign to vehicle" hint="Optional. Telemetry is only accepted from a device assigned to a vehicle.">
          <VehicleSelect value={vehicleId} onChange={setVehicleId} vehicles={vehicles.data?.items ?? []} />
        </Field>
        {save.error && <ErrorBanner error={save.error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!serial.trim() || !type.trim()}>
            Register device
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditForm({ device, onClose }: { device: Device; onClose: () => void }) {
  const toast = useToast();
  const [type, setType] = useState(device.device_type);
  const [firmware, setFirmware] = useState(device.firmware_version ?? "");
  const save = useApiMutation(() => api.devices.update(device.id, { device_type: type.trim(), firmware_version: nullable(firmware) }));
  return (
    <Modal title={`Edit ${device.serial_number}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, {
            onSuccess: () => {
              toast("Device updated");
              onClose();
            },
          });
        }}
      >
        <Field label="Device type">
          <input className="input" required maxLength={50} value={type} onChange={(e) => setType(e.target.value)} />
        </Field>
        <Field label="Firmware version">
          <input className="input" maxLength={50} value={firmware} onChange={(e) => setFirmware(e.target.value)} />
        </Field>
        {save.error && <ErrorBanner error={save.error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!type.trim()}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AssignForm({ device, onClose }: { device: Device; onClose: () => void }) {
  const toast = useToast();
  const vehicles = useVehicleOptions();
  const [vehicleId, setVehicleId] = useState("");
  const save = useApiMutation(() => api.devices.assign(device.id, vehicleId));
  return (
    <Modal title={device.vehicle_id ? "Reassign device" : "Assign device"} onClose={onClose} width="max-w-md">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, {
            onSuccess: () => {
              toast("Device assigned");
              onClose();
            },
          });
        }}
      >
        <p className="text-sm text-muted">
          Choose the vehicle that <strong className="text-ink">{device.serial_number}</strong> is installed in. Any previous assignment is closed and kept in the history.
        </p>
        <Field label="Vehicle">
          <VehicleSelect required value={vehicleId} onChange={setVehicleId} vehicles={(vehicles.data?.items ?? []).filter((v) => v.id !== device.vehicle_id)} />
        </Field>
        {save.error && <ErrorBanner error={save.error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!vehicleId}>
            Assign
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryDialog({ device, onClose }: { device: Device; onClose: () => void }) {
  const history = useDeviceAssignments(device.id);
  const vehicles = useVehicleOptions();
  const name = (id: string) => {
    const v = vehicles.data?.items.find((x) => x.id === id);
    return v ? vehicleLabel(v) : id.slice(0, 8);
  };
  return (
    <Modal title={`Assignment history · ${device.serial_number}`} onClose={onClose} width="max-w-2xl">
      {history.isLoading ? (
        <Spinner />
      ) : history.error ? (
        <ErrorBanner error={history.error} />
      ) : history.data!.length === 0 ? (
        <EmptyState title="Never assigned" hint="This device has not been installed in a vehicle yet." />
      ) : (
        <Table head={["Vehicle", "Assigned", "Unassigned"]}>
          {[...history.data!].reverse().map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-3 font-medium">{name(a.vehicle_id)}</td>
              <td className="px-4 py-3 text-muted">{formatDateTime(a.assigned_at)}</td>
              <td className="px-4 py-3">{a.unassigned_at ? <span className="text-muted">{formatDateTime(a.unassigned_at)}</span> : <Badge tone="green">Current</Badge>}</td>
            </tr>
          ))}
        </Table>
      )}
    </Modal>
  );
}

type Dialog = { kind: "register" } | { kind: "edit" | "assign" | "history" | "unassign"; device: Device } | null;

function DevicesView() {
  const { canWrite } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [connection, setConnection] = useState<DeviceConnectionStatus | "">("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog>(null);

  const { data, isLoading, error, refetch } = useDevices({ page, page_size: 10, search, connection_status: connection });
  const vehicles = useVehicleOptions();
  const vehicleName = (id: string | null) => {
    if (!id) return null;
    const v = vehicles.data?.items.find((x) => x.id === id);
    return v ? vehicleLabel(v) : id.slice(0, 8);
  };
  const unassign = useApiMutation((id: string) => api.devices.unassign(id));
  const close = () => setDialog(null);

  return (
    <>
      <PageHeader
        title="Devices"
        subtitle="Telematics units, their vehicle assignment and connectivity."
        actions={
          canWrite ? (
            <Button onClick={() => setDialog({ kind: "register" })}>
              <Plus className="size-4" /> Register device
            </Button>
          ) : undefined
        }
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search serial, type or firmware" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search devices" />
        </form>
        <select
          className="input w-auto"
          value={connection}
          onChange={(e) => {
            setConnection(e.target.value as DeviceConnectionStatus | "");
            setPage(1);
          }}
          aria-label="Filter by connection"
        >
          <option value="">Any connection</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="unknown">Unknown</option>
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
            title={search || connection ? "No devices match these filters" : "No devices yet"}
            hint={search || connection ? "Try clearing a filter." : "Register a device, then assign it to a vehicle."}
          />
        ) : (
          <>
            <Table head={["Serial number", "Type", "Firmware", "Vehicle", "Connection", "Last seen", ""]}>
              {data!.items.map((d) => (
                <tr key={d.id} className="hover:bg-white/[.02]">
                  <td className="px-4 py-3 font-medium">{d.serial_number}</td>
                  <td className="px-4 py-3 text-muted">{d.device_type}</td>
                  <td className="px-4 py-3 text-muted">{d.firmware_version ?? "—"}</td>
                  <td className="px-4 py-3">{vehicleName(d.vehicle_id) ?? <span className="text-muted">Unassigned</span>}</td>
                  <td className="px-4 py-3">
                    <Badge tone={connectionTone[d.connection_status]}>{titleCase(d.connection_status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{timeAgo(d.last_seen_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canWrite && <>
                      <Button size="sm" variant="subtle" onClick={() => setDialog({ kind: "assign", device: d })} aria-label={`${d.vehicle_id ? "Reassign" : "Assign"} ${d.serial_number}`} title={d.vehicle_id ? "Reassign" : "Assign"}>
                        <Link2 className="size-4" />
                      </Button>
                      {d.vehicle_id && (
                        <Button size="sm" variant="subtle" onClick={() => setDialog({ kind: "unassign", device: d })} aria-label={`Unassign ${d.serial_number}`} title="Unassign">
                          <Link2Off className="size-4" />
                        </Button>
                      )}
                      </>}
                      <Button size="sm" variant="subtle" onClick={() => setDialog({ kind: "history", device: d })} aria-label={`History for ${d.serial_number}`} title="Assignment history">
                        <History className="size-4" />
                      </Button>
                      {canWrite && (
                        <Button size="sm" variant="subtle" onClick={() => setDialog({ kind: "edit", device: d })} aria-label={`Edit ${d.serial_number}`} title="Edit">
                          <Pencil className="size-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
            <Pager pagination={data!.pagination} onPage={setPage} />
          </>
        )}
      </div>

      {dialog?.kind === "register" && <RegisterForm onClose={close} />}
      {dialog?.kind === "edit" && <EditForm device={dialog.device} onClose={close} />}
      {dialog?.kind === "assign" && <AssignForm device={dialog.device} onClose={close} />}
      {dialog?.kind === "history" && <HistoryDialog device={dialog.device} onClose={close} />}
      {dialog?.kind === "unassign" && (
        <ConfirmDialog
          title="Unassign device"
          confirmLabel="Unassign"
          message={
            <>
              Remove <strong className="text-ink">{dialog.device.serial_number}</strong> from its vehicle? Telemetry from it will be rejected until it is assigned again.
            </>
          }
          loading={unassign.isPending}
          error={unassign.error}
          onClose={() => {
            unassign.reset();
            close();
          }}
          onConfirm={() =>
            unassign.mutate(dialog.device.id, {
              onSuccess: () => {
                toast("Device unassigned");
                close();
              },
            })
          }
        />
      )}
    </>
  );
}

export default function DevicesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <DevicesView />
    </Suspense>
  );
}
