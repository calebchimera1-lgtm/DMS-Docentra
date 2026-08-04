"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@omniflow/ui";

const TABS = [
  { label: "Overview", href: "/manufacturing" },
  { label: "Bills of Material", href: "/manufacturing/boms" },
  { label: "Work Orders", href: "/manufacturing/work-orders" },
];

export function ManufacturingSubnav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-border" aria-label="Manufacturing sections">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/manufacturing" ? pathname === "/manufacturing" : pathname?.startsWith(tab.href);
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
