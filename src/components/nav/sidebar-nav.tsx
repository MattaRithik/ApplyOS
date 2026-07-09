"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { primaryNav, secondaryNav } from "@/components/nav/nav-config";
import { Badge } from "@/components/ui/badge";

interface SidebarNavProps {
  followUpsDueCount?: number;
  onNavigate?: () => void;
}

function NavLink({
  item,
  active,
  badgeCount,
  onNavigate,
}: {
  item: (typeof primaryNav)[number];
  active: boolean;
  badgeCount?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "text-primary-foreground"
          : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-[var(--blue-accent)] to-[var(--cyan-accent)] shadow-[0_4px_18px_-4px_var(--cyan-accent)]"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <Icon className={cn("relative z-10 h-4 w-4 shrink-0", active && "drop-shadow-sm")} />
      <span className="relative z-10 truncate">{item.label}</span>
      {!!badgeCount && badgeCount > 0 && (
        <Badge
          variant="secondary"
          className="relative z-10 ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]"
        >
          {badgeCount}
        </Badge>
      )}
    </Link>
  );
}

export function SidebarNav({ followUpsDueCount, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2 pt-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--blue-accent)] via-[var(--cyan-accent)] to-[var(--emerald-accent)] text-white shadow-md">
          <Sparkles className="h-4.5 w-4.5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">ApplyOS</p>
          <p className="text-[11px] text-muted-foreground">Job Search OS</p>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-thin pr-1">
        {primaryNav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            badgeCount={item.badgeKey === "followUpsDue" ? followUpsDueCount : undefined}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
        {secondaryNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}
