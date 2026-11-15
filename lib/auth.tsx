"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { api } from "./api";
import type { User, UserRole } from "./types";

interface AuthValue {
  user: User | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  role: UserRole | null;
  /** admin or operator: can create/edit fleets, vehicles, devices and acknowledge alerts */
  canWrite: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: api.auth.me,
    staleTime: 60_000,
    retry: false,
  });

  const logout = useCallback(async () => {
    await api.auth.logout();
    qc.clear();
    window.location.assign("/login");
  }, [qc]);

  const user = data ?? null;
  const value: AuthValue = {
    user,
    loading: isLoading,
    error: error instanceof Error ? error : null,
    retry: () => void refetch(),
    role: user?.role ?? null,
    canWrite: user?.role === "admin" || user?.role === "operator",
    isAdmin: user?.role === "admin",
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
