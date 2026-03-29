import { LucideIcon } from "lucide-react";

interface IconLabelProps {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function IconLabel({ icon: Icon, children, className = "" }: IconLabelProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}