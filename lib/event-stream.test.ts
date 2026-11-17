import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { isDomainEvent, parseSseFrame, updateLatestTelemetryCache } from "./event-stream";

describe("SSE event handling", () => {
  it("parses event names and multi-line data while ignoring heartbeats", () => {
    expect(parseSseFrame(": keep-alive\n\nevent: alert.created\ndata: {\n\ndata:  \"id\": \"a1\"\n\ndata: }" )).toEqual({
      eventName: "alert.created",
      data: "{\n\"id\": \"a1\"\n}",
    });
    expect(parseSseFrame(": keep-alive")).toEqual({ eventName: null, data: null });
  });

  it("validates envelopes and patches only the affected vehicle's latest telemetry", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["telemetry-latest"], [
      { vehicle_id: "v1", latitude: null, longitude: null, speed_kmh: null, battery_soc_percent: null },
      { vehicle_id: "v2", latitude: null, longitude: null, speed_kmh: null, battery_soc_percent: null },
    ]);
    const event = {
      id: "event-1", type: "telemetry.received", vehicle_id: "v1",
      data: { latest_signals: { latitude: { value: 6.5, unit: "degrees", observed_at: "2026-11-17T12:00:00Z" }, battery_soc_percent: { value: 82, unit: "%", observed_at: "2026-11-17T12:00:00Z" } } },
    };
    expect(isDomainEvent(event)).toBe(true);
    updateLatestTelemetryCache(queryClient, event);
    const rows = queryClient.getQueryData<any[]>(["telemetry-latest"])!;
    expect(rows[0].latitude.value).toBe(6.5);
    expect(rows[0].battery_soc_percent.value).toBe(82);
    expect(rows[1].latitude).toBeNull();
    expect(isDomainEvent({ type: "alert.created" })).toBe(false);
    queryClient.clear();
  });
});