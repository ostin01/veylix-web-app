"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Supercluster, { type ClusterFeature, type PointFeature } from "supercluster";
import { BatteryMedium, Gauge, Locate, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseUtc, timeAgo, vehicleLabel } from "@/lib/format";
import { useVehicleLookup } from "@/lib/hooks";
import type { AlertSeverity, VehicleLatestTelemetry } from "@/lib/types";

const STALE_AFTER_MS = 2 * 60 * 1000;

const COLORS = {
  moving: "#22c55e",
  parked: "#3b82f6",
  warning: "#f59e0b",
  critical: "#ef4444",
  stale: "#64748b",
} as const;
type MarkerState = keyof typeof COLORS;

const STATE_LABEL: Record<MarkerState, string> = {
  moving: "Moving",
  parked: "Parked",
  warning: "Warning",
  critical: "Critical",
  stale: "No recent data",
};

const LEGEND: { state: MarkerState; label: string }[] = [
  { state: "moving", label: "Moving" },
  { state: "parked", label: "Parked / idle" },
  { state: "warning", label: "Warning alert" },
  { state: "critical", label: "Critical alert" },
  { state: "stale", label: "No recent data" },
];

// Top-down car, nose pointing up (north). Colour comes from CSS (`currentColor`).
const CAR_SVG = `<svg class="vx-car-body" viewBox="0 0 24 40" width="20" height="34" aria-hidden="true">
  <rect x="2" y="8" width="3" height="8" rx="1.3" fill="#070b18"/><rect x="19" y="8" width="3" height="8" rx="1.3" fill="#070b18"/>
  <rect x="2" y="26" width="3" height="8" rx="1.3" fill="#070b18"/><rect x="19" y="26" width="3" height="8" rx="1.3" fill="#070b18"/>
  <rect x="4" y="2" width="16" height="36" rx="7" fill="currentColor" stroke="#070b18" stroke-width="1.4"/>
  <path d="M7 12.5 Q12 9.5 17 12.5 L16.4 17.5 Q12 16 7.6 17.5 Z" fill="#0b1226" opacity=".85"/>
  <path d="M7.6 28 Q12 26.6 16.4 28 L17 31.4 Q12 33.4 7 31.4 Z" fill="#0b1226" opacity=".85"/>
  <rect x="7.5" y="18.5" width="9" height="7" rx="2" fill="#fff" opacity=".22"/>
</svg>`;

interface Point {
  vehicleId: string;
  latest: VehicleLatestTelemetry;
  lat: number;
  lon: number;
  state: MarkerState;
  stale: boolean;
}

interface MapPointProperties {
  vehicleId: string;
}

