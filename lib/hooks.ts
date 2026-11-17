"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api, type AlertQuery, type DeviceQuery, type TelemetryQuery, type VehicleQuery } from "./api";
import { vehicleLabel } from "./format";

const LIVE_MS = 15_000;

export function useHealth(live = true) {
  return useQuery({
    queryKey: ["health"],
    queryFn: api.health,
  });
}

export function useFleets(q: { page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: ["fleets", q],
    queryFn: () => api.fleets.list(q),
    placeholderData: keepPreviousData,
  });
}

export function useFleet(id: string | null | undefined) {
  return useQuery({
    queryKey: ["fleet", id],
    queryFn: () => api.fleets.get(id as string),
    enabled: !!id,
  });
}

export function useVehicles(q: VehicleQuery = {}, live = true) {
  return useQuery({
    queryKey: ["vehicles", q],
    queryFn: () => api.vehicles.list(q),
    placeholderData: keepPreviousData,
  });
}

export function useVehicle(id: string | null | undefined) {
  return useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => api.vehicles.get(id as string),
    enabled: !!id,
  });
}

export function useDevices(q: DeviceQuery = {}, live = true) {
  return useQuery({
    queryKey: ["devices", q],
    queryFn: () => api.devices.list(q),
    placeholderData: keepPreviousData,
  });
}

export function useDevice(id: string | null | undefined) {
  return useQuery({
    queryKey: ["device", id],
    queryFn: () => api.devices.get(id as string),
    enabled: !!id,
  });
}

export function useDeviceAssignments(id: string | null | undefined) {
  return useQuery({
    queryKey: ["device-assignments", id],
    queryFn: () => api.devices.assignments(id as string),
    enabled: !!id,
  });
}

/** Total row count for a filtered list, using a 1-item page so nothing is downloaded. */
export function useVehicleTotal(filter: VehicleQuery = {}) {
  return useQuery({
    queryKey: ["vehicles-total", filter],
    queryFn: async () => (await api.vehicles.list({ ...filter, page: 1, page_size: 1 })).pagination.total_items,
  });
}

export function useDeviceTotal(filter: DeviceQuery = {}) {
  return useQuery({
    queryKey: ["devices-total", filter],
    queryFn: async () => (await api.devices.list({ ...filter, page: 1, page_size: 1 })).pagination.total_items,
  });
}

export function useFleetTotal() {
  return useQuery({
    queryKey: ["fleets-total"],
    queryFn: async () => (await api.fleets.list({ page: 1, page_size: 1 })).pagination.total_items,
  });
}

/** Any write can change counts, lists and details, so refresh everything. */
export function useApiMutation<TArgs = void, TResult = unknown>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries(),
  });
}

/* ---------- Alerts, telemetry and health ---------- */

export function useAlerts(q: AlertQuery = {}, live = true) {
  return useQuery({
    queryKey: ["alerts", q],
    queryFn: () => api.alerts.list(q),
    placeholderData: keepPreviousData,
  });
}

export function useAlertSummary(vehicleId?: string, live = true) {
  return useQuery({
    queryKey: ["alerts-summary", vehicleId ?? null],
    queryFn: () => api.alerts.summary(vehicleId),
  });
}

/** Open alert count for badges (from /alerts/summary). */
export function useActiveAlertTotal(live = true) {
  const q = useAlertSummary(undefined, live);
  return { ...q, data: q.data?.active_alerts };
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.users.list()).items,
    enabled,
  });
}

export function useDiagnosticProfiles(q: { vehicle_type?: string } = {}) {
  return useQuery({
    queryKey: ["diagnostic-profiles", q],
    queryFn: () => api.diagnosticProfiles.list({ page: 1, page_size: 100, ...q }),
    staleTime: 30_000,
  });
}

export function useLatestTelemetry() {
  return useQuery({
    queryKey: ["telemetry-latest"],
    queryFn: async () => (await api.telemetry.latest()).items,
  });
}

export function useVehicleHealth(id: string | null | undefined) {
  return useQuery({
    queryKey: ["vehicle-health", id],
    queryFn: () => api.telemetry.health(id as string),
    enabled: !!id,
  });
}

export function useVehicleTelemetry(id: string | null | undefined, q: TelemetryQuery = {}) {
  return useQuery({
    queryKey: ["vehicle-telemetry", id, q],
    queryFn: () => api.telemetry.forVehicle(id as string, q),
    enabled: !!id,
  });
}

export function useDeadLetters(q: { page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: ["dead-letters", q],
    queryFn: () => api.telemetry.deadLetters(q),
    placeholderData: keepPreviousData,
  });
}

/** Resolve vehicle names for lists of alerts/devices (first 100 vehicles). */
export function useVehicleLookup() {
  const q = useVehicles({ page: 1, page_size: 100 });
  const byId = new Map((q.data?.items ?? []).map((v) => [v.id, v]));
  return {
    byId,
    isLoading: q.isLoading,
    label: (id: string) => {
      const v = byId.get(id);
      return v ? vehicleLabel(v) : id.slice(0, 8);
    },
  };
}
