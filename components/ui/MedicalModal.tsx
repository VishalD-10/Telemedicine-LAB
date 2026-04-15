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
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        type="button"
      />
      <div className="medical-modal relative w-full max-w-2xl rounded-2xl border border-slate-200/80 bg-white/90 p-5 text-slate-900 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title ?? "Clinical Detail"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-200"
          >
            Close
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
