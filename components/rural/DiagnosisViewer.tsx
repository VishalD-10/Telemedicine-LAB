"use client";

type DiagnosisViewerProps = {
  primaryDiagnosis: string | null;
  severity: string | null;
  clinicalNotes: string | null;
  specialistName: string | null;
  diagnosisTimestamp: string | null;
};

export default function DiagnosisViewer({
  primaryDiagnosis,
  severity,
  clinicalNotes,
  specialistName,
  diagnosisTimestamp,
}: DiagnosisViewerProps) {
  return (
    <section className="rounded-2xl border border-white/40 bg-gradient-to-br from-white/70 to-blue-100/40 p-5 shadow-md backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]">
      <h3 className="text-base font-semibold text-slate-800">Specialist Diagnostic Assessment</h3>
      <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
        <div className="rounded-xl bg-white/70 p-3 shadow-sm">
          <p className="text-xs text-slate-500">Primary diagnosis</p>
          <p className="mt-1 font-medium">{primaryDiagnosis || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/70 p-3 shadow-sm">
          <p className="text-xs text-slate-500">Severity</p>
          <p className="mt-1 font-medium capitalize">{severity || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/70 p-3 shadow-sm">
          <p className="text-xs text-slate-500">Specialist</p>
          <p className="mt-1 font-medium">{specialistName || "-"}</p>
        </div>
        <div className="rounded-xl bg-white/70 p-3 shadow-sm">
          <p className="text-xs text-slate-500">Diagnosis timestamp</p>
          <p className="mt-1 font-medium">{diagnosisTimestamp ? new Date(diagnosisTimestamp).toLocaleString() : "-"}</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-white/70 p-3 shadow-sm">
        <p className="text-xs text-slate-500">Clinical notes</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{clinicalNotes || "-"}</p>
      </div>
    </section>
  );
}
