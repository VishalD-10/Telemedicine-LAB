"use client";

import type { HTMLAttributes, ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export default function GlassCard({ children, className = "", ...props }: GlassCardProps) {
  return (
    <div
      className={`medical-glass-card rounded-2xl border border-slate-200/80 bg-white/85 p-5 text-slate-900 shadow-lg backdrop-blur-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
