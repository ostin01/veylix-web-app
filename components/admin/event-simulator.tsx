"use client";

import { Activity } from "lucide-react";
import type { FormEvent } from "react";
import { Badge, Button, Field } from "@/components/ui";
import { scenarios, type Scenario } from "./types";

export function EventSimulator({ vehicles, vehicleId, scenario, username, onVehicleChange, onScenarioChange, onSimulate }: {
  vehicles: { id: string; label: string; detail: string }[];
  vehicleId: string;
  scenario: Scenario;
  username: string;
  onVehicleChange: (id: string) => void;
  onScenarioChange: (scenario: Scenario) => void;
  onSimulate: (event: FormEvent) => void;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="font-semibold">Event simulator</h2><p className="mt-1 text-xs text-muted">Create a local UI preview for a selected vehicle</p></div><Badge tone="amber">Preview only</Badge></div>
      <form onSubmit={onSimulate} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vehicle"><select className="input" required value={vehicleId} onChange={e => onVehicleChange(e.target.value)}><option value="">Select a vehicle…</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.label} · {v.detail}</option>)}</select></Field>
          <Field label="Scenario"><select className="input" value={scenario} onChange={e => onScenarioChange(e.target.value as Scenario)}>{scenarios.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        </div>
        <div className="rounded-lg border border-warn/25 bg-warn/5 p-3 text-xs leading-relaxed text-muted"><p className="font-medium text-amber-200">Frontend preview only</p><p className="mt-1">This does not publish MQTT telemetry, write an alert, change vehicle/device state, or reach the backend. The backend repository currently describes a simulator that publishes demo MQTT messages, while MQTT ingestion and API integration are still future work.</p></div>
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted">Triggered by {username}</span><Button type="submit" disabled={!vehicleId}><Activity className="size-4" /> Add preview event</Button></div>
      </form>
    </section>
  );
}
