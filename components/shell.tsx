"use client";

import {
  BarChart3,
  Bell,
  Car,
  FileText,
  Layers,
  LayoutDashboard,
  Menu,
  Radio,
  Search,
  LogOut,
  Map as MapIcon,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  Terminal,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useActiveAlertTotal, useHealth } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { initials as toInitials } from "@/lib/format";
import { Avatar } from "./avatar";
import { Logo } from "./logo";
import { cx } from "./ui";

type NavItem = { href: string; label: string; icon: LucideIcon; soon?: boolean; adminOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/fleets", label: "Fleets", icon: Layers },
  { href: "/vehicles", label: "Vehicles", icon: Car },
  { href: "/devices", label: "Devices", icon: Radio },
  { href: "/analytics", label: "Analytics", icon: BarChart3, soon: true },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/profiles", label: "Profiles", icon: SlidersHorizontal },
  { href: "/quarantine", label: "Quarantine", icon: ShieldAlert, adminOnly: true },
  { href: "/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/commands", label: "Commands", icon: Terminal, soon: true },
  { href: "/reports", label: "Reports", icon: FileText, soon: true },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: activeAlerts } = useActiveAlertTotal();
  const { user, isAdmin, logout } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-2xl font-semibold tracking-tight">Veylix</span>
        </div>
        <p className="mt-1 text-[11px] text-muted">Fleet operations platform</p>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Main">
        {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                active
                  ? "bg-gradient-to-r from-brand/35 to-brand/5 text-white"
                  : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className="size-[18px]" />
              <span className="flex-1">{item.label}</span>
              {item.href === "/alerts" && !!activeAlerts && (
                <span className="grid min-w-5 place-items-center rounded-full bg-bad px-1.5 text-[11px] font-semibold text-white">{activeAlerts}</span>
              )}
              {item.soon && (
                <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">Soon</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          <Link href="/account" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3" aria-label="Account settings">
            <Avatar initials={toInitials(user?.username ?? "?")} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.username ?? "…"}</p>
              <p className="truncate text-xs capitalize text-muted">{user?.role ?? ""}</p>
            </div>
          </Link>
          <button onClick={logout} aria-label="Sign out" title="Sign out" className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-ink">
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="w-[72px]" />;
  return (
    <span className="text-sm tabular-nums text-muted">
      {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC
    </span>
  );
}

function ApiStatus() {
  const { data: healthy, isLoading } = useHealth();
  const state = isLoading ? "checking" : healthy ? "online" : "offline";
  return (
    <div className="flex items-center gap-2 text-sm" title="Status of the Veylix backend API">
      <span
        className={cx(
          "size-2.5 rounded-full",
          state === "online" && "bg-ok shadow-[0_0_8px_#22c55e]",
          state === "offline" && "bg-bad shadow-[0_0_8px_#ef4444]",
          state === "checking" && "bg-warn",
        )}
      />
      <span className="hidden text-muted sm:inline">
        {state === "online" ? "API online" : state === "offline" ? "API unreachable" : "Checking API"}
      </span>
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: activeAlerts } = useActiveAlertTotal();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/vehicles?search=${encodeURIComponent(term)}` : "/vehicles");
  };
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur lg:px-8">
      <button onClick={onMenu} aria-label="Open menu" className="rounded-md p-2 text-muted hover:bg-surface-2 lg:hidden">
        <Menu className="size-5" />
      </button>
      <form onSubmit={submit} className="relative max-w-xl flex-1" role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          className="input pl-9"
          placeholder="Search vehicles by VIN, registration, make or model…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search vehicles"
        />
      </form>
      <div className="ml-auto flex items-center gap-5">
        <ApiStatus />
        <Link href="/alerts" aria-label={`Alerts${activeAlerts ? `, ${activeAlerts} active` : ""}`} className="relative rounded-md p-2 text-muted hover:bg-surface-2 hover:text-ink">
          <Bell className="size-5" />
          {!!activeAlerts && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-semibold text-white">{activeAlerts}</span>
          )}
        </Link>
        <span className="hidden h-5 w-px bg-line sm:block" />
        <span className="hidden sm:block">
          <Clock />
        </span>
        <Avatar initials={toInitials(user?.username ?? "?")} size="sm" />
      </div>
    </header>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[230px] border-r border-line bg-[#080d1c] lg:block">
        <Sidebar />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[250px] border-r border-line bg-[#080d1c]">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-md p-1 text-muted">
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[230px]">
        <Topbar onMenu={() => setOpen(true)} />
        <main className={pathname === "/map" ? "h-[calc(100dvh-62px)] min-h-[420px]" : "mx-auto max-w-[1400px] px-4 py-6 lg:px-8"}>
          {children}
        </main>
      </div>
    </div>
  );
}

/** Login renders bare; everything else gets the dashboard chrome once the session is confirmed. */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, error, retry } = useAuth();
  if (pathname.startsWith("/login")) return <>{children}</>;
  if (error && !user) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="max-w-md space-y-4 text-center">
          <p className="font-medium">Could not load your account</p>
          <p className="text-sm text-muted">{error.message}</p>
          <button onClick={retry} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface-2">
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted" role="status">
        Loading…
      </div>
    );
  }
  return <Shell>{children}</Shell>;
}
