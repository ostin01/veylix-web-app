import type { AdminEvent, AdminScenario } from "@/lib/types";

export type Scenario = AdminScenario;
export type LocalEvent = AdminEvent;

export const scenarios: { id: Scenario; label: string; event: string; detail: string }[] = [
  { id: "vehicle_moves", label: "Vehicle moves", event: "vehicle.location.updated", detail: "Preview location update" },
  { id: "battery_drops", label: "Battery drops", event: "alert.created", detail: "Preview low battery alert" },
  { id: "overspeed", label: "Speed exceeds limit", event: "alert.created", detail: "Preview overspeed alert" },
  { id: "device_offline", label: "Device disconnects", event: "device.status.changed", detail: "Preview offline status" },
  { id: "device_reconnects", label: "Device reconnects", event: "device.status.changed", detail: "Preview online status" },
  { id: "engine_fault", label: "Engine fault detected", event: "vehicle.health.updated", detail: "Preview health change" },
];
