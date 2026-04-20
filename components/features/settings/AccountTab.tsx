'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Lock, Trash2 } from 'lucide-react';

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

export function AccountTab() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.user) {
          setUserInfo(data.user);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      alert('❌ New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      alert('❌ Password must be at least 8 characters long');
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        alert('✅ Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert(`❌ Failed to change password: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert('❌ Failed to change password: Network error');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('⚠️ Are you absolutely sure?\n\nThis will permanently delete your account and all associated data. This action cannot be undone.')) {
      return;
    }

    if (!confirm('⚠️ Final confirmation\n\nType your email address in the prompt to confirm account deletion.')) {
      return;
    }

    const email = prompt('Enter your email address to confirm:');
    if (email !== userInfo?.email) {
      alert('❌ Email address does not match. Account deletion cancelled.');
      return;
    }

    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('✅ Account deleted successfully. You will be logged out.');
        window.location.href = '/login';
      } else {
        const data = await res.json();
        alert(`❌ Failed to delete account: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert('❌ Failed to delete account: Network error');
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading account information...</div>;
  }

  if (!userInfo) {
    return <div className="text-destructive">Failed to load account information</div>;
  }

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile Information
        </h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={userInfo.name}
              disabled
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Profile name editing coming soon
            </p>
          </div>
          <div>
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={userInfo.email}
              disabled
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email address cannot be changed
            </p>
          </div>
        </div>
      </Card>

      {/* Change Password */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Change Password
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="mt-1"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1"
              placeholder="Enter new password (min 8 characters)"
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1"
              placeholder="Confirm new password"
            />
          </div>
          <Button
            type="submit"
            disabled={updatingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="gap-2"
          >
            <Lock className="h-4 w-4" />
            {updatingPassword ? 'Changing Password...' : 'Change Password'}
          </Button>
        </form>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border-destructive">
        <h3 className="text-lg font-semibold mb-2 text-destructive flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Danger Zone
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <Separator className="my-4" />
        <Button
          variant="destructive"
          onClick={handleDeleteAccount}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Delete Account
        </Button>
      </Card>
    </div>
  );
}
