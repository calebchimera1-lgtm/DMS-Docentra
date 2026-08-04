"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@omniflow/ui";

const TABS = [
  { label: "Overview", href: "/assets" },
  { label: "Categories", href: "/assets/categories" },
  { label: "Assets", href: "/assets/assets" },
  { label: "Depreciation Runs", href: "/assets/depreciation-runs" },
];

export function AssetsSubnav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-border" aria-label="Assets sections">
      {TABS.map((tab) => {
        const isActive = tab.href === "/assets" ? pathname === "/assets" : pathname?.startsWith(tab.href);
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
