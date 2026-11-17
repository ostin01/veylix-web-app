import type { QueryClient } from "@tanstack/react-query";
import type { VehicleLatestTelemetry } from "./types";

export type DomainEvent = {
  id: string;
  type: string;
  vehicle_id?: string | null;
  device_id?: string | null;
  data?: Record<string, unknown>;
};

export function isDomainEvent(value: unknown): value is DomainEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<DomainEvent>;
  return typeof event.id === "string" && typeof event.type === "string" &&
    !!event.data && typeof event.data === "object";
}

export function parseSseFrame(frame: string): { eventName: string | null; data: string | null } {
  let eventName: string | null = null;
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return { eventName, data: data.length ? data.join("\n") : null };
}

export function updateLatestTelemetryCache(queryClient: Pick<QueryClient, "setQueryData">, event: DomainEvent): void {
  if (!event.vehicle_id) return;
  const data = event.data ?? {};
  const values = (data.latest_signals && typeof data.latest_signals === "object" ? data.latest_signals : data) as Record<string, unknown>;
  queryClient.setQueryData<VehicleLatestTelemetry[]>(["telemetry-latest"], (rows) => {
    if (!rows) return rows;
    const signal = (value: unknown, previous: VehicleLatestTelemetry["latitude"]) => {
      if (typeof value === "number") return { value, unit: previous?.unit ?? "", observed_at: typeof data.observed_at === "string" ? data.observed_at : new Date().toISOString(), is_simulated: data.simulated === true };
      if (value && typeof value === "object" && typeof (value as { value?: unknown }).value === "number") {
        const next = value as { value: number; unit?: string; observed_at?: string; is_simulated?: boolean };
        return { value: next.value, unit: next.unit ?? previous?.unit ?? "", observed_at: next.observed_at ?? new Date().toISOString(), is_simulated: next.is_simulated ?? data.simulated === true };
      }
      return previous;
    };
    return rows.map((row) => row.vehicle_id !== event.vehicle_id ? row : {
      ...row,
      latitude: signal(values.latitude, row.latitude),
      longitude: signal(values.longitude, row.longitude),
      speed_kmh: signal(values.speed_kmh, row.speed_kmh),
      battery_soc_percent: signal(values.battery_soc_percent, row.battery_soc_percent),
    });
  });
}