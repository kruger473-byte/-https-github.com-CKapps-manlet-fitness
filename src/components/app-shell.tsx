"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  HomeIcon,
  VideoIcon,
  AppleIcon,
  BookIcon,
  DumbbellIcon,
  UsersIcon,
  ChartIcon,
  CreditCardIcon,
  SettingsIcon,
  Badge,
} from "./ui";

export type NavUser = {
  name: string;
  email: string;
  role: string;
  planName: string;
  isTrialing: boolean;
  inGracePeriod: boolean;
};

const MEMBER_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/programs", label: "Programs", icon: VideoIcon },
  { href: "/nutrition", label: "Nutrition", icon: AppleIcon },
  { href: "/knowledge", label: "Knowledge", icon: BookIcon },
  { href: "/coaching", label: "Coaching", icon: DumbbellIcon },
  { href: "/exchange", label: "Exchange", icon: UsersIcon },
];

const ACCOUNT_NAV = [
  { href: "/account/billing", label: "Billing", icon: CreditCardIcon },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Revenue", icon: ChartIcon },
  { href: "/admin/growth", label: "Growth", icon: SettingsIcon },
];

export function AppShell({
  user,
  children,
  logout,
}: {
  user: NavUser;
  children: ReactNode;
  logout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const sections: Array<{ title: string | null; items: typeof MEMBER_NAV }> = [
    { title: null, items: MEMBER_NAV },
    { title: "Account", items: ACCOUNT_NAV },
  ];
  if (user.role === "ADMIN") {
    sections.push({ title: "Creator console", items: ADMIN_NAV });
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar ------------------------------------------------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-ink-800 bg-ink-900 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-ink-800 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-volt-500 text-sm font-black text-ink-950">
              MF
            </span>
            Manlet
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="text-ink-400 hover:text-ink-100 lg:hidden"
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>

        <nav className="flex h-[calc(100vh-4rem)] flex-col overflow-y-auto p-3">
          {sections.map((section, i) => (
            <div key={section.title ?? i} className={i > 0 ? "mt-6" : ""}>
              {section.title ? (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  {section.title}
                </p>
              ) : null}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          active
                            ? "bg-volt-500/10 font-medium text-volt-500"
                            : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="mt-auto pt-6">
            <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-ink-400">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={user.planName === "Free" ? "neutral" : "volt"}>
                  {user.planName}
                </Badge>
                {user.isTrialing ? <Badge tone="info">Trial</Badge> : null}
                {user.inGracePeriod ? <Badge tone="danger">Payment failed</Badge> : null}
              </div>
              <form action={logout} className="mt-3">
                <button
                  type="submit"
                  className="w-full rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </nav>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Content ------------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-800 bg-ink-950/90 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border border-ink-700 p-2 text-ink-300"
            aria-label="Open navigation"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="font-bold">Manlet Fitness</span>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
