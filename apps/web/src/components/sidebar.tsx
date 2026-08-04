"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Boxes,
  Building2,
  CalendarCheck,
  FileSignature,
  FolderKanban,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  FileStack,
  PackageCheck,
  Store,
  Truck,
  UserSearch,
  UsersRound,
  Users2,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@omniflow/ui";
import { apiClient } from "../lib/api-client";

/**
 * Maps the icon name string the API returns (Plugin.icon, set from the
 * app-registry catalog) to the actual component — icons can't be stored
 * in the database, so this is the one place that translates between the
 * two. `Package` is the fallback for an icon name this build doesn't
 * recognize, so an unrecognized module still renders instead of crashing.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users2,
  ShoppingCart,
  Boxes,
  Banknote,
  UsersRound,
  FolderKanban,
  LifeBuoy,
  ShoppingBag,
  Wallet,
  Receipt,
  Building2,
  UserSearch,
  FileSignature,
  Wrench,
  Store,
  CalendarCheck,
  Truck,
  PackageCheck,
  FileStack,
  CreditCard,
};

interface NavApiItem {
  key: string;
  name: string;
  icon: string | null;
  route: string | null;
}

function useNavItems(): NavApiItem[] {
  const [items, setItems] = useState<NavApiItem[]>([]);

  useEffect(() => {
    void apiClient.get<NavApiItem[]>("/plugins/nav").then(setItems);
  }, []);

  return items;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = useNavItems();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
      {items
        .filter((item) => item.route)
        .map((item) => {
          const isActive = pathname?.startsWith(item.route!);
          const Icon = (item.icon && ICON_MAP[item.icon]) || Package;

          return (
            <Link
              key={item.key}
              href={item.route!}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-navy-foreground/80 hover:bg-white/10 hover:text-navy-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-navy text-navy-foreground md:flex">
      <div className="flex h-16 items-center px-6">
        <span className="text-lg font-semibold tracking-tight">Omniflow</span>
      </div>
      <NavLinks />
      <div className="border-t border-white/10 px-6 py-4 text-xs text-navy-foreground/60">
        Navigation reflects your installed apps and permissions.
      </div>
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-navy text-navy-foreground shadow-xl">
        <div className="flex h-16 items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight">Omniflow</span>
          <button type="button" onClick={onClose} aria-label="Close menu" className="text-navy-foreground/70">
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavLinks onNavigate={onClose} />
      </aside>
    </div>
  );
}
