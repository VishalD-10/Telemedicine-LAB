"use client";

import type { ReactNode } from "react";

type MedicalModalProps = {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
};

export default function MedicalModal({ open, title, children, onClose }: MedicalModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
        type="button"
      />
      <div className="medical-modal relative w-full max-w-2xl rounded-2xl border border-white/50 bg-white/70 p-5 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{title ?? "Clinical Detail"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/80 px-3 py-1 text-sm text-slate-600 transition hover:bg-white"
          >
            Close
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
