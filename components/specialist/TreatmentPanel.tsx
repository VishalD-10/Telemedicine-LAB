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
  onSave: () => void;
};

const shellClass =
  "rounded-2xl border border-blue-100/70 bg-gradient-to-br from-white/90 to-blue-50/70 p-5 shadow-[0_16px_42px_-26px_rgba(30,64,175,0.6)] backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_20px_46px_-24px_rgba(30,64,175,0.65)]";

const fieldClass =
  "w-full rounded-xl border border-blue-100 bg-white/80 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200";

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
      <h3 className="text-base font-semibold text-slate-800">Therapeutic Management Plan</h3>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-700 md:col-span-2">
          Treatment Title
          <input
            className={`${fieldClass} mt-1`}
            value={value.treatmentTitle}
            onChange={(e) => updateValue({ ...value, treatmentTitle: e.target.value })}
            placeholder="Enter treatment title"
          />
        </label>
        <label className="text-sm text-slate-700">
          Medications
          <textarea
            className={`${fieldClass} mt-1 min-h-20`}
            value={value.medications}
            onChange={(e) => updateValue({ ...value, medications: e.target.value })}
            placeholder="Drug strategy summary"
          />
        </label>
        <label className="text-sm text-slate-700">
          Inhaler Therapy
          <textarea
            className={`${fieldClass} mt-1 min-h-20`}
            value={value.inhalerTherapy}
            onChange={(e) => updateValue({ ...value, inhalerTherapy: e.target.value })}
            placeholder="Inhaler protocol and technique notes"
          />
        </label>
        <label className="text-sm text-slate-700">
          Oxygen Therapy
          <select
            className={`${fieldClass} mt-1`}
            value={value.oxygenTherapy}
            onChange={(e) => updateValue({ ...value, oxygenTherapy: e.target.value })}
          >
            <option value="Yes">Required</option>
            <option value="No">Not Required</option>
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Pulmonary Rehab
          <textarea
            className={`${fieldClass} mt-1 min-h-20`}
            value={value.pulmonaryRehab}
            onChange={(e) => updateValue({ ...value, pulmonaryRehab: e.target.value })}
            placeholder="Rehabilitation protocol"
          />
        </label>
        <label className="text-sm text-slate-700">
          Lifestyle Advice
          <textarea
            className={`${fieldClass} mt-1 min-h-20`}
            value={value.lifestyleAdvice}
            onChange={(e) => updateValue({ ...value, lifestyleAdvice: e.target.value })}
            placeholder="Smoking cessation, vaccination, exercise guidance"
          />
        </label>
        <label className="text-sm text-slate-700">
          Referral Recommendation
          <textarea
            className={`${fieldClass} mt-1 min-h-20`}
            value={value.referralRecommendation}
            onChange={(e) => updateValue({ ...value, referralRecommendation: e.target.value })}
            placeholder="Escalation/referral advice"
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
