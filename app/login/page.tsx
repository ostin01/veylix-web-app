"use client";

import { Loader2, Lock, User as UserIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Logo } from "@/components/logo";
import { api } from "@/lib/api";

function LoginForm() {
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const expired = params.get("reason") === "expired";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.auth.login(username, password);
      const next = params.get("next");
      // Full navigation so the new cookies are picked up by the server and caches start clean.
      window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-5 p-7">
      <div className="flex items-center gap-2.5">
        <Logo />
        <span className="text-2xl font-semibold tracking-tight">Veylix</span>
      </div>
      <div>
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-sm text-muted">Use your Veylix operator account.</p>
      </div>

      {expired && !error && (
        <p role="status" className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
          Your session ended. Please sign in again.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Username</span>
        <div className="relative">
          <UserIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Password</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </label>

      <button
        type="submit"
        disabled={busy || !username || !password}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-50"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        Sign in
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
