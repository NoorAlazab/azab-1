"use client";

import { Button } from "@/components/ui/button";
import { brandAssets } from "@/lib/shared/branding";
import { Menu } from "lucide-react";
import { HeaderUser } from "./HeaderUser";

interface AppHeaderProps {
  onToggleSidebar?: () => void;
}

export function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 md:hidden"
          onClick={onToggleSidebar}
        >
          <Menu className="h-4 w-4" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>

        {/* Logo */}
        <div className="flex items-center space-x-2">
          <img
            src={brandAssets.logos.horizontal}
            alt="QA CaseForge"
            className="h-6 w-auto text-brand"
          />
          {process.env.NODE_ENV === "development" && (
            <span className="rounded bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              DEV
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User menu */}
        <HeaderUser />
      </div>
    </header>
  );
}