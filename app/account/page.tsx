"use client";

import { useState, type FormEvent } from "react";
import { Badge, Button, ErrorBanner, Field, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { useApiMutation } from "@/lib/hooks";

export default function AccountPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = useApiMutation(() => api.auth.changePassword(current, next));
  const mismatch = confirm !== "" && confirm !== next;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    change.mutate(undefined, {
      // The API revokes every session on password change; the proxy already cleared our cookies.
      onSuccess: () => window.location.assign("/login?reason=expired"),
    });
  };

  return (
    <>
      <PageHeader title="Account" subtitle="Your sign-in details." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3 p-6">
          <h2 className="font-semibold">Profile</h2>
          <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
            <dt className="text-muted">Username</dt>
            <dd>{user?.username}</dd>
            <dt className="text-muted">Role</dt>
            <dd>
              <Badge tone="purple">{user?.role}</Badge>
            </dd>
            <dt className="text-muted">Member since</dt>
            <dd>{user ? formatDateTime(user.created_at) : "—"}</dd>
          </dl>
        </section>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <h2 className="font-semibold">Change password</h2>
          <p className="text-sm text-muted">You will be signed out everywhere, including this device, and asked to sign in again.</p>
          <Field label="Current password">
            <input className="input" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="New password" hint="At least 12 characters">
            <input className="input" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Confirm new password" hint={mismatch ? "Passwords do not match" : undefined}>
            <input className="input" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {change.error && <ErrorBanner error={change.error} />}
          <Button type="submit" loading={change.isPending} disabled={!current || next.length < 12 || next !== confirm}>
            Change password
          </Button>
        </form>
      </div>
    </>
  );
}