const CUSTOM_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL;
// OSM has no "d" subdomain, so use the single canonical host.
const TILE_URL = CUSTOM_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION
  || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function carIcon(): L.DivIcon {
  return L.divIcon({
    className: "vx-car",
    html: `<div class="vx-car-wrap"><span class="vx-car-halo"></span>${CAR_SVG}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

/** Metres moved and compass bearing (0 = north) between two coordinates. */
function movement(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const dy = (to.lat - from.lat) * 111_320;
  const dx = (to.lon - from.lon) * 111_320 * Math.cos((to.lat * Math.PI) / 180);
  return { meters: Math.hypot(dx, dy), bearing: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360 };
}

interface Rec {
  marker: L.Marker;
}

export function FleetMap({
  latest,
  worstAlert,
  fullScreen = false,
  updatedAt,
}: {
  latest: VehicleLatestTelemetry[];
  worstAlert: Map<string, AlertSeverity>;
  fullScreen?: boolean;
  /** Timestamp (ms) of the last successful data refresh; enables the "Live" badge. */
  updatedAt?: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [viewportVersion, setViewportVersion] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const clusterLayer = useRef<L.LayerGroup | null>(null);
  const vehicleMarkers = useRef(new Map<string, Rec>());
  const lastPos = useRef(new Map<string, { lat: number; lon: number; heading: number }>());
  const fitted = useRef(false);
  const lookup = useVehicleLookup();
  const labelRef = useRef(lookup.label);
  labelRef.current = lookup.label;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!updatedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [updatedAt]);

  const points = useMemo<Point[]>(() => {
    const now = Date.now();
    const out: Point[] = [];
    for (const reading of latest) {
      const latitude = reading.latitude;
      const longitude = reading.longitude;
      const lat = latitude?.value;
      const lon = longitude?.value;
      if (!latitude || !longitude || lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      const observed = Math.max(
        parseUtc(latitude.observed_at).getTime(),
        parseUtc(longitude.observed_at).getTime(),
      );
      const stale = now - observed > STALE_AFTER_MS;
      const alert = worstAlert.get(reading.vehicle_id);
      const speed = reading.speed_kmh?.value ?? 0;
      const state: MarkerState = alert ?? (stale ? "stale" : speed >= 1 ? "moving" : "parked");
      out.push({ vehicleId: reading.vehicle_id, latest: reading, lat, lon, state, stale });
    }
    return out;
  }, [latest, worstAlert]);

  const pointsById = useMemo(() => new Map(points.map((point) => [point.vehicleId, point])), [points]);
  const clusterIndex = useMemo(() => {
    const features: PointFeature<MapPointProperties>[] = points.map((point) => ({
      type: "Feature",
      properties: { vehicleId: point.vehicleId },
      geometry: { type: "Point", coordinates: [point.lon, point.lat] },
    }));
    return new Supercluster<MapPointProperties>({ radius: 56, maxZoom: 16 }).load(features);
  }, [points]);

  const selected = pointsById.get(selectedId ?? "") ?? null;
  const selectedVehicle = selected ? lookup.byId.get(selected.vehicleId) : undefined;

  useEffect(() => {
    if (!container.current || map.current) return;
    const el = container.current;
    const m = L.map(el, {
      center: [52.3676, 4.9041],
      zoom: 7,
      zoomControl: true,
      attributionControl: true,
    });
    let errors = 0;
    const tiles = L.tileLayer(TILE_URL, {
      attribution: ATTRIBUTION,
      className: CUSTOM_TILE_URL ? undefined : "vx-map-tiles-dark",
      maxZoom: 19,
    });
    const handleViewportChange = () => setViewportVersion((version) => version + 1);
    const handleMapClick = () => setSelectedId(null);
    // Marker glide animation must not run while the map itself is zooming.
    const zoomStart = () => el.classList.add("vx-map-zooming");
    const zoomEnd = () => el.classList.remove("vx-map-zooming");
    tiles.on("tileerror", () => {
      errors += 1;
      if (errors >= 3) setTilesFailed(true);
    });
    tiles.on("tileload", () => {
      errors = 0;
      setTilesFailed(false);
    });
    tiles.addTo(m);
    m.on("click", handleMapClick);
    m.on("moveend zoomend", handleViewportChange);
    m.on("zoomstart", zoomStart);
    m.on("zoomend", zoomEnd);
    map.current = m;
    clusterLayer.current = L.layerGroup().addTo(m);
    const markers = vehicleMarkers.current;
    return () => {
      m.off("click", handleMapClick);
      m.off("moveend zoomend", handleViewportChange);
      m.off("zoomstart", zoomStart);
      m.off("zoomend", zoomEnd);
      m.remove();
      map.current = null;
      clusterLayer.current = null;
      markers.clear();
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || points.length === 0 || fitted.current) return;
    fitted.current = true;
    m.fitBounds(L.latLngBounds(points.map((point) => [point.lat, point.lon])), {
      padding: [40, 40],
      maxZoom: 15,
    });
  }, [points]);

  useEffect(() => {
    const m = map.current;
    const clusters = clusterLayer.current;
    if (!m || !clusters) return;
    clusters.clearLayers();

    // Track heading from successive positions (the API has no heading signal).
    for (const point of points) {
      const prev = lastPos.current.get(point.vehicleId);
      if (!prev) {
        lastPos.current.set(point.vehicleId, { lat: point.lat, lon: point.lon, heading: 0 });
      } else {
        const mv = movement(prev, point);
        if (mv.meters > 2) lastPos.current.set(point.vehicleId, { lat: point.lat, lon: point.lon, heading: mv.bearing });
      }
    }

    const keep = new Set<string>();
    if (points.length > 0) {
      const bounds = m.getBounds().pad(0.25);
      const found = clusterIndex.getClusters(
        [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        Math.floor(m.getZoom()),
      );
      for (const feature of found) {
        const [lon, lat] = feature.geometry.coordinates;
        if ("cluster" in feature.properties && feature.properties.cluster) {
          const cluster = feature as ClusterFeature<MapPointProperties>;
          const count = cluster.properties.point_count;
          const diameter = Math.min(52, 32 + Math.log10(count) * 6);
          const marker = L.marker([lat, lon], {
            icon: L.divIcon({
              className: "vx-map-cluster-wrapper",
              html: `<span class="vx-map-cluster" style="width:${diameter}px;height:${diameter}px">${cluster.properties.point_count_abbreviated}</span>`,
              iconSize: [diameter, diameter],
            }),
            keyboard: true,
            title: `${count} vehicles`,
          });
          marker.on("click", (event) => {
            L.DomEvent.stopPropagation(event);
            m.setView([lat, lon], clusterIndex.getClusterExpansionZoom(cluster.properties.cluster_id), { animate: true });
          });
          marker.addTo(clusters);
          continue;
        }
        const vehicleId = feature.properties.vehicleId;
        const point = pointsById.get(vehicleId);
        if (!point) continue;
        keep.add(vehicleId);

        let rec = vehicleMarkers.current.get(vehicleId);
        if (!rec) {
          const marker = L.marker([point.lat, point.lon], { icon: carIcon(), keyboard: true, riseOnHover: true });
          marker.bindTooltip(labelRef.current(vehicleId), { direction: "top", offset: [0, -18], className: "vx-car-tip" });
          marker.on("click", (event) => {
            L.DomEvent.stopPropagation(event);
            setSelectedId(vehicleId);
          });
          rec = { marker };
          vehicleMarkers.current.set(vehicleId, rec);
        }
        if (!m.hasLayer(rec.marker)) rec.marker.addTo(m);
        const current = rec.marker.getLatLng();
        if (current.lat !== point.lat || current.lng !== point.lon) rec.marker.setLatLng([point.lat, point.lon]);
        rec.marker.setTooltipContent(labelRef.current(vehicleId));

        const el = rec.marker.getElement();
        if (el) {
          el.style.setProperty("--c", COLORS[point.state]);
          el.style.setProperty("--h", `${lastPos.current.get(vehicleId)?.heading ?? 0}deg`);
          el.classList.toggle("is-alert", point.state === "warning" || point.state === "critical");
          el.classList.toggle("is-stale", point.stale);
          el.classList.toggle("is-selected", vehicleId === selectedId);
        }
      }
    }
    for (const [id, rec] of vehicleMarkers.current) {
      if (keep.has(id)) continue;
      rec.marker.remove();
      if (!pointsById.has(id)) {
        vehicleMarkers.current.delete(id);
        lastPos.current.delete(id);
      }
    }
  }, [clusterIndex, points, pointsById, selectedId, viewportVersion, lookup.byId]);

  const fitAll = () => {
    if (!map.current || points.length === 0) return;
    map.current.fitBounds(L.latLngBounds(points.map((point) => [point.lat, point.lon])), {
      padding: [40, 40],
      maxZoom: 15,
    });
  };

  const vehicle = selectedVehicle;
  const selectedLabel = vehicle ? vehicleLabel(vehicle) : selected?.vehicleId.slice(0, 8);
  const ageSeconds = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;
  const soc = selected?.latest.battery_soc_percent?.value;

  return (
    <div className={`relative overflow-hidden bg-[#0b1226] ${fullScreen ? "h-full min-h-[420px]" : "h-[420px]"}`}>
      <div ref={container} className="absolute inset-0 z-0" aria-label="Fleet map" />

      {points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center px-6 text-center">
          <div className="rounded-xl border border-line bg-bg/85 px-5 py-4 backdrop-blur">
            <p className="font-medium">No vehicle positions yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Assign a device to a vehicle and send GPS telemetry. Vehicles without valid latitude and longitude are not shown.
            </p>
          </div>
        </div>
      )}

      <ul className="absolute bottom-6 left-3 z-[500] space-y-1.5 rounded-lg border border-line bg-bg/85 px-3 py-2.5 text-xs backdrop-blur">
        {LEGEND.map((item) => (
          <li key={item.state} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: COLORS[item.state], boxShadow: `0 0 8px ${COLORS[item.state]}` }} />
            {item.label}
          </li>
        ))}
      </ul>

      <div className="absolute right-3 top-3 z-[500] flex items-center gap-2">
        {ageSeconds !== null && (
          <p className="flex items-center gap-2 rounded-md border border-ok/30 bg-bg/85 px-2.5 py-1 text-xs text-green-300 backdrop-blur" title="Positions refresh every 5 seconds">
            <span className="vx-live-dot" aria-hidden />
            Live · {ageSeconds < 2 ? "just now" : `${ageSeconds}s ago`}
          </p>
        )}
        <p className="rounded-md border border-line bg-bg/85 px-2.5 py-1 text-xs text-muted backdrop-blur">
          {points.length.toLocaleString()} {points.length === 1 ? "vehicle" : "vehicles"}
        </p>
        <button
          onClick={fitAll}
          disabled={points.length === 0}
          aria-label="Fit all vehicles"
          title="Fit all vehicles"
          className="rounded-md border border-line bg-bg/85 p-1.5 text-muted backdrop-blur hover:text-ink disabled:opacity-40"
        >
          <Locate className="size-4" />
        </button>
      </div>

      {tilesFailed && (
        <p role="status" className="absolute left-1/2 top-14 z-[500] max-w-[90%] -translate-x-1/2 rounded-md border border-warn/40 bg-bg/90 px-3 py-1.5 text-xs text-warn">
          Map tiles could not be loaded (check your internet connection). Vehicle markers are still live.
        </p>
      )}

      {selected && (
        <div
          className="absolute right-3 top-14 z-[500] w-64 rounded-xl border p-4 text-sm shadow-2xl backdrop-blur"
          style={{ borderColor: `${COLORS[selected.state]}66`, background: "rgba(13,19,38,.94)", boxShadow: `0 0 28px -8px ${COLORS[selected.state]}` }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-semibold">{selectedLabel}</p>
            <button onClick={() => setSelectedId(null)} aria-label="Close" className="text-muted hover:text-ink">
              ×
            </button>
          </div>
          {vehicle && (
            <p className="text-xs text-muted">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          )}
          <p className="mt-2 flex items-center gap-2 text-xs" style={{ color: COLORS[selected.state] }}>
            <span className="size-2 rounded-full" style={{ background: COLORS[selected.state], boxShadow: `0 0 8px ${COLORS[selected.state]}` }} />
            {STATE_LABEL[selected.state]}
          </p>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted"><Gauge className="size-3.5" /> Speed</dt>
              <dd className="tabular-nums">{selected.latest.speed_kmh?.value != null ? `${selected.latest.speed_kmh.value.toFixed(0)} km/h` : "—"}</dd>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-muted"><BatteryMedium className="size-3.5" /> Battery</dt>
                <dd className="tabular-nums">{soc != null ? `${soc.toFixed(0)}%` : "—"}</dd>
              </div>
              {soc != null && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, soc))}%`, background: soc < 20 ? "#ef4444" : soc < 40 ? "#f59e0b" : "#22c55e" }} />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted"><MapPin className="size-3.5" /> Updated</dt>
              <dd>{timeAgo(selected.latest.latitude?.observed_at)}</dd>
            </div>
          </dl>
          <Link href={`/vehicles/${selected.vehicleId}`} className="mt-3 inline-block text-xs font-medium text-brand hover:underline">
            View details →
          </Link>
        </div>
      )}
    </div>
  );
}
