'use client';

import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Cable } from 'lucide-react';

interface JiraRequiredModalProps {
  open: boolean;
  onClose: () => void;
  action?: string;
}

export function JiraRequiredModal({ open, onClose, action = "this action" }: JiraRequiredModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Cable className="h-5 w-5 text-muted-foreground" />
            <AlertDialogTitle>Jira Connection Required</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            You need to connect to Jira before you can {action}. Please go to the Integrations page to set up your Jira connection.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <Link href="/settings?tab=integrations">
            <AlertDialogAction>
              Go to Integrations
            </AlertDialogAction>
          </Link>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
