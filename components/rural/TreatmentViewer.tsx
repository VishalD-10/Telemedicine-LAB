"use client";

type TreatmentViewerProps = {
  medications: string | null;
  inhalerTherapy: string | null;
  oxygenTherapy: string | null;
  pulmonaryRehab: string | null;
  lifestyleAdvice: string | null;
  referralNotes: string | null;
};

const card = "rounded-xl bg-white/70 p-3 shadow-sm";

export default function TreatmentViewer({
  medications,
  inhalerTherapy,
  oxygenTherapy,
  pulmonaryRehab,
  lifestyleAdvice,
  referralNotes,
}: TreatmentViewerProps) {
  return (
    <section className="rounded-2xl border border-white/40 bg-gradient-to-br from-white/70 to-blue-100/40 p-5 shadow-md backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]">
      <h3 className="text-base font-semibold text-slate-800">Therapeutic Plan Overview</h3>
      <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
        <div className={card}>
          <p className="text-xs text-slate-500">Medications</p>
          <p className="mt-1 whitespace-pre-wrap">{medications || "-"}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-500">Inhaler therapy</p>
          <p className="mt-1 whitespace-pre-wrap">{inhalerTherapy || "-"}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-500">Oxygen therapy</p>
          <p className="mt-1 whitespace-pre-wrap">{oxygenTherapy ?? "-"}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-500">Rehabilitation</p>
          <p className="mt-1 whitespace-pre-wrap">{pulmonaryRehab || "-"}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-500">Lifestyle advice</p>
          <p className="mt-1 whitespace-pre-wrap">{lifestyleAdvice || "-"}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-500">Referral notes</p>
          <p className="mt-1 whitespace-pre-wrap">{referralNotes || "-"}</p>
        </div>
      </div>
    </section>
  );
}
