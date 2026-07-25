"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  Contact,
  FileText,
  Flag,
  Gauge,
  LayoutTemplate,
  Link2,
  Megaphone,
  Settings,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { canManageIntegrations, canViewAnalytics } from "@/lib/auth/roles";
import type { Profile } from "@/types/domain";

const primaryNav = [
  { href: "/studio", label: "Dashboard", icon: Gauge, exact: true },
  { href: "/studio/opportunities", label: "Opportunities", icon: Flag },
  { href: "/studio/contacts", label: "Contacts", icon: Contact },
  { href: "/studio/organisations", label: "Organisations", icon: Building2 },
  { href: "/studio/tasks", label: "Tasks", icon: ClipboardCheck },
  { href: "/studio/landing-pages", label: "Landing pages", icon: LayoutTemplate },
  { href: "/studio/forms", label: "Forms", icon: FileText },
  { href: "/studio/campaigns", label: "Campaigns", icon: Megaphone },
];

export function StudioShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const analyticsVisible = canViewAnalytics(profile.role);
  const integrationsVisible = canManageIntegrations(profile.role);
  const secondaryNav = [
    ...(analyticsVisible
      ? [
          { href: "/studio/analytics", label: "Analytics", icon: BarChart3 },
          { href: "/studio/events", label: "Events", icon: ShieldCheck },
        ]
      : []),
    ...(integrationsVisible
      ? [
          { href: "/studio/integrations", label: "Integrations", icon: Link2 },
          { href: "/studio/integration-logs", label: "Integration logs", icon: ShieldCheck },
        ]
      : []),
    { href: "/studio/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <Link href="/studio" className="block rounded-xl px-3 py-2">
          <p className="text-lg font-semibold tracking-tight">GYVFT Studio</p>
          <p className="text-xs text-slate-500">Internal CRM</p>
        </Link>
        <nav className="mt-6 space-y-1" aria-label="Primary">
          {primaryNav.map((item) => (
            <NavItem key={item.href} pathname={pathname} {...item} />
          ))}
        </nav>
        <div className="mt-6 border-t border-slate-200 pt-6">
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Operate</p>
          <nav className="mt-2 space-y-1" aria-label="Operations">
            {secondaryNav.map((item) => (
              <NavItem key={item.href} pathname={pathname} {...item} />
            ))}
          </nav>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950 lg:hidden">GYVFT Studio</p>
              <p className="text-xs text-slate-500">Protected workspace</p>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
              <UserCircle className="h-5 w-5 text-slate-500" aria-hidden="true" />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-none">{profile.full_name}</p>
                <p className="mt-1 text-xs capitalize text-slate-500">{profile.role}</p>
              </div>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden" aria-label="Mobile">
            {[...primaryNav, ...secondaryNav].map((item) => (
              <MobileNavItem key={item.href} pathname={pathname} {...item} />
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  pathname,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  exact?: boolean;
}) {
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
        active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

function MobileNavItem({
  href,
  label,
  icon: Icon,
  pathname,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  exact?: boolean;
}) {
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
        active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Link>
  );
}
