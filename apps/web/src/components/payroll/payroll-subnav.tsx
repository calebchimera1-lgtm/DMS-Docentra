"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@omniflow/ui";

const TABS = [
  { label: "Overview", href: "/payroll" },
  { label: "Salary Components", href: "/payroll/salary-components" },
  { label: "Pay Runs", href: "/payroll/pay-runs" },
];

export function PayrollSubnav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-border" aria-label="Payroll sections">
      {TABS.map((tab) => {
        const isActive = tab.href === "/payroll" ? pathname === "/payroll" : pathname?.startsWith(tab.href);
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
