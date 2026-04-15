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
  "glass-panel p-6 relative overflow-hidden transition-all duration-300 max-w-full";

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
      <h3 className="medical-caption text-blue-400 mb-2">Further Diagnostics Checklist</h3>
      <p className="mt-1 text-xs text-slate-400 mb-4">Clinician-selected investigations for the current case.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PULMO_TESTS.map((test) => (
          <label
            key={test}
            className="flex cursor-pointer items-center gap-3 rounded-xl bg-black/20 border border-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5"
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

      <div className="mt-6 flex gap-3">
        <input
          className="glass-input w-full"
          value={customFurtherDiagnosticInput}
          onChange={(e) => onCustomFurtherDiagnosticInputChange(e.target.value)}
          placeholder="Add custom diagnostic procedure"
        />
        <button
          type="button"
          onClick={onAddCustomFurtherDiagnostic}
          className="glass-btn-primary px-8"
        >
          Add Procedure
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {furtherDiagnostics.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No procedures selected.</p>
        ) : (
          furtherDiagnostics.map((test, idx) => (
            <span
              key={`${test}-${idx}`}
              className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300"
            >
              {test}
              <button
                type="button"
                onClick={() => onRemoveFurtherDiagnostic(idx)}
                className="text-red-400 transition hover:text-red-300 ml-1 font-bold"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
    </section>
  );
}
