"use client";

type TreatmentSummaryProps = {
  treatmentTitle: string | null;
  medicationOverview: string | null;
  lifestyleAdvice: string | null;
  rehabGuidance: string | null;
  referralRecommendation: string | null;
};

export default function TreatmentSummary({
  treatmentTitle,
  medicationOverview,
  lifestyleAdvice,
  rehabGuidance,
  referralRecommendation,
}: TreatmentSummaryProps) {
  return (
    <section className="glass-panel p-6 w-full flex flex-col h-full hover:-translate-y-1 transition-transform duration-300">
      <h3 className="medical-caption text-emerald-700 mb-4">Treatment Advice</h3>
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div className="rounded-xl bg-white/85 border border-slate-200 p-4 md:col-span-2 transition hover:bg-white">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">Treatment plan name</p>
          <p className="font-bold text-slate-900 whitespace-pre-wrap">{treatmentTitle || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/85 border border-slate-200 p-4 transition hover:bg-white">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">Medication overview</p>
          <p className="font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">{medicationOverview || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/85 border border-slate-200 p-4 transition hover:bg-white">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">Lifestyle advice</p>
          <p className="font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">{lifestyleAdvice || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/85 border border-slate-200 p-4 transition hover:bg-white">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">Rehabilitation guidance</p>
          <p className="font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">{rehabGuidance || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/85 border border-slate-200 p-4 transition hover:bg-white">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">Referral recommendation</p>
          <p className="font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">{referralRecommendation || "-"}</p>
        </div>
      </div>
    </section>
  );
}
