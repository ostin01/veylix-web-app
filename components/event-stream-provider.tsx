"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isDomainEvent, parseSseFrame, updateLatestTelemetryCache, type DomainEvent } from "@/lib/event-stream";

export function EventStreamProvider() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (loading || !user) return;
    let stopped = false;
    let controller: AbortController | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let batchTimer: ReturnType<typeof setTimeout> | undefined;
    let retryMs = 1000;
    let reconnecting = false;
    let connectedOnce = false;
    let telemetryTimer: ReturnType<typeof setTimeout> | undefined;
    const telemetryRefreshIds = new Set<string>();
    const healthRefreshIds = new Set<string>();
    const seen = new Set<string>();
    const locationBatch = new Map<string, DomainEvent>();

    const recoverSnapshots = async () => {
      await Promise.all(["telemetry-latest", "vehicles", "devices", "alerts", "alerts-summary", "vehicle-health", "vehicle-telemetry", "vehicle", "device", "health"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key], refetchType: "active" }),
      ));
    };
    const scheduleTelemetryRefresh = (id: string, health: boolean) => {
      telemetryRefreshIds.add(id);
      if (health) healthRefreshIds.add(id);
      if (telemetryTimer) return;
      telemetryTimer = setTimeout(() => {
        for (const vehicleId of telemetryRefreshIds) void queryClient.invalidateQueries({ queryKey: ["vehicle-telemetry", vehicleId], refetchType: "active" });
        for (const vehicleId of healthRefreshIds) void queryClient.invalidateQueries({ queryKey: ["vehicle-health", vehicleId], refetchType: "active" });
        telemetryRefreshIds.clear();
        healthRefreshIds.clear();
        telemetryTimer = undefined;
      }, 1000);
    };    const applyEvent = (event: DomainEvent) => {
      const vehicleId = event.vehicle_id;
      switch (event.type) {
        case "vehicle.location.updated": updateLatestTelemetryCache(queryClient, event); break;
        case "vehicle.health.updated":
          if (vehicleId) scheduleTelemetryRefresh(vehicleId, true);
          break;
        case "telemetry.received":
          updateLatestTelemetryCache(queryClient, event);
          if (vehicleId) scheduleTelemetryRefresh(vehicleId, false);
          break;        case "vehicle.status.updated":
          if (vehicleId) void queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId], refetchType: "active" });
          void queryClient.invalidateQueries({ queryKey: ["vehicles"], refetchType: "active" });
          break;
        case "device.status.updated": case "device.connected": case "device.disconnected":
          if (event.device_id) void queryClient.invalidateQueries({ queryKey: ["device", event.device_id], refetchType: "active" });
          void queryClient.invalidateQueries({ queryKey: ["devices"], refetchType: "active" });
          break;
        case "alert.created": case "alert.updated": case "alert.acknowledged": case "alert.resolved":
          void queryClient.invalidateQueries({ queryKey: ["alerts"], refetchType: "active" });
          void queryClient.invalidateQueries({ queryKey: ["alerts-summary"], refetchType: "active" });
          break;
        case "admin.simulation.created":
          void queryClient.invalidateQueries({ queryKey: ["admin-events"], refetchType: "active" });
          break;
      }
    };

    const connect = async () => {
      const connectedAt = Date.now();
      controller = new AbortController();
      try {
        const response = await fetch("/api/v1/events/stream", {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
          headers: { accept: "text/event-stream" },
        });
        if (response.status === 401) { stopped = true; window.location.assign("/login?reason=expired"); return; }
        if (!response.ok || !response.body) throw new Error(`Event stream returned ${response.status}`);
        if (!connectedOnce || reconnecting) await recoverSnapshots();
        connectedOnce = true;
        reconnecting = false;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let boundary: number;
          while ((boundary = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const parsedFrame = parseSseFrame(frame);
            if (parsedFrame.eventName === "stream.reset") { await recoverSnapshots(); continue; }
            if (!parsedFrame.data) continue;
            let parsed: unknown;
            try { parsed = JSON.parse(parsedFrame.data); } catch { continue; }
            if (!isDomainEvent(parsed) || seen.has(parsed.id)) continue;
            seen.add(parsed.id);
            if (seen.size > 2000) seen.clear();
            if ((parsed.type === "vehicle.location.updated" || parsed.type === "telemetry.received") && parsed.vehicle_id) {
              const previous = locationBatch.get(parsed.vehicle_id);
              const priorSignals = (previous?.data?.latest_signals ?? {}) as Record<string, unknown>;
              const data = parsed.data ?? {};
              const nextSignals = { ...((data.latest_signals ?? {}) as Record<string, unknown>) };
              for (const name of ["latitude", "longitude", "speed_kmh", "battery_soc_percent"]) {
                if (typeof data[name] === "number") nextSignals[name] = { value: data[name], observed_at: data.observed_at, is_simulated: data.simulated === true };
              }
              locationBatch.set(parsed.vehicle_id, {
                ...parsed,
                data: { ...(previous?.data ?? {}), ...data, latest_signals: { ...priorSignals, ...nextSignals } },
              });
              if (!batchTimer) batchTimer = setTimeout(() => {
                for (const event of locationBatch.values()) {
                  updateLatestTelemetryCache(queryClient, event);
                  if (event.vehicle_id) scheduleTelemetryRefresh(event.vehicle_id, false);
                }
                locationBatch.clear();
                batchTimer = undefined;
              }, 500);
            } else applyEvent(parsed);
          }
        }
      } catch (error) {
        if (!stopped && !(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Veylix event stream disconnected; reconnecting", error);
        }
      } finally {
        if (!stopped) {
          reconnecting = true;
          if (Date.now() - connectedAt >= 30_000) retryMs = 1000;
          reconnectTimer = setTimeout(connect, retryMs);
          retryMs = Math.min(retryMs * 2, 30_000);
        }
      }
    };

    void connect();
    return () => {
      stopped = true;
      controller?.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (batchTimer) clearTimeout(batchTimer);
      if (telemetryTimer) clearTimeout(telemetryTimer);
    };
  }, [loading, user?.id, queryClient]);

  return null;
}