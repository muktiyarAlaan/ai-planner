"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/plans",
    label: "My Plans",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const hasClaudeKey = !!session?.user?.claudeApiKey;
  const hasLinearToken = !!session?.user?.linearAccessToken;

  return (
    <aside className="w-56 h-screen bg-[#0d0d0d] border-r border-[#1a1a1a] flex flex-col fixed left-0 top-0 z-10">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[#1a1a1a]">
        <div className="w-7 h-7 bg-green-500 rounded-md flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 4h12M2 8h8M2 12h10"
              stroke="#0a0a0a"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">
          Alaan Planner
        </span>
      </div>

      {/* New Plan CTA */}
      <div className="px-3 py-3 border-b border-[#1a1a1a]">
        <Link
          href="/plans/new"
          className="flex items-center gap-2 w-full bg-green-500 hover:bg-green-400 text-black font-medium text-sm px-3 py-2 rounded-md transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Plan
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-[#1a1a1a] text-white"
                  : "text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#151515]"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-3 border-t border-[#1a1a1a] space-y-3">
        {/* Integration status */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-[#3f3f46] uppercase tracking-wider font-medium px-1">
            Integrations
          </p>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-[#52525b]">Claude</span>
            <Badge variant={hasClaudeKey ? "success" : "muted"} className="text-[10px] py-0">
              {hasClaudeKey ? "Connected" : "Not set"}
            </Badge>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-[#52525b]">Linear</span>
            <Badge variant={hasLinearToken ? "success" : "muted"} className="text-[10px] py-0">
              {hasLinearToken ? "Connected" : "Optional"}
            </Badge>
          </div>
        </div>

        {/* User info */}
        {session?.user && (
          <div className="flex items-center gap-2.5 pt-1">
            {session.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? "User"}
                className="w-6 h-6 rounded-full shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#1f1f1f] border border-[#333] flex items-center justify-center shrink-0">
                <span className="text-[10px] text-[#71717a]">
                  {session.user.name?.[0] ?? session.user.email[0]}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#a1a1aa] truncate">
                {session.user.name ?? session.user.email}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-[#3f3f46] hover:text-[#71717a] transition-colors p-1 rounded"
              title="Sign out"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
