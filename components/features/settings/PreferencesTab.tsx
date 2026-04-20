'use client';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sun, Moon, Monitor, Bell, Palette } from 'lucide-react';

export function PreferencesTab() {
  return (
    <div className="space-y-6">
      {/* Appearance */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Appearance
        </h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="theme">Theme</Label>
            <Select defaultValue="system" disabled>
              <SelectTrigger id="theme" className="mt-1">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Light
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Dark
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    System
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Theme customization coming soon
            </p>
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="notifications">Email Notifications</Label>
            <Select defaultValue="all" disabled>
              <SelectTrigger id="notifications" className="mt-1">
                <SelectValue placeholder="Select notification level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All notifications</SelectItem>
                <SelectItem value="important">Important only</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Notification preferences coming soon
            </p>
          </div>
        </div>
      </Card>

      {/* Default Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Default Settings</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="default-priority">Default Test Case Priority</Label>
            <Select defaultValue="p2" disabled>
              <SelectTrigger id="default-priority" className="mt-1">
                <SelectValue placeholder="Select default priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="p0">P0 (Critical)</SelectItem>
                <SelectItem value="p1">P1 (High)</SelectItem>
                <SelectItem value="p2">P2 (Medium)</SelectItem>
                <SelectItem value="p3">P3 (Low)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Default settings customization coming soon
            </p>
          </div>
          <div>
            <Label htmlFor="default-language">Language</Label>
            <Select defaultValue="en" disabled>
              <SelectTrigger id="default-language" className="mt-1">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Multi-language support coming soon
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
