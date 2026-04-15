"use client";

import { useEffect, useState } from "react";

type DiagnosisTemplate = {
  id: string;
  diagnosis_name: string;
  details?: string | null;
  defaultSeverity?: string | null;
};

type DiagnosisState = {
  diagnosisTemplateId: string;
  diagnosisTemplateName: string;
  manualDiagnosis: string;
  severity: "mild" | "moderate" | "severe" | "critical";
  clinicalNotes: string;
};

type DiagnosisPanelProps = {
  templates: DiagnosisTemplate[];
  value: DiagnosisState;
  loading?: boolean;
  saving?: boolean;
  onLoadTemplates?: (selectedDiagnosisId: string) => void;
  onResetTreatmentTemplate?: () => void;
  onResetPrescriptionRows?: () => void;
  onResetDiagnosticTests?: () => void;
  onResetFollowupSuggestion?: () => void;
  onDiagnosisChangeStart?: () => void;
  onChange: (value: DiagnosisState) => void;
  onSave: () => Promise<{ error?: string } | void>;
};

const shellClass =
  "glass-panel p-6 relative overflow-hidden transition-all duration-300 max-w-full";

const fieldClass =
  "glass-input w-full";

export default function DiagnosisPanel({
  templates,
  value,
  loading,
  saving,
  onLoadTemplates,
  onResetTreatmentTemplate,
  onResetPrescriptionRows,
  onResetDiagnosticTests,
  onResetFollowupSuggestion,
  onDiagnosisChangeStart,
  onChange,
  onSave,
}: DiagnosisPanelProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const selectedDiagnosisId = value.diagnosisTemplateId;

  useEffect(() => {
    if (!selectedDiagnosisId) return;
    onLoadTemplates?.(selectedDiagnosisId);
  }, [selectedDiagnosisId, onLoadTemplates]);

  if (loading) {
    return (
      <section className={`${shellClass} animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}>
        <h3 className="text-base font-semibold text-slate-800">Specialist Clinical Diagnosis</h3>
        <div className="mt-4 space-y-3">
          <div className="h-10 animate-pulse rounded-xl bg-blue-100/70" />
          <div className="h-10 animate-pulse rounded-xl bg-blue-100/70" />
          <div className="h-24 animate-pulse rounded-xl bg-blue-100/70" />
        </div>
      </section>
    );
  }

  return (
    <section className={`${shellClass} animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}>
      <h3 className="medical-caption text-blue-400 mb-2">Specialist Clinical Diagnosis</h3>
      <p className="mt-1 text-xs text-slate-400 mb-4">Select a pulmonology template and refine notes before saving.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-300">
          Diagnosis Template
          <select
            className={`${fieldClass} mt-1`}
            value={value.diagnosisTemplateId}
            onChange={(e) => {
              const selectedId = e.target.value;
              const hasDiagnosisChanged = selectedId !== value.diagnosisTemplateId;
              if (hasDiagnosisChanged) {
                onDiagnosisChangeStart?.();
                onResetTreatmentTemplate?.();
                onResetPrescriptionRows?.();
                onResetDiagnosticTests?.();
                onResetFollowupSuggestion?.();
              }
              const selectedTemplate = templates.find((t) => t.id === selectedId);
              onChange({
                ...value,
                diagnosisTemplateId: selectedId,
                diagnosisTemplateName: selectedTemplate?.diagnosis_name ?? "",
                manualDiagnosis: "",
                clinicalNotes: "",
              });
              setIsDirty(true);
              setIsSaved(false);
            }}
          >
            <option value="">Select diagnosis template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.diagnosis_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Severity
          <select
            className={`${fieldClass} mt-2`}
            value={value.severity}
            onChange={(e) =>
              onChange({ ...value, severity: e.target.value as DiagnosisState["severity"] })
            }
            onBlur={() => {
              setIsDirty(true);
              setIsSaved(false);
            }}
          >
            <option value="mild" className="text-black">Mild</option>
            <option value="moderate" className="text-black">Moderate</option>
            <option value="severe" className="text-black">Severe</option>
            <option value="critical" className="text-black">Critical</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="text-sm text-slate-300">
          Manual Diagnosis
          <input
            className={`${fieldClass} mt-2`}
            value={value.manualDiagnosis}
            onChange={(e) => {
              onChange({ ...value, manualDiagnosis: e.target.value });
              setIsDirty(true);
              setIsSaved(false);
            }}
            placeholder="Enter final specialist diagnosis"
            disabled={Boolean(value.diagnosisTemplateId)}
          />
        </label>
        <label className="text-sm text-slate-300">
          Clinical Notes
          <textarea
            className={`${fieldClass} mt-2 min-h-32`}
            value={value.clinicalNotes}
            onChange={(e) => {
              onChange({ ...value, clinicalNotes: e.target.value });
              setIsDirty(true);
              setIsSaved(false);
            }}
            placeholder="Add concise clinical interpretation and rationale."
          />
        </label>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={async () => {
            setIsSaving(true);
            const result = await onSave();
            setIsSaving(false);
            const suc = (result as { success?: boolean } | null | undefined)?.success;
            if (suc) {
              setIsSaved(true);
              setIsDirty(false);
              setShowToast(true);
              setTimeout(() => setShowToast(false), 5500);
            }
          }}
          disabled={isSaving || Boolean(saving) || (isSaved && !isDirty)}
          className="glass-btn-primary flex-1 max-w-[200px]"
        >
          {isSaving || saving ? "Saving..." : isSaved && !isDirty ? "Saved" : "Save Diagnosis"}
        </button>
        {isSaved ? (
          <button
            type="button"
            onClick={() => {
              setIsSaved(false);
              setIsDirty(true);
            }}
            className="glass-btn-secondary"
          >
            Modify
          </button>
        ) : null}
      </div>

      {showToast && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl bg-green-600 shadow-xl text-white text-sm font-medium transition-all animate-in slide-in-from-top-2 fade-in-0 duration-300">
          ✅ Diagnosis saved successfully
        </div>
      )}
    </section>
  );
}
