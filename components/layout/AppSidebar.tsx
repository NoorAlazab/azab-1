"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { brandAssets } from "@/lib/branding";
import {
  Home,
  FileText,
  Zap,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Beaker,
} from "lucide-react";

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: Home,
  },
  {
    href: "/exploration-v2",
    label: "Exploration",
    icon: Beaker,
    badge: "Beta",
  },
  {
    href: "/stories",
    label: "Stories",
    icon: FileText,
    disabled: true,
  },
  {
    href: "/generator",
    label: "Generator",
    icon: Zap,
    badge: "AI",
  },
  {
    href: "/activity",
    label: "Activity",
    icon: Activity,
    disabled: true,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function AppSidebar({ isOpen, onToggle, className }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r bg-background transition-all duration-200",
        isOpen ? "w-64" : "w-16",
        className
      )}
    >
      {/* Sidebar header */}
      <div className="flex items-center justify-between border-b p-4">
        {isOpen && (
          <div className="flex items-center space-x-2">
            <img
              src={brandAssets.logos.mark}
              alt="QA CaseForge"
              className="h-6 w-6 text-brand"
            />
            <span className="font-semibold text-sm">QA CaseForge</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn(
            "h-8 w-8",
            !isOpen && "mx-auto"
          )}
        >
          {isOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="sr-only">
            {isOpen ? "Collapse sidebar" : "Expand sidebar"}
          </span>
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.disabled ? "#" : item.href}
              className={cn(
                "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                item.disabled && "cursor-not-allowed opacity-50",
                !isOpen && "justify-center px-2"
              )}
              onClick={(e) => {
                if (item.disabled) {
                  e.preventDefault();
                }
              }}
            >
              <Icon className={cn("h-4 w-4", isOpen && "mr-3")} />
              {isOpen && (
                <span className="flex-1">{item.label}</span>
              )}
              {isOpen && item.badge && (
                <Badge variant="secondary" className="text-xs">
                  {item.badge}
                </Badge>
              )}
              {isOpen && item.disabled && (
                <span className="text-xs text-muted-foreground">Soon</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {isOpen && (
        <div className="border-t p-4">
          <div className="text-xs text-muted-foreground">
            <p className="font-medium">QA CaseForge v0.1.0</p>
            <p className="mt-1">
              Generate test cases from Jira stories
            </p>
          </div>
        </div>
      )}
    </div>
  );
}