"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api, type AlertQuery, type DeviceQuery, type TelemetryQuery, type VehicleQuery } from "./api";
import { vehicleLabel } from "./format";

const LIVE_MS = 15_000;

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 10_000,
  });
}

export function useFleets(q: { page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: ["fleets", q],
    queryFn: () => api.fleets.list(q),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_MS,
  });
}

export function useFleet(id: string | null | undefined) {
  return useQuery({
    queryKey: ["fleet", id],
    queryFn: () => api.fleets.get(id as string),
    enabled: !!id,
  });
}

export function useVehicles(q: VehicleQuery = {}) {
  return useQuery({
    queryKey: ["vehicles", q],
    queryFn: () => api.vehicles.list(q),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_MS,
  });
}

export function useVehicle(id: string | null | undefined) {
  return useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => api.vehicles.get(id as string),
    enabled: !!id,
    refetchInterval: LIVE_MS,
  });
}

export function useDevices(q: DeviceQuery = {}) {
  return useQuery({
    queryKey: ["devices", q],
    queryFn: () => api.devices.list(q),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_MS,
  });
}

export function useDevice(id: string | null | undefined) {
  return useQuery({
    queryKey: ["device", id],
    queryFn: () => api.devices.get(id as string),
    enabled: !!id,
    refetchInterval: LIVE_MS,
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
    refetchInterval: LIVE_MS,
  });
}

export function useDeviceTotal(filter: DeviceQuery = {}) {
  return useQuery({
    queryKey: ["devices-total", filter],
    queryFn: async () => (await api.devices.list({ ...filter, page: 1, page_size: 1 })).pagination.total_items,
    refetchInterval: LIVE_MS,
  });
}

export function useFleetTotal() {
  return useQuery({
    queryKey: ["fleets-total"],
    queryFn: async () => (await api.fleets.list({ page: 1, page_size: 1 })).pagination.total_items,
    refetchInterval: LIVE_MS,
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

export function useAlerts(q: AlertQuery = {}) {
  return useQuery({
    queryKey: ["alerts", q],
    queryFn: () => api.alerts.list(q),
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
  });
}

export function useActiveAlertTotal() {
  return useQuery({
    queryKey: ["alerts-total-active"],
    queryFn: async () => (await api.alerts.list({ active: true, page: 1, page_size: 1 })).pagination.total_items,
    refetchInterval: 10_000,
  });
}

export function useLatestTelemetry() {
  return useQuery({
    queryKey: ["telemetry-latest"],
    queryFn: async () => (await api.telemetry.latest()).items,
    refetchInterval: 5_000,
  });
}

export function useVehicleHealth(id: string | null | undefined) {
  return useQuery({
    queryKey: ["vehicle-health", id],
    queryFn: () => api.telemetry.health(id as string),
    enabled: !!id,
    refetchInterval: 5_000,
  });
}

export function useVehicleTelemetry(id: string | null | undefined, q: TelemetryQuery = {}) {
  return useQuery({
    queryKey: ["vehicle-telemetry", id, q],
    queryFn: () => api.telemetry.forVehicle(id as string, q),
    enabled: !!id,
    refetchInterval: 5_000,
  });
}

export function useDeadLetters(q: { page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: ["dead-letters", q],
    queryFn: () => api.telemetry.deadLetters(q),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
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
