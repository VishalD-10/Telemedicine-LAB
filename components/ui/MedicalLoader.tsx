"use client";

type MedicalLoaderProps = {
  rows?: number;
  compact?: boolean;
  className?: string;
};

export default function MedicalLoader({ rows = 3, compact = false, className = "" }: MedicalLoaderProps) {
  return (
    <div className={`medical-loader rounded-2xl border border-slate-200/80 bg-white/85 p-4 text-slate-900 backdrop-blur-xl ${className}`}>
      <div className="medical-loader-skeleton h-4 w-1/3 rounded-md" />
      <div className={`mt-3 space-y-2 ${compact ? "" : "pt-1"}`}>
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={`med-loader-${index}`}
            className={`medical-loader-skeleton rounded-lg ${compact ? "h-8" : index === rows - 1 ? "h-10 w-3/4" : "h-10"}`}
          />
        ))}
      </div>
    </div>
  );
}
