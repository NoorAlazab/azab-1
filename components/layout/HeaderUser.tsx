'use client';

import useSWR from 'swr';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserData {
  id: string;
  email: string;
  name: string;
  initials: string;
}

interface ApiResponse {
  ok: boolean;
  user: UserData | null;
  jira: {
    connected: boolean;
    cloudId: string | null;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function HeaderUser() {
  const { data, error, isLoading } = useSWR<ApiResponse>('/api/auth/me', fetcher);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
        <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
      </div>
    );
  }

  if (error || !data?.ok || !data?.user) {
    return (
      <Button 
        variant="ghost" 
        size="sm"
        onClick={() => router.push('/login')}
      >
        Sign In
      </Button>
    );
  }

  const user = data.user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2">
          <Avatar className="h-8 w-8">
            <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground text-sm font-medium">
              {user.initials}
            </div>
          </Avatar>
          <span className="text-sm font-medium hidden md:inline-block">
            {user.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="cursor-default">
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}