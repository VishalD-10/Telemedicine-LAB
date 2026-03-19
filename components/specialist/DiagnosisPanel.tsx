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
  onSave: () => void;
};

const shellClass =
  "rounded-2xl border border-blue-100/70 bg-gradient-to-br from-white/90 to-blue-50/70 p-5 shadow-[0_16px_42px_-26px_rgba(30,64,175,0.6)] backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_20px_46px_-24px_rgba(30,64,175,0.65)]";

const fieldClass =
  "w-full rounded-xl border border-blue-100 bg-white/80 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200";

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
      <h3 className="text-base font-semibold text-slate-800">Specialist Clinical Diagnosis</h3>
      <p className="mt-1 text-xs text-slate-600">Select a pulmonology template and refine notes before saving.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-700">
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
        <label className="text-sm text-slate-700">
          Severity
          <select
            className={`${fieldClass} mt-1`}
            value={value.severity}
            onChange={(e) =>
              onChange({ ...value, severity: e.target.value as DiagnosisState["severity"] })
            }
            onBlur={() => {
              setIsDirty(true);
              setIsSaved(false);
            }}
          >
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="critical">Critical</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3">
        <label className="text-sm text-slate-700">
          Manual Diagnosis
          <input
            className={`${fieldClass} mt-1`}
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
        <label className="text-sm text-slate-700">
          Clinical Notes
          <textarea
            className={`${fieldClass} mt-1 min-h-24`}
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

      <div className="mt-4">
        <button
          type="button"
          onClick={async () => {
            setIsSaving(true);
            await onSave();
            setIsSaving(false);
            setIsSaved(true);
            setIsDirty(false);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
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
            className="ml-2 rounded-xl border border-blue-200 bg-white/90 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
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
