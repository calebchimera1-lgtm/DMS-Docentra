"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@omniflow/ui";

const TABS = [
  { label: "Overview", href: "/inventory" },
  { label: "Warehouses", href: "/inventory/warehouses" },
  { label: "Stock", href: "/inventory/stock" },
  { label: "Movements", href: "/inventory/movements" },
];

export function InventorySubnav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-border" aria-label="Inventory sections">
      {TABS.map((tab) => {
        const isActive = tab.href === "/inventory" ? pathname === "/inventory" : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
