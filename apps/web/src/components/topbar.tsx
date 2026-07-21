"use client";

import { useState } from "react";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { Button } from "@omniflow/ui";
import { useAuth } from "../providers/auth-provider";
import { ThemeToggle } from "./theme-toggle";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() : "";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden md:block" />

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <div className="relative">
          <Button
            variant="ghost"
            className="gap-2 px-2"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {initials || "?"}
            </span>
            <span className="hidden text-sm font-medium sm:inline">
              {user ? `${user.firstName} ${user.lastName}` : ""}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-20 mt-2 w-56 rounded-md border border-border bg-background p-1 shadow-md"
            >
              <div className="px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.roles.map((r) => r.role.name).join(", ") || "No roles"}
                </p>
              </div>
              <div className="my-1 h-px bg-border" />
              <button
                role="menuitem"
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                onClick={() => {
                  setMenuOpen(false);
                  void logout();
                }}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
