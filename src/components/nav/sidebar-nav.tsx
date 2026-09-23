"use client";

import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { primaryNav, secondaryNav, type NavItem } from "@/components/nav/nav-config";
import { Badge } from "@/components/ui/badge";
import { LogoMark } from "@/components/shared/logo-mark";

interface SidebarNavProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  followUpsDueCount?: number;
  jobDropsUnreadCount?: number;
  onNavigate?: () => void;
}

function NavLink({
  item,
  active,
  badgeCount,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badgeCount?: number;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const highlighted = !!item.accent;
  const hasUnread = !!badgeCount && badgeCount > 0;
  // Lazy useState initializer, not a call during render — the recommended
  // way to read an impure value (Date.now()) once per mount in React.
  const [isNew] = React.useState(() => !!item.newUntil && Date.now() < new Date(item.newUntil).getTime());
  const showNewTag = highlighted && isNew && !hasUnread;

  return (
    <Link
      href={item.href}
      title={collapsed ? `${item.label}${hasUnread ? ` (${badgeCount} unread)` : ""}` : undefined}
      aria-label={`${item.label}${hasUnread ? ` (${badgeCount})` : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "text-primary-foreground"
          : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
        highlighted && !active && "text-[var(--amber-accent)]"
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-[var(--blue-accent)] to-[var(--cyan-accent)] shadow-[0_4px_18px_-4px_var(--cyan-accent)]"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <Icon
        className={cn(
          "relative z-10 h-4 w-4 shrink-0",
          active && "drop-shadow-sm",
          highlighted && "drop-shadow-[0_0_8px_var(--amber-accent)]"
        )}
      />
      <span className={cn("relative z-10 truncate", collapsed && "sr-only")}>{item.label}</span>
      {hasUnread && collapsed && <span aria-hidden="true" className="absolute right-1 top-1 z-10 size-1.5 rounded-full bg-primary" />}
      {hasUnread && !collapsed && (
        <Badge
          variant="default"
          className="relative z-10 ml-auto h-5 min-w-5 animate-pulse-glow justify-center rounded-full border-transparent bg-gradient-to-br from-[var(--amber-accent)] to-[color-mix(in_oklch,var(--amber-accent)_70%,white)] px-1.5 text-[11px] font-semibold text-white shadow-[0_0_14px_2px_var(--amber-accent)]"
        >
          {badgeCount}
        </Badge>
      )}
      {showNewTag && !collapsed && (
        <Badge
          variant="default"
          className="relative z-10 ml-auto h-5 animate-pulse-glow justify-center rounded-full border-transparent bg-gradient-to-br from-[var(--amber-accent)] to-[color-mix(in_oklch,var(--amber-accent)_70%,white)] px-1.5 text-[10px] font-bold tracking-wide text-white uppercase shadow-[0_0_14px_2px_var(--amber-accent)]"
        >
          New
        </Badge>
      )}
    </Link>
  );
}

export function SidebarNav({ followUpsDueCount, jobDropsUnreadCount, onNavigate, collapsed = false, onToggleCollapse }: SidebarNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const badgeCountFor = (item: NavItem) => {
    if (item.badgeKey === "followUpsDue") return followUpsDueCount;
    if (item.badgeKey === "jobDropsUnread") return jobDropsUnreadCount;
    return undefined;
  };

  return (
    <div className={cn("flex h-full flex-col gap-4", collapsed ? "p-2" : "p-4")}>
      <Link href="/dashboard" aria-label="ApplyOS home" className={cn("flex items-center gap-2.5 pt-1", !collapsed && "px-2")}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--blue-accent)] via-[var(--cyan-accent)] to-[var(--emerald-accent)] text-white shadow-md">
          <LogoMark className="h-5 w-5" />
        </span>
        <div className={cn("leading-tight", collapsed && "sr-only")}>
          <p className="text-sm font-semibold tracking-tight">ApplyOS</p>
          <p className="text-[11px] text-muted-foreground">Application Tracker</p>
        </div>
      </Link>

      {onToggleCollapse && <Button variant="ghost" size={collapsed ? "icon" : "sm"} onClick={onToggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /><span>Collapse sidebar</span></>}
      </Button>}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-thin pr-1">
        {primaryNav.map((item) => (
          <NavLink
            key={item.href}
            collapsed={collapsed}
            item={item}
            active={isActive(item.href)}
            badgeCount={badgeCountFor(item)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
        {secondaryNav.map((item) => (
          <NavLink collapsed={collapsed} key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}
