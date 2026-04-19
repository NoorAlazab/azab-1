"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Note: middleware.ts performs a lightweight presence-only redirect
  // for unauthenticated requests (Edge runtime cannot decrypt the
  // iron-session cookie). Real authentication is enforced server-side
  // in each route handler via requireUserId() from lib/auth/iron.ts.

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <AppHeader 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        />
        
        <div className="flex h-[calc(100vh-3.5rem)]">
          {/* Sidebar */}
          <div className="hidden md:block">
            <AppSidebar 
              isOpen={sidebarOpen} 
              onToggle={() => setSidebarOpen(!sidebarOpen)}
            />
          </div>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <div className="fixed left-0 top-14 bottom-0 w-64 bg-background">
                <AppSidebar 
                  isOpen={true} 
                  onToggle={() => setSidebarOpen(!sidebarOpen)}
                />
              </div>
            </div>
          )}

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}