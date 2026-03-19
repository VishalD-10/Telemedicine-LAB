"use client";

import { useMemo } from "react";

type FurtherDiagnosticsChecklistPanelProps = {
  furtherDiagnostics: string[];
  customFurtherDiagnosticInput: string;
  onCustomFurtherDiagnosticInputChange: (value: string) => void;
  onAddCustomFurtherDiagnostic: () => void;
  onRemoveFurtherDiagnostic: (index: number) => void;
};

const shellClass =
  "rounded-2xl border border-blue-100/70 bg-gradient-to-br from-white/90 to-blue-50/70 p-5 shadow-[0_16px_42px_-26px_rgba(30,64,175,0.6)] backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_20px_46px_-24px_rgba(30,64,175,0.65)]";

const PULMO_TESTS = [
  "CT Chest",
  "HRCT",
  "PET-CT",
  "Ultrasound Thorax",
  "Full PFT",
  "DLCO",
  "6 Minute Walk Test",
  "Sputum AFB",
  "GeneXpert",
  "Sputum Culture",
  "Bronchoalveolar Lavage",
  "Bronchoscopy",
  "Thoracentesis",
  "Lung Biopsy",
  "FNAC",
  "Cytology",
] as const;

export default function FurtherDiagnosticsChecklistPanel({
  furtherDiagnostics,
  customFurtherDiagnosticInput,
  onCustomFurtherDiagnosticInputChange,
  onAddCustomFurtherDiagnostic,
  onRemoveFurtherDiagnostic,
}: FurtherDiagnosticsChecklistPanelProps) {
  const selectedFurtherDiagnostics = useMemo(() => new Set(furtherDiagnostics), [furtherDiagnostics]);

  const handleToggle = (test: string) => {
    const existingIndex = furtherDiagnostics.findIndex((item) => item === test);
    if (existingIndex >= 0) {
      onRemoveFurtherDiagnostic(existingIndex);
      return;
    }
    onCustomFurtherDiagnosticInputChange(test);
    setTimeout(() => onAddCustomFurtherDiagnostic(), 0);
  };

  return (
    <section className={`${shellClass} animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}>
      <h3 className="text-base font-semibold text-slate-800">Further Diagnostics Checklist</h3>
      <p className="mt-1 text-xs text-slate-600">Clinician-selected investigations for the current case.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {PULMO_TESTS.map((test) => (
          <label
            key={test}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-blue-100/80 bg-white/80 px-3 py-2 text-sm text-slate-700 transition hover:bg-blue-50/80"
          >
            <input
              type="checkbox"
              checked={selectedFurtherDiagnostics.has(test)}
              onChange={() => handleToggle(test)}
              className="h-4 w-4 rounded border-blue-200 text-blue-600 focus:ring-blue-400"
            />
            <span>{test}</span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="w-full rounded-xl border border-blue-100 bg-white/80 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
          value={customFurtherDiagnosticInput}
          onChange={(e) => onCustomFurtherDiagnosticInputChange(e.target.value)}
          placeholder="Add custom diagnostic procedure"
        />
        <button
          type="button"
          onClick={onAddCustomFurtherDiagnostic}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          Add
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {furtherDiagnostics.length === 0 ? (
          <p className="text-sm text-slate-500">No procedures selected.</p>
        ) : (
          furtherDiagnostics.map((test, idx) => (
            <span
              key={`${test}-${idx}`}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/85 px-3 py-1 text-xs text-slate-700"
            >
              {test}
              <button
                type="button"
                onClick={() => onRemoveFurtherDiagnostic(idx)}
                className="text-red-500 transition hover:text-red-600"
              >
                x
              </button>
            </span>
          ))
        )}
      </div>
    </section>
  );
}
