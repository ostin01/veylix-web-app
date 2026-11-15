"use client";

import { Check } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApiMutation } from "@/lib/hooks";
import type { Alert } from "@/lib/types";
import { Badge, Button, useToast } from "./ui";

export function SeverityBadge({ severity }: { severity: Alert["severity"] }) {
  return <Badge tone={severity === "critical" ? "red" : "amber"}>{severity === "critical" ? "Critical" : "Warning"}</Badge>;
}

export function AlertStateBadge({ alert }: { alert: Alert }) {
  const { user: me } = useAuth();
  if (alert.resolved_at) return <Badge tone="gray">Resolved</Badge>;
  if (alert.acknowledged_at) return <Badge tone="blue">{me?.id === alert.acknowledged_by_id ? "Acknowledged by you" : "Acknowledged"}</Badge>;
  return <Badge tone="purple">Open</Badge>;
}

export function AckButton({ alert }: { alert: Alert }) {
  const toast = useToast();
  const { canWrite } = useAuth();
  const ack = useApiMutation((id: string) => api.alerts.acknowledge(id));
  if (!canWrite || alert.resolved_at || alert.acknowledged_at) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={ack.isPending}
      onClick={() =>
        ack.mutate(alert.id, {
          onSuccess: () => toast("Alert acknowledged"),
          onError: (e) => toast(e instanceof Error ? e.message : "Could not acknowledge", "bad"),
        })
      }
    >
      <Check className="size-4" /> Acknowledge
    </Button>
  );
}
