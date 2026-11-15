"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorBanner, Field, Modal, PageHeader, Spinner, Table, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { titleCase } from "@/lib/format";
import { useApiMutation, useDiagnosticProfiles } from "@/lib/hooks";
import type { DiagnosticProfile, DiagnosticThreshold, ThresholdSignal, VehicleType } from "@/lib/types";

const SIGNALS: { id: ThresholdSignal; label: string; unit: string }[] = [
  { id: "motor_temperature_c", label: "Motor temperature", unit: "°C" },
  { id: "battery_soc_percent", label: "Battery charge", unit: "%" },
  { id: "battery_voltage_v", label: "Battery voltage", unit: "V" },
  { id: "tire_pressure_psi", label: "Tire pressure", unit: "psi" },
  { id: "speed_kmh", label: "Speed", unit: "km/h" },
  { id: "rpm", label: "Engine RPM", unit: "rpm" },
];
const FIELDS = ["critical_min", "warning_min", "warning_max", "critical_max"] as const;
const FIELD_LABEL: Record<(typeof FIELDS)[number], string> = {
  critical_min: "Critical below",
  warning_min: "Warning below",
  warning_max: "Warning above",
  critical_max: "Critical above",
};
const TYPES: VehicleType[] = ["electric", "hybrid", "petrol", "diesel"];

type Draft = Record<ThresholdSignal, Record<(typeof FIELDS)[number], string>>;

function toDraft(t: DiagnosticProfile["thresholds"] | undefined): Draft {
  const d = {} as Draft;
  for (const s of SIGNALS) {
    const th = t?.[s.id];
    d[s.id] = Object.fromEntries(FIELDS.map((f) => [f, th?.[f] != null ? String(th[f]) : ""])) as Draft[ThresholdSignal];
  }
  return d;
}

function fromDraft(d: Draft): Partial<Record<ThresholdSignal, DiagnosticThreshold>> {
  const out: Partial<Record<ThresholdSignal, DiagnosticThreshold>> = {};
  for (const s of SIGNALS) {
    const th: DiagnosticThreshold = {};
    for (const f of FIELDS) {
      const raw = d[s.id][f].trim();
      if (raw !== "" && Number.isFinite(Number(raw))) th[f] = Number(raw);
    }
    if (Object.keys(th).length > 0) out[s.id] = th;
  }
  return out;
}

function ProfileForm({ profile, onClose }: { profile?: DiagnosticProfile; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(profile?.name ?? "");
  const [type, setType] = useState<VehicleType>(profile?.vehicle_type ?? "electric");
  const [battery, setBattery] = useState(profile?.battery_configuration ?? "");
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile?.thresholds));
  const thresholds = fromDraft(draft);

  const save = useApiMutation(() =>
    profile
      ? api.diagnosticProfiles.update(profile.id, { name: name.trim(), battery_configuration: battery.trim(), thresholds })
      : api.diagnosticProfiles.create({ name: name.trim(), vehicle_type: type, battery_configuration: battery.trim(), thresholds }),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined, {
      onSuccess: () => {
        toast(profile ? "Profile updated" : "Profile created");
        onClose();
      },
    });
  };

  return (
    <Modal title={profile ? `Edit ${profile.name}` : "New diagnostic profile"} onClose={onClose} width="max-w-3xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name">
            <input className="input" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Vehicle type" hint={profile ? "Cannot be changed" : undefined}>
            <select className="input" value={type} disabled={!!profile} onChange={(e) => setType(e.target.value as VehicleType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Battery configuration">
            <input className="input" required maxLength={100} value={battery} onChange={(e) => setBattery(e.target.value)} placeholder="e.g. 400V NMC" />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs text-muted">
            Leave a signal blank to not monitor it. Warning and critical values for a bound must be set together; critical must be further out than warning.
          </p>
          <div className="space-y-3">
            {SIGNALS.map((s) => (
              <fieldset key={s.id} className="rounded-lg border border-line p-3">
                <legend className="px-1 text-xs font-medium">
                  {s.label} <span className="text-muted">({s.unit})</span>
                </legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {FIELDS.map((f) => (
                    <label key={f} className="block text-xs text-muted">
                      {FIELD_LABEL[f]}
                      <input
                        className="input mt-1"
                        type="number"
                        step="any"
                        value={draft[s.id][f]}
                        onChange={(e) => setDraft((d) => ({ ...d, [s.id]: { ...d[s.id], [f]: e.target.value } }))}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        {save.error && <ErrorBanner error={save.error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!name.trim() || !battery.trim() || Object.keys(thresholds).length === 0}>
            {profile ? "Save changes" : "Create profile"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function summarize(p: DiagnosticProfile): string {
  const n = Object.keys(p.thresholds).length;
  return `${n} ${n === 1 ? "signal" : "signals"} monitored`;
}

export default function ProfilesPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useDiagnosticProfiles();
  const [editing, setEditing] = useState<DiagnosticProfile | "new" | null>(null);
  const [deleting, setDeleting] = useState<DiagnosticProfile | null>(null);
  const remove = useApiMutation((id: string) => api.diagnosticProfiles.remove(id));

  return (
    <>
      <PageHeader
        title="Diagnostic profiles"
        subtitle="Thresholds that decide when telemetry raises a warning or critical alert. Assign a profile to each vehicle."
        actions={
          isAdmin ? (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> New profile
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
          <EmptyState title="No profiles" hint="Default profiles are created by the backend migrations." />
        ) : (
          <Table head={["Name", "Vehicle type", "Battery", "Coverage", ""]}>
            {data!.items.map((p) => (
              <tr key={p.id} className="hover:bg-white/[.02]">
                <td className="px-4 py-3 font-medium">
                  {p.name} {p.is_default && <Badge tone="blue">Default</Badge>}
                </td>
                <td className="px-4 py-3 text-muted">{titleCase(p.vehicle_type)}</td>
                <td className="px-4 py-3 text-muted">{p.battery_configuration}</td>
                <td className="px-4 py-3 text-muted">{summarize(p)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="subtle" onClick={() => setEditing(p)} aria-label={`${isAdmin ? "Edit" : "View"} ${p.name}`}>
                      <Pencil className="size-4" /> {isAdmin ? "" : "View"}
                    </Button>
                    {isAdmin && !p.is_default && (
                      <Button size="sm" variant="subtle" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      {editing && isAdmin && <ProfileForm profile={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {editing && editing !== "new" && !isAdmin && <ProfileView profile={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          message="Profiles assigned to vehicles cannot be deleted; reassign those vehicles first."
          loading={remove.isPending}
          error={remove.error}
          onClose={() => {
            setDeleting(null);
            remove.reset();
          }}
          onConfirm={() =>
            remove.mutate(deleting.id, {
              onSuccess: () => {
                toast("Profile deleted");
                setDeleting(null);
              },
            })
          }
        />
      )}
    </>
  );
}

function ProfileView({ profile, onClose }: { profile: DiagnosticProfile; onClose: () => void }) {
  return (
    <Modal title={profile.name} onClose={onClose} width="max-w-xl">
      <Table head={["Signal", "Critical below", "Warning below", "Warning above", "Critical above"]}>
        {SIGNALS.filter((s) => profile.thresholds[s.id]).map((s) => {
          const t = profile.thresholds[s.id]!;
          return (
            <tr key={s.id}>
              <td className="px-3 py-2">{s.label}</td>
              {FIELDS.map((f) => (
                <td key={f} className="px-3 py-2 tabular-nums text-muted">
                  {t[f] ?? "—"}
                </td>
              ))}
            </tr>
          );
        })}
      </Table>
    </Modal>
  );
}
