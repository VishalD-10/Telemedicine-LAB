"use client";

type PatientTimelineProps = {
  caseCreatedAt: string | null;
  diagnosisAt: string | null;
  treatmentAt: string | null;
  followupAt: string | null;
  caseClosedAt: string | null;
};

type TimelineItem = { label: string; at: string | null };

export default function PatientTimeline({
  caseCreatedAt,
  diagnosisAt,
  treatmentAt,
  followupAt,
  caseClosedAt,
}: PatientTimelineProps) {
  const items: TimelineItem[] = [
    { label: "Case Created", at: caseCreatedAt },
    { label: "Specialist Diagnosis", at: diagnosisAt },
    { label: "Treatment Plan", at: treatmentAt },
    { label: "Follow-up Scheduled", at: followupAt },
    { label: "Case Closed", at: caseClosedAt },
  ];

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-blue-50/80 p-5 text-slate-900 shadow-md backdrop-blur-xl transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-2 hover:-translate-y-1 hover:shadow-lg">
      <h3 className="text-lg font-semibold text-slate-900">Care Timeline</h3>
      <div className="mt-4 space-y-3">
        {items.map((item, idx) => {
          const done = Boolean(item.at);
          return (
            <div key={item.label} className="flex items-start gap-3">
              <div className="mt-1 flex flex-col items-center">
                <span className={`h-3 w-3 rounded-full ${done ? "bg-blue-600" : "bg-slate-300"}`} />
                {idx !== items.length - 1 ? <span className="mt-1 h-6 w-px bg-slate-300" /> : null}
              </div>
              <div className="rounded-lg bg-white/90 px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-500">{item.at ? new Date(item.at).toLocaleString() : "Pending"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
