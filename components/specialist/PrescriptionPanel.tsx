"use client";

import { useEffect, useRef, useState } from "react";

export type PrescriptionRow = {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes: string;
};

type PrescriptionPanelProps = {
  rows: PrescriptionRow[];
  selectedDiagnosisId?: string | null;
  diagnosisIsManual?: boolean;
  loading?: boolean;
  saving?: boolean;
  onChangeRow: (id: string, field: keyof Omit<PrescriptionRow, "id">, value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onSave: () => Promise<{ error?: string } | void>;
};

const shellClass =
  "glass-panel p-6 relative overflow-hidden transition-all duration-300 max-w-full";

const fieldClass =
  "glass-input w-full text-xs py-2";

export default function PrescriptionPanel({
  rows,
  selectedDiagnosisId,
  diagnosisIsManual,
  loading,
  saving,
  onChangeRow,
  onAddRow,
  onRemoveRow,
  onSave,
}: PrescriptionPanelProps) {
  const [prescriptionRows, setPrescriptionRows] = useState<PrescriptionRow[]>(rows);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const currentDiagnosisIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedDiagnosisId) return;
    setPrescriptionRows(rows);
  }, [rows, selectedDiagnosisId]);

  useEffect(() => {
    const loadPrescriptionTemplates = async () => {
      if (currentDiagnosisIdRef.current === (selectedDiagnosisId ?? null)) return;
      currentDiagnosisIdRef.current = selectedDiagnosisId ?? null;

      setPrescriptionRows([]);

      if (diagnosisIsManual || !selectedDiagnosisId) {
        return;
      }

      // Dynamic import to avoid circular dependency
      const { supabase } = await import("@/lib/supabaseClient");
      const { data } = await supabase
        .from("prescription_templates")
        .select("*")
        .eq("diagnosis_id", selectedDiagnosisId);

      const mapped = ((data ?? []) as Record<string, unknown>[]).map((row, index) => ({
        id: String((row.id as string | number | undefined) ?? `rx-template-${index}`),
        medication: String((row.medication_name as string | undefined) ?? ""),
        dosage: String((row.dosage as string | undefined) ?? ""),
        frequency: String((row.frequency as string | undefined) ?? ""),
        duration: String((row.duration_days as number | string | undefined) ?? ""),
        notes: String((row.instructions as string | undefined) ?? ""),
      }));

      setPrescriptionRows(mapped);
    };

    loadPrescriptionTemplates();
  }, [selectedDiagnosisId]);

  const handleChange = (id: string, field: keyof Omit<PrescriptionRow, "id">, value: string) => {
    setPrescriptionRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    onChangeRow(id, field, value);
    setIsDirty(true);
    setIsSaved(false);
  };

  const handleAdd = () => {
    const added = { id: `rx-${Date.now()}-${prescriptionRows.length}`, medication: "", dosage: "", frequency: "", duration: "", notes: "" };
    setPrescriptionRows((prev) => [...prev, added]);
    onAddRow();
    setIsDirty(true);
    setIsSaved(false);
  };

  const handleRemove = (id: string) => {
    setPrescriptionRows((prev) => prev.filter((row) => row.id !== id));
    onRemoveRow(id);
    setIsDirty(true);
    setIsSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    prescriptionRows.forEach((row) => {
      onChangeRow(row.id, "medication", row.medication);
      onChangeRow(row.id, "dosage", row.dosage);
      onChangeRow(row.id, "frequency", row.frequency);
      onChangeRow(row.id, "duration", row.duration);
      onChangeRow(row.id, "notes", row.notes);
    });
    const result = await onSave();
    setIsSaving(false);
    const suc = (result as { success?: boolean } | null | undefined)?.success;
    if (suc) {
      setIsSaved(true);
      setIsDirty(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5500);
    }
  };

  if (loading) {
    return (
      <section className={`${shellClass} animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}>
        <h3 className="text-base font-semibold text-slate-800">Pharmacological Prescription</h3>
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={`rx-sk-${idx}`} className="h-12 animate-pulse rounded-xl bg-blue-100/70" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={`${shellClass} animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}>
      <h3 className="medical-caption text-blue-400 mb-2">Pharmacological Prescription</h3>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] border-separate border-spacing-y-2 text-xs text-slate-300">
          <thead>
            <tr>
              <th className="px-2 text-left font-semibold uppercase tracking-wider text-slate-500">Medication</th>
              <th className="px-2 text-left font-semibold uppercase tracking-wider text-slate-500">Dosage</th>
              <th className="px-2 text-left font-semibold uppercase tracking-wider text-slate-500">Frequency</th>
              <th className="px-2 text-left font-semibold uppercase tracking-wider text-slate-500">Duration</th>
              <th className="px-2 text-left font-semibold uppercase tracking-wider text-slate-500">Notes</th>
              <th className="px-2 text-left font-semibold uppercase tracking-wider text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {prescriptionRows.map((row) => (
              <tr key={row.id} className="rounded-xl bg-black/20 border border-white/5 shadow-sm transition hover:bg-white/5">
                <td className="px-2 py-2">
                  <input className={fieldClass} value={row.medication} onChange={(e) => handleChange(row.id, "medication", e.target.value)} placeholder="Drug" />
                </td>
                <td className="px-2 py-2">
                  <input className={fieldClass} value={row.dosage} onChange={(e) => handleChange(row.id, "dosage", e.target.value)} placeholder="e.g. 500 mg" />
                </td>
                <td className="px-2 py-2">
                  <input className={fieldClass} value={row.frequency} onChange={(e) => handleChange(row.id, "frequency", e.target.value)} placeholder="e.g. BID" />
                </td>
                <td className="px-2 py-2">
                  <input className={fieldClass} value={row.duration} onChange={(e) => handleChange(row.id, "duration", e.target.value)} placeholder="e.g. 7 days" />
                </td>
                <td className="px-2 py-2">
                  <input className={fieldClass} value={row.notes} onChange={(e) => handleChange(row.id, "notes", e.target.value)} placeholder="Additional instructions" />
                </td>
                <td className="px-2 py-2">
                  <button type="button" onClick={() => handleRemove(row.id)} className="rounded-lg bg-red-500/20 px-3 py-1.5 text-red-400 border border-red-500/30 transition hover:bg-red-500/40 font-medium tracking-wide">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleAdd}
          className="glass-btn-secondary max-w-[200px]"
        >
          + Add Medication
        </button>
        <div className="flex gap-3">
          {isSaved ? (
            <button
              type="button"
              onClick={() => { setIsSaved(false); setIsDirty(true); }}
              className="glass-btn-secondary"
            >
              Modify
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || Boolean(saving) || (isSaved && !isDirty)}
            className="glass-btn-primary min-w-[160px]"
          >
            {isSaving || saving ? "Saving..." : isSaved && !isDirty ? "Saved" : "Save Rx"}
          </button>
        </div>
      </div>

      {showToast && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl bg-green-600 shadow-xl text-white text-sm font-medium transition-all animate-in slide-in-from-top-2 fade-in-0 duration-300">
          ✅ Prescription saved successfully
        </div>
      )}
    </section>
  );
}
