"use client";

import type { HTMLAttributes, ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export default function GlassCard({ children, className = "", ...props }: GlassCardProps) {
  return (
    <div
      className={`medical-glass-card rounded-2xl border border-white/50 bg-white/60 p-5 shadow-lg backdrop-blur-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
