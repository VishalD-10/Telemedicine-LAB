"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
  onSave: () => void;
};

const shellClass =
  "rounded-2xl border border-blue-100/70 bg-gradient-to-br from-white/90 to-blue-50/70 p-5 shadow-[0_16px_42px_-26px_rgba(30,64,175,0.6)] backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_20px_46px_-24px_rgba(30,64,175,0.65)]";

const fieldClass =
  "w-full rounded-lg border border-blue-100 bg-white/90 px-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 transition focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

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
    await onSave();
    setIsSaving(false);
    setIsSaved(true);
    setIsDirty(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
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
      <h3 className="text-base font-semibold text-slate-800">Pharmacological Prescription</h3>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] border-separate border-spacing-y-2 text-xs text-slate-700">
          <thead>
            <tr>
              <th className="px-2 text-left font-semibold">Medication</th>
              <th className="px-2 text-left font-semibold">Dosage</th>
              <th className="px-2 text-left font-semibold">Frequency</th>
              <th className="px-2 text-left font-semibold">Duration</th>
              <th className="px-2 text-left font-semibold">Notes</th>
              <th className="px-2 text-left font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {prescriptionRows.map((row) => (
              <tr key={row.id} className="rounded-xl bg-white/80 shadow-sm transition hover:bg-white">
                <td className="px-2 py-2">
                  <input
                    className={fieldClass}
                    value={row.medication}
                    onChange={(e) => handleChange(row.id, "medication", e.target.value)}
                    placeholder="Drug"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    className={fieldClass}
                    value={row.dosage}
                    onChange={(e) => handleChange(row.id, "dosage", e.target.value)}
                    placeholder="e.g. 500 mg"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    className={fieldClass}
                    value={row.frequency}
                    onChange={(e) => handleChange(row.id, "frequency", e.target.value)}
                    placeholder="e.g. BID"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    className={fieldClass}
                    value={row.duration}
                    onChange={(e) => handleChange(row.id, "duration", e.target.value)}
                    placeholder="e.g. 7 days"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    className={fieldClass}
                    value={row.notes}
                    onChange={(e) => handleChange(row.id, "notes", e.target.value)}
                    placeholder="Additional instructions"
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => handleRemove(row.id)}
                    className="rounded-lg bg-red-50 px-2 py-1 text-red-600 transition hover:bg-red-100"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-xl border border-blue-200 bg-white/90 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
        >
          Add Medication
        </button>
        <button
          type="button"
          onClick={async () => {
            await handleSave();
          }}
          disabled={isSaving || Boolean(saving) || (isSaved && !isDirty)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {isSaving || saving ? "Saving..." : isSaved && !isDirty ? "Saved" : "Save"}
        </button>
        {isSaved ? (
          <button
            type="button"
            onClick={() => {
              setIsSaved(false);
              setIsDirty(true);
            }}
            className="rounded-xl border border-blue-200 bg-white/90 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
          >
            Modify
          </button>
        ) : null}
      </div>
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          Saved successfully
        </div>
      )}
    </section>
  );
}
