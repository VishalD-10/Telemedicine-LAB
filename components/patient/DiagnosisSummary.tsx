"use client";

type DiagnosisSummaryProps = {
  diagnosisName: string | null;
  severity: string | null;
  explanation: string;
  doctorName: string | null;
  date: string | null;
};

export default function DiagnosisSummary({
  diagnosisName,
  severity,
  explanation,
  doctorName,
  date,
}: DiagnosisSummaryProps) {
  return (
    <section className="glass-panel p-6 w-full flex flex-col h-full hover:-translate-y-1 transition-transform duration-300">
      <h3 className="medical-caption text-blue-700 mb-4">Specialist Diagnosis</h3>
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div className="rounded-xl bg-white/85 border border-slate-200 p-4 transition hover:bg-white">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">Diagnosis</p>
          <p className="font-bold text-slate-900">{diagnosisName || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/85 border border-slate-200 p-4 transition hover:bg-white">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">Severity</p>
          <p className="font-bold capitalize text-slate-900">{severity || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/85 border border-slate-200 p-4 transition hover:bg-white">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">Notes</p>
          <p className="whitespace-pre-wrap font-medium text-slate-700 leading-relaxed">{explanation || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/85 border border-slate-200 p-4 transition hover:bg-white">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">Date</p>
          <p className="font-medium text-slate-700">{date ? new Date(date).toLocaleString() : "-"}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-between items-center bg-blue-50 border border-blue-200 px-4 py-3 rounded-xl shadow-inner">
        <span className="text-[10px] uppercase tracking-widest font-bold text-blue-700">Attending Specialist</span>
        <span className="text-sm font-bold text-slate-900 tracking-wide">{doctorName || "Pending Assignment"}</span>
      </div>
    </section>
  );
}
