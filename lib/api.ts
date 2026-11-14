import type {
  Alert,
  DeadLetter,
  Device,
  DeviceAssignment,
  DeviceConnectionStatus,
  DeviceInput,
  DeviceUpdateInput,
  Fleet,
  FleetInput,
  Page,
  TelemetryReading,
  Vehicle,
  VehicleHealth,
  VehicleInput,
  VehicleLatestTelemetry,
  VehicleStatus,
} from "./types";

const BASE = "/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function describeDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  // FastAPI 422: [{ loc: [...], msg: "..." }]
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((p) => p !== "body").join(".") : "";
        return field ? `${field}: ${d.msg}` : (d.msg ?? "invalid value");
      })
      .join("; ");
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Cannot reach the Veylix API. Is the backend running?");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = undefined;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    // non-JSON error (e.g. proxy 500)
  }
  if (!res.ok) {
    const detail = (body as { detail?: unknown } | undefined)?.detail;
    throw new ApiError(res.status, describeDetail(detail, `Request failed (${res.status})`));
  }
  return body as T;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(params: Query = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// Empty strings from forms become null so optional fields clear correctly.
export function nullable(value: string | undefined | null): string | null {
  const v = (value ?? "").trim();
  return v === "" ? null : v;
}

export interface VehicleQuery extends Query {
  page?: number;
  page_size?: number;
  fleet_id?: string;
  status?: VehicleStatus | "";
  search?: string;
  sort_by?: "created_at" | "make" | "model";
  sort_order?: "asc" | "desc";
}

export interface DeviceQuery extends Query {
  page?: number;
  page_size?: number;
  vehicle_id?: string;
  connection_status?: DeviceConnectionStatus | "";
  search?: string;
  sort_by?: "created_at" | "serial_number";
  sort_order?: "asc" | "desc";
}

export interface AlertQuery extends Query {
  page?: number;
  page_size?: number;
  vehicle_id?: string;
  active?: boolean | "";
}

export interface TelemetryQuery extends Query {
  page?: number;
  page_size?: number;
  signal_name?: string;
  device_id?: string;
  start_time?: string;
  end_time?: string;
}

export const api = {
  health: async (): Promise<boolean> => {
    try {
      const res = await fetch("/backend-health", { cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  },

  fleets: {
    list: (q: Query = {}) => request<Page<Fleet>>(`/fleets${qs(q)}`),
    get: (id: string) => request<Fleet>(`/fleets/${id}`),
    create: (body: FleetInput) =>
      request<Fleet>("/fleets", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<FleetInput>) =>
      request<Fleet>(`/fleets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/fleets/${id}`, { method: "DELETE" }),
  },

  vehicles: {
    list: (q: VehicleQuery = {}) => request<Page<Vehicle>>(`/vehicles${qs(q)}`),
    get: (id: string) => request<Vehicle>(`/vehicles/${id}`),
    create: (body: VehicleInput) =>
      request<Vehicle>("/vehicles", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<VehicleInput>) =>
      request<Vehicle>(`/vehicles/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/vehicles/${id}`, { method: "DELETE" }),
  },

  alerts: {
    list: (q: AlertQuery = {}) => request<Page<Alert>>(`/alerts${qs(q)}`),
    acknowledge: (id: string) => request<Alert>(`/alerts/${id}/acknowledge`, { method: "POST" }),
  },

  telemetry: {
    latest: () => request<{ items: VehicleLatestTelemetry[] }>("/telemetry/latest"),
    deadLetters: (q: Query = {}) => request<Page<DeadLetter>>(`/telemetry/dead-letters${qs(q)}`),
    forVehicle: (id: string, q: TelemetryQuery = {}) =>
      request<Page<TelemetryReading>>(`/vehicles/${id}/telemetry${qs(q)}`),
    health: (id: string) => request<VehicleHealth>(`/vehicles/${id}/health`),
  },

  devices: {
    list: (q: DeviceQuery = {}) => request<Page<Device>>(`/devices${qs(q)}`),
    get: (id: string) => request<Device>(`/devices/${id}`),
    create: (body: DeviceInput) =>
      request<Device>("/devices", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: DeviceUpdateInput) =>
      request<Device>(`/devices/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    assign: (id: string, vehicle_id: string) =>
      request<Device>(`/devices/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({ vehicle_id }),
      }),
    unassign: (id: string) => request<Device>(`/devices/${id}/assignment`, { method: "DELETE" }),
    assignments: (id: string) => request<DeviceAssignment[]>(`/devices/${id}/assignments`),
  },
};
