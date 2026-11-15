"use client";

import { useState, type FormEvent } from "react";
import { api, nullable } from "@/lib/api";
import { useApiMutation, useDiagnosticProfiles, useFleets } from "@/lib/hooks";
import type { Vehicle, VehicleStatus, VehicleType } from "@/lib/types";
import { Button, ErrorBanner, Field, Modal, useToast } from "./ui";

const TYPES: VehicleType[] = ["electric", "hybrid", "petrol", "diesel"];
const STATUSES: VehicleStatus[] = ["active", "inactive", "maintenance"];

export function VehicleForm({ vehicle, defaultFleetId, onClose }: { vehicle?: Vehicle; defaultFleetId?: string; onClose: () => void }) {
  const toast = useToast();
  const fleets = useFleets({ page: 1, page_size: 100 });
  const [fleetId, setFleetId] = useState(vehicle?.fleet_id ?? defaultFleetId ?? "");
  const [name, setName] = useState(vehicle?.name ?? "");
  const [vin, setVin] = useState(vehicle?.vin ?? "");
  const [registration, setRegistration] = useState(vehicle?.registration_number ?? "");
  const [make, setMake] = useState(vehicle?.make ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [year, setYear] = useState(String(vehicle?.year ?? new Date().getFullYear()));
  const [type, setType] = useState<VehicleType>(vehicle?.vehicle_type ?? "electric");
  const [status, setStatus] = useState<VehicleStatus>(vehicle?.status ?? "active");

  const [profileId, setProfileId] = useState(vehicle?.diagnostic_profile_id ?? "");
  const profiles = useDiagnosticProfiles({ vehicle_type: type });
  // A profile only applies to one vehicle type; ignore a stale choice after the type changes.
  const profileChoice = profiles.data?.items.some((p) => p.id === profileId) ? profileId : "";

  const effectiveFleet = fleetId || fleets.data?.items[0]?.id || "";

  const save = useApiMutation(() => {
    const body = {
      fleet_id: effectiveFleet,
      name: nullable(name),
      vin: nullable(vin)?.toUpperCase() ?? null,
      registration_number: nullable(registration),
      make: make.trim(),
      model: model.trim(),
      year: Number(year),
      vehicle_type: type,
      status,
      // Omitted/empty means "use the default profile for this vehicle type".
      ...(profileChoice ? { diagnostic_profile_id: profileChoice } : {}),
    };
    return vehicle ? api.vehicles.update(vehicle.id, body) : api.vehicles.create(body);
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined, {
      onSuccess: () => {
        toast(vehicle ? "Vehicle updated" : "Vehicle registered");
        onClose();
      },
    });
  };

  const noFleets = fleets.isSuccess && fleets.data.items.length === 0;

  return (
    <Modal title={vehicle ? "Edit vehicle" : "Register vehicle"} onClose={onClose} width="max-w-2xl">
      {noFleets ? (
        <ErrorBanner error={new Error("Create a fleet first — every vehicle belongs to a fleet.")} />
      ) : (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Fleet">
            <select className="input" value={effectiveFleet} onChange={(e) => setFleetId(e.target.value)} required>
              {fleets.data?.items.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Display name" hint="Optional, e.g. VX-1047">
            <input className="input" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Make">
            <input className="input" required maxLength={50} value={make} onChange={(e) => setMake(e.target.value)} />
          </Field>
          <Field label="Model">
            <input className="input" required maxLength={50} value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
          <Field label="Year">
            <input className="input" type="number" required min={1900} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
          <Field label="Type">
            <select className="input" value={type} onChange={(e) => setType(e.target.value as VehicleType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t[0]!.toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Diagnostic profile" hint="Alert thresholds for this vehicle">
            <select className="input" value={profileChoice} onChange={(e) => setProfileId(e.target.value)}>
              <option value="">Default for {type}</option>
              {profiles.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.is_default ? " (default)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="VIN" hint="17 characters, no I, O or Q">
            <input
              className="input font-mono"
              maxLength={17}
              pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}"
              title="17 letters/digits, excluding I, O and Q"
              value={vin}
              onChange={(e) => setVin(e.target.value)}
              placeholder="Optional"
            />
          </Field>
          <Field label="Registration number">
            <input className="input" maxLength={20} value={registration} onChange={(e) => setRegistration(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Status">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as VehicleStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0]!.toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>

          {save.error && (
            <div className="sm:col-span-2">
              <ErrorBanner error={save.error} />
            </div>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending} disabled={!effectiveFleet || !make.trim() || !model.trim()}>
              {vehicle ? "Save changes" : "Register vehicle"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
