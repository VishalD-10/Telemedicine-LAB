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
    <section className="rounded-2xl border border-white/50 bg-gradient-to-br from-white/80 to-blue-100/50 p-5 shadow-md backdrop-blur-xl transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-2 hover:-translate-y-1 hover:shadow-lg">
      <h3 className="text-lg font-semibold text-slate-800">Specialist Diagnosis</h3>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs text-slate-500">Diagnosis</p>
          <p className="mt-1 font-medium text-slate-800">{diagnosisName || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs text-slate-500">Severity</p>
          <p className="mt-1 font-medium capitalize text-slate-800">{severity || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs text-slate-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap font-medium text-slate-800">{explanation || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs text-slate-500">Date</p>
          <p className="mt-1 font-medium text-slate-800">{date ? new Date(date).toLocaleString() : "-"}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Specialist: {doctorName || "-"}</p>
    </section>
  );
}
