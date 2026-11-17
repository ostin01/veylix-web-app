"use client";

import { Plus, UserCheck, UserX } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge, Button, EmptyState, ErrorBanner, Field, Modal, PageHeader, Spinner, Table, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { useApiMutation, useUsers } from "@/lib/hooks";
import type { UserRole } from "@/lib/types";

const ROLES: { id: UserRole; label: string; hint: string }[] = [
  { id: "admin", label: "Admin", hint: "Everything, including users, profiles and quarantine" },
  { id: "operator", label: "Operator", hint: "Manage fleets, vehicles, devices; acknowledge alerts" },
  { id: "viewer", label: "Viewer", hint: "Read-only access" },
];
const roleTone = { admin: "purple", operator: "blue", viewer: "gray" } as const;

function CreateUser({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const save = useApiMutation(() => api.users.create({ username: username.trim().toLowerCase(), password, role }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined, {
      onSuccess: () => {
        toast("User created");
        onClose();
      },
    });
  };

  return (
    <Modal title="Create user" onClose={onClose} width="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username or email" hint="3–50 characters. A username (letters, digits, . _ -) or an email address; used to sign in.">
          <input className="input" required minLength={3} maxLength={50} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Temporary password" hint="At least 12 characters">
          <input className="input" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Role" hint={ROLES.find((r) => r.id === role)?.hint}>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        {save.error && <ErrorBanner error={save.error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={username.length < 3 || password.length < 12}>
            Create user
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { isAdmin, loading, user: me } = useAuth();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const { data, isLoading, error, refetch } = useUsers(isAdmin);
  const setActive = useApiMutation((a: { id: string; active: boolean }) => api.users.setActive(a.id, a.active));

  if (!loading && !isAdmin) {
    return <EmptyState title="Administrators only" hint="User management is restricted to admin accounts." />;
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Accounts that can sign in to Veylix. Deactivating an account signs it out everywhere."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New user
          </Button>
        }
      />
      <div className="card overflow-hidden">
        {error ? (
          <div className="p-4">
            <ErrorBanner error={error} onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <Spinner />
        ) : (
          <Table head={["Username", "Role", "Status", "Created", ""]}>
            {data!.map((u) => (
              <tr key={u.id} className="hover:bg-white/[.02]">
                <td className="px-4 py-3 font-medium">
                  {u.username}
                  {u.id === me?.id && <span className="ml-2 text-xs text-muted">(you)</span>}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={roleTone[u.role]}>{u.role[0]!.toUpperCase() + u.role.slice(1)}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={u.is_active ? "green" : "gray"}>{u.is_active ? "Active" : "Deactivated"}</Badge>
                </td>
                <td className="px-4 py-3 text-muted">{formatDateTime(u.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {u.id !== me?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={setActive.isPending && setActive.variables?.id === u.id}
                      onClick={() =>
                        setActive.mutate(
                          { id: u.id, active: !u.is_active },
                          {
                            onSuccess: () => toast(u.is_active ? "User deactivated" : "User reactivated"),
                            onError: (e) => toast(e instanceof Error ? e.message : "Could not update user", "bad"),
                          },
                        )
                      }
                    >
                      {u.is_active ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      {creating && <CreateUser onClose={() => setCreating(false)} />}
    </>
  );
}
