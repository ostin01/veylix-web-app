"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Supercluster, { type ClusterFeature, type PointFeature } from "supercluster";
import { Locate } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseUtc, timeAgo, vehicleLabel } from "@/lib/format";
import { useVehicle } from "@/lib/hooks";
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

const LEGEND: { state: MarkerState; label: string }[] = [
  { state: "moving", label: "Moving" },
  { state: "parked", label: "Parked" },
  { state: "warning", label: "Warning" },
  { state: "critical", label: "Critical" },
  { state: "stale", label: "No recent data" },
];

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
const TILE_URL = CUSTOM_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION
  || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function markerIcon(color: string, stale: boolean): L.CircleMarkerOptions {
  return {
    radius: 7,
    color: "#070b18",
    weight: 2,
    fillColor: color,
    fillOpacity: stale ? 0.55 : 1,
  };
}

export function FleetMap({
  latest,
  worstAlert,
  fullScreen = false,
}: {
  latest: VehicleLatestTelemetry[];
  worstAlert: Map<string, AlertSeverity>;
  fullScreen?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [viewportVersion, setViewportVersion] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const renderer = useRef<L.Canvas | null>(null);
  const fitted = useRef(false);

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
  const selectedVehicle = useVehicle(selected?.vehicleId);

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = L.map(container.current, {
      center: [52.3676, 4.9041],
      zoom: 7,
      zoomControl: true,
      attributionControl: true,
    });
    const canvas = L.canvas({ padding: 0.5 });
    let errors = 0;
    const tiles = L.tileLayer(TILE_URL, {
      attribution: ATTRIBUTION,
      className: CUSTOM_TILE_URL ? undefined : "vx-map-tiles-dark",
      subdomains: "abcd",
      maxZoom: 19,
    });
    const handleViewportChange = () => setViewportVersion((version) => version + 1);
    const handleMapClick = () => setSelectedId(null);
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
    map.current = m;
    markerLayer.current = L.layerGroup().addTo(m);
    renderer.current = canvas;
    const currentMarkerLayer = markerLayer.current;
    return () => {
      m.off("click", handleMapClick);
      m.off("moveend zoomend", handleViewportChange);
      m.remove();
      map.current = null;
      markerLayer.current = null;
      renderer.current = null;
      currentMarkerLayer.clearLayers();
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
    const layer = markerLayer.current;
    if (!m || !layer) return;
    layer.clearLayers();
    if (points.length === 0) return;

    const bounds = m.getBounds();
    const clusters = clusterIndex.getClusters(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      Math.floor(m.getZoom()),
    );
    for (const feature of clusters) {
      const [lon, lat] = feature.geometry.coordinates;
      if ("cluster" in feature.properties && feature.properties.cluster) {
        const cluster = feature as ClusterFeature<MapPointProperties>;
        const count = cluster.properties.point_count;
        const diameter = Math.min(48, 30 + Math.log10(count) * 5);
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
          m.setView([lat, lon], clusterIndex.getClusterExpansionZoom(cluster.properties.cluster_id), {
            animate: true,
          });
        });
        marker.addTo(layer);
        continue;
      }

      const vehicleId = feature.properties.vehicleId;
      const point = pointsById.get(vehicleId);
      if (!point) continue;
      const marker = L.circleMarker([lat, lon], {
        ...markerIcon(COLORS[point.state], point.stale),
        renderer: renderer.current ?? undefined,
      });
      marker.bindTooltip(`Vehicle ${vehicleId.slice(0, 8)}`, { direction: "top" });
      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        setSelectedId(vehicleId);
      });
      marker.addTo(layer);
    }
  }, [clusterIndex, points.length, pointsById, selectedId, viewportVersion]);

  const fitAll = () => {
    if (!map.current || points.length === 0) return;
    map.current.fitBounds(L.latLngBounds(points.map((point) => [point.lat, point.lon])), {
      padding: [40, 40],
      maxZoom: 15,
    });
  };

  const vehicle = selectedVehicle.data;
  const selectedLabel = vehicle ? vehicleLabel(vehicle) : selected?.vehicleId.slice(0, 8);

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
            <span className="size-2.5 rounded-full" style={{ background: COLORS[item.state] }} />
            {item.label}
          </li>
        ))}
      </ul>

      <div className="absolute right-3 top-3 z-[500] flex items-center gap-2">
        <p className="rounded-md border border-line bg-bg/85 px-2.5 py-1 text-xs text-muted backdrop-blur">
          {points.length.toLocaleString()} positions
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
        <div className="absolute right-3 top-14 z-[500] w-60 rounded-xl border border-line bg-surface-2/95 p-4 text-sm shadow-xl backdrop-blur">
          <div className="flex items-center gap-2 font-medium">
            <span className="size-2.5 rounded-full" style={{ background: COLORS[selected.state] }} />
            {selectedLabel}
          </div>
          {vehicle && (
            <p className="mt-1 text-xs text-muted">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <dt className="text-muted">Speed</dt>
            <dd className="text-right tabular-nums">{selected.latest.speed_kmh?.value != null ? `${selected.latest.speed_kmh.value.toFixed(0)} km/h` : "—"}</dd>
            <dt className="text-muted">Battery</dt>
            <dd className="text-right tabular-nums">{selected.latest.battery_soc_percent?.value != null ? `${selected.latest.battery_soc_percent.value.toFixed(0)}%` : "—"}</dd>
            <dt className="text-muted">Updated</dt>
            <dd className="text-right">{timeAgo(selected.latest.latitude?.observed_at)}</dd>
          </dl>
          <Link href={`/vehicles/${selected.vehicleId}`} className="mt-3 inline-block text-xs text-brand hover:underline">
            View details →
          </Link>
        </div>
      )}
    </div>
  );
}
