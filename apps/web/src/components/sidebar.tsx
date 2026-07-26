"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Boxes,
  Building2,
  FolderKanban,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  UsersRound,
  Users2,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@omniflow/ui";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "CRM", href: "/crm", icon: Users2 },
  { label: "Sales", href: "/sales", icon: ShoppingCart },
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Accounting", href: "/accounting", icon: Banknote },
  { label: "HR", href: "/hr", icon: UsersRound },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Support", href: "/support", icon: LifeBuoy },
  { label: "Purchase", href: "/purchase", icon: ShoppingBag },
  { label: "Payroll", href: "/payroll", icon: Wallet },
  { label: "Expenses", href: "/expenses", icon: Receipt },
  { label: "Assets", href: "/assets", icon: Building2 },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname?.startsWith(item.href);
        const Icon = item.icon;

        if (item.disabled) {
          return (
            <span
              key={item.href}
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/50"
              title="Coming soon"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background md:flex">
      <div className="flex h-16 items-center px-6">
        <span className="text-lg font-semibold tracking-tight">Omniflow</span>
      </div>
      <NavLinks />
      <div className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
        More modules land in upcoming milestones.
      </div>
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-background shadow-xl">
        <div className="flex h-16 items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight">Omniflow</span>
          <button type="button" onClick={onClose} aria-label="Close menu" className="text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavLinks onNavigate={onClose} />
      </aside>
    </div>
  );
}
