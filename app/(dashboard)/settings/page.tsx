'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IntegrationsTab } from '@/components/features/settings/IntegrationsTab';
import { AccountTab } from '@/components/features/settings/AccountTab';
import { PreferencesTab } from '@/components/features/settings/PreferencesTab';
import { Settings, Cable, User, Sliders } from 'lucide-react';

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') || 'integrations';

  const handleTabChange = (value: string) => {
    router.push(`/settings?tab=${value}`);
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Manage your account settings and integrations
      </p>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="integrations" className="gap-2">
            <Cable className="h-4 w-4" />
            <span className="hidden sm:inline">Integrations</span>
            <span className="sm:hidden">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
            <span className="sm:hidden">Account</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Sliders className="h-4 w-4" />
            <span className="hidden sm:inline">Preferences</span>
            <span className="sm:hidden">Preferences</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Integrations</h2>
            <p className="text-sm text-muted-foreground">
              Manage external service connections for QA CaseForge
            </p>
          </div>
          <IntegrationsTab returnTo="/settings?tab=integrations" />
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Account</h2>
            <p className="text-sm text-muted-foreground">
              Manage your profile and security settings
            </p>
          </div>
          <AccountTab />
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Preferences</h2>
            <p className="text-sm text-muted-foreground">
              Customize your QA CaseForge experience
            </p>
          </div>
          <PreferencesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
