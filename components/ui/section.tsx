import { ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className = "" }: SectionProps) {
  return (
    <div className={`mx-auto max-w-6xl px-6 py-8 ${className}`}>
      {children}
    </div>
  );
}

export function Section({ children, className = "" }: SectionProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeader({ children, className = "" }: SectionProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {children}
    </div>
  );
}