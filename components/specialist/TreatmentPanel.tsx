"use client";

import { useState } from "react";

type TreatmentState = {
  treatmentTitle: string;
  medications: string;
  inhalerTherapy: string;
  oxygenTherapy: string;
  pulmonaryRehab: string;
  lifestyleAdvice: string;
  referralRecommendation: string;
};

type TreatmentPanelProps = {
  value: TreatmentState;
  templateTitle?: string;
  loading?: boolean;
  saving?: boolean;
  onChange: (value: TreatmentState) => void;
  onSave: () => Promise<{ error?: string } | void>;
};

const shellClass =
  "glass-panel p-6 relative overflow-hidden transition-all duration-300 max-w-full";

const fieldClass =
  "glass-input w-full";

export default function TreatmentPanel({
  value,
  loading,
  saving,
  onChange,
  onSave,
}: TreatmentPanelProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const updateValue = (next: TreatmentState) => {
    onChange(next);
    setIsDirty(true);
    setIsSaved(false);
  };

  if (loading) {
    return (
      <section className={`${shellClass} animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}>
        <h3 className="text-base font-semibold text-slate-800">Therapeutic Management Plan</h3>
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`treat-sk-${idx}`} className="h-16 animate-pulse rounded-xl bg-blue-100/70" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={`${shellClass} animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}>
      <h3 className="medical-caption text-blue-400 mb-4">Therapeutic Protocol & Management Plan</h3>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <label className="text-sm text-slate-300 md:col-span-2">
          Treatment Title
          <input
            className={`${fieldClass} mt-2`}
            value={value.treatmentTitle}
            onChange={(e) => updateValue({ ...value, treatmentTitle: e.target.value })}
            placeholder="Enter treatment title"
          />
        </label>
        <label className="text-sm text-slate-300">
          Medications
          <textarea
            className={`${fieldClass} mt-2 min-h-24`}
            value={value.medications}
            onChange={(e) => updateValue({ ...value, medications: e.target.value })}
            placeholder="Drug strategy summary"
          />
        </label>
        <label className="text-sm text-slate-300">
          Inhaler Therapy
          <textarea
            className={`${fieldClass} mt-2 min-h-24`}
            value={value.inhalerTherapy}
            onChange={(e) => updateValue({ ...value, inhalerTherapy: e.target.value })}
            placeholder="Inhaler protocol and technique notes"
          />
        </label>
        <label className="text-sm text-slate-300">
          Oxygen Therapy
          <select
            className={`${fieldClass} mt-2 text-slate-800`}
            value={value.oxygenTherapy}
            onChange={(e) => updateValue({ ...value, oxygenTherapy: e.target.value })}
          >
            <option value="Yes" className="text-black">Required</option>
            <option value="No" className="text-black">Not Required</option>
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Pulmonary Rehab
          <textarea
            className={`${fieldClass} mt-2 min-h-24`}
            value={value.pulmonaryRehab}
            onChange={(e) => updateValue({ ...value, pulmonaryRehab: e.target.value })}
            placeholder="Rehabilitation protocol"
          />
        </label>
        <label className="text-sm text-slate-300">
          Lifestyle Advice
          <textarea
            className={`${fieldClass} mt-2 min-h-24`}
            value={value.lifestyleAdvice}
            onChange={(e) => updateValue({ ...value, lifestyleAdvice: e.target.value })}
            placeholder="Smoking cessation, vaccination, exercise guidance"
          />
        </label>
        <label className="text-sm text-slate-300">
          Referral Recommendation
          <textarea
            className={`${fieldClass} mt-2 min-h-24`}
            value={value.referralRecommendation}
            onChange={(e) => updateValue({ ...value, referralRecommendation: e.target.value })}
            placeholder="Escalation/referral advice"
          />
        </label>
      </div>

      <div className="mt-8 flex gap-3">
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
          {isSaving || saving ? "Saving Protocol..." : isSaved && !isDirty ? "Protocol Saved" : "Save Protocol"}
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
            Modify Protocol
          </button>
        ) : null}
      </div>

      {showToast && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl bg-green-600 shadow-xl text-white text-sm font-medium transition-all animate-in slide-in-from-top-2 fade-in-0 duration-300">
          ✅ Treatment plan saved successfully
        </div>
      )}
    </section>
  );
}
