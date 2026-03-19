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
    <section className="rounded-2xl border border-white/50 bg-gradient-to-br from-white/80 to-blue-100/50 p-5 shadow-md backdrop-blur-xl transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-2 hover:-translate-y-1 hover:shadow-lg">
      <h3 className="text-lg font-semibold text-slate-800">Treatment Advice</h3>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-xl bg-white/80 p-3 md:col-span-2">
          <p className="text-xs text-slate-500">Treatment plan name</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{treatmentTitle || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs text-slate-500">Medication overview</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{medicationOverview || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs text-slate-500">Lifestyle advice</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{lifestyleAdvice || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs text-slate-500">Rehabilitation guidance</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{rehabGuidance || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs text-slate-500">Referral recommendation</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{referralRecommendation || "-"}</p>
        </div>
      </div>
    </section>
  );
}
