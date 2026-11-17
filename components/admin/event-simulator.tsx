"use client";

import { Activity } from "lucide-react";
import { Badge, Button, Field } from "@/components/ui";
import { scenarios, type Scenario } from "./types";

export function EventSimulator({ vehicles, vehicleId, scenario, onVehicleChange, onScenarioChange, onSimulate, pending }: {
  vehicles: { id: string; label: string; detail: string }[];
  vehicleId: string;
  scenario: Scenario;
  onVehicleChange: (id: string) => void;
  onScenarioChange: (scenario: Scenario) => void;
  onSimulate: () => void;
  pending: boolean;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="font-semibold">Event simulator</h2><p className="mt-1 text-xs text-muted">Run a marked test through telemetry processing for a selected vehicle</p></div><Badge tone="amber">Simulated</Badge></div>
      <form onSubmit={event => { event.preventDefault(); onSimulate(); }} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vehicle"><select className="input" required value={vehicleId} onChange={e => onVehicleChange(e.target.value)}><option value="">Select a vehicle…</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.label} · {v.detail}</option>)}</select></Field>
          <Field label="Scenario"><select className="input" value={scenario} onChange={e => onScenarioChange(e.target.value as Scenario)}>{scenarios.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        </div>
        <div className="rounded-lg border border-warn/25 bg-warn/5 p-3 text-xs leading-relaxed text-muted"><p className="font-medium text-amber-200">Simulation</p><p className="mt-1">This runs a marked sample through the backend telemetry rules. Matching alerts appear in Alerts with a Test simulation label. It does not publish MQTT or send vehicle commands. Use Clear test data to remove simulated readings and alerts.</p></div>
        <div className="flex flex-wrap items-center justify-between gap-3"><Button type="submit" disabled={!vehicleId || pending}><Activity className="size-4" /> {pending ? "Running…" : "Run simulation"}</Button></div>
      </form>
    </section>
  );
}
