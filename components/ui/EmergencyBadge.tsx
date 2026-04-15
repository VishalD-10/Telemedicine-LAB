"use client";

import { AlertTriangle } from "lucide-react";

type EmergencyBadgeProps = {
  label?: string;
  className?: string;
};

export default function EmergencyBadge({ label = "Emergency", className = "" }: EmergencyBadgeProps) {
  return (
    <span className={`relative inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 ${className}`}>
      <span className="absolute inset-0 -z-10 rounded-full bg-red-500/45 blur-md animate-pulse" />
      <span className="absolute -inset-1 -z-20 rounded-full border border-red-300/70 animate-[ping_2s_ease-out_infinite]" />
      <AlertTriangle className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
