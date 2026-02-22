"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/plans",
    label: "My Plans",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname      = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside className="w-56 h-screen bg-[#111827] flex flex-col fixed left-0 top-0 z-10">

      {/* ── Logo ── */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/8">
        <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h8M2 12h10" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-white font-bold text-sm tracking-tight">Alaan Planner</span>
      </div>

      {/* ── New Plan CTA ── */}
      <div className="px-3 py-3 border-b border-white/8">
        <Link
          href="/plans/new"
          className="flex items-center gap-2 w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium text-sm px-3 py-2 rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Plan
        </Link>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/6"
              )}
            >
              {/* Active left accent bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
              )}
              <span className={cn("transition-colors", isActive ? "text-indigo-300" : "text-slate-500 group-hover:text-slate-300")}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom section ── */}
      <div className="border-t border-white/8">
        {/* User */}
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-3">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? "User"}
                className="w-7 h-7 rounded-full shrink-0 ring-1 ring-white/10"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#7C3AED]/40 border border-[#7C3AED]/30 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-semibold text-indigo-300 uppercase">
                  {user.name?.[0] ?? user.email[0]}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-300 truncate font-medium">{user.name ?? user.email}</p>
              {user.name && (
                <p className="text-[10px] text-slate-600 truncate">{user.email}</p>
              )}
            </div>
            <button
              onClick={signOut}
              className="text-slate-600 hover:text-slate-300 transition-colors p-1 rounded-md hover:bg-white/8"
              title="Sign out"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
