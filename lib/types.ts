export type VehicleStatus = "active" | "inactive" | "maintenance";
export type VehicleType = "electric" | "hybrid" | "petrol" | "diesel";
export type DeviceConnectionStatus = "unknown" | "online" | "offline";

export interface Pagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface Page<T> {
  items: T[];
  pagination: Pagination;
}

export interface Fleet {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  fleet_id: string;
  name: string | null;
  vin: string | null;
  registration_number: string | null;
  make: string;
  model: string;
  year: number;
  vehicle_type: VehicleType;
  status: VehicleStatus;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  serial_number: string;
  vehicle_id: string | null;
  device_type: string;
  firmware_version: string | null;
  connection_status: DeviceConnectionStatus;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceAssignment {
  id: string;
  device_id: string;
  vehicle_id: string;
  assigned_at: string;
  unassigned_at: string | null;
}

export type FleetInput = {
  name: string;
  description?: string | null;
  location?: string | null;
};

export type VehicleInput = {
  fleet_id: string;
  name?: string | null;
  vin?: string | null;
  registration_number?: string | null;
  make: string;
  model: string;
  year: number;
  vehicle_type: VehicleType;
  status: VehicleStatus;
};

export type DeviceInput = {
  serial_number: string;
  device_type: string;
  firmware_version?: string | null;
  vehicle_id?: string | null;
};

export type DeviceUpdateInput = {
  device_type?: string;
  firmware_version?: string | null;
};

/* ---------- Telemetry, health and alerts ---------- */

export type AlertSeverity = "warning" | "critical";

export interface Alert {
  id: string;
  vehicle_id: string;
  device_id: string;
  code: string;
  signal_name: string;
  severity: AlertSeverity;
  message: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string;
  threshold: string;
  first_observed_at: string;
  last_observed_at: string;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export type HealthIndicatorStatus = "unknown" | "normal" | "warning" | "critical";
export type VehicleHealthStatus = "unknown" | "healthy" | "warning" | "critical";

export interface HealthIndicator {
  signal_name: string;
  status: HealthIndicatorStatus;
  value: number | string | null;
  unit: string | null;
  observed_at: string | null;
  threshold: string | null;
  message: string;
}

export interface VehicleHealth {
  vehicle_id: string;
  status: VehicleHealthStatus;
  score: number | null;
  indicators: HealthIndicator[];
}

export interface LatestSignal {
  value: number | null;
  unit: string;
  observed_at: string;
}

export interface VehicleLatestTelemetry {
  vehicle_id: string;
  latitude: LatestSignal | null;
  longitude: LatestSignal | null;
  speed_kmh: LatestSignal | null;
  battery_soc_percent: LatestSignal | null;
}

export interface TelemetryReading {
  id: string;
  vehicle_id: string;
  device_id: string;
  signal_name: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string;
  observed_at: string;
  received_at: string;
  schema_version: number;
  message_id: string;
}

export interface DeadLetter {
  id: string;
  message_hash: string;
  topic: string;
  payload_base64: string;
  error_type: string;
  reason: string;
  attempts: number;
  first_seen_at: string;
  last_seen_at: string;
}
