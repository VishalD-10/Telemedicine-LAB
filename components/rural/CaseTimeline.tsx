"use client";

type CaseTimelineProps = {
  caseCreatedAt: string | null;
  specialistAcceptedAt: string | null;
  diagnosisSubmittedAt: string | null;
  treatmentGeneratedAt: string | null;
  followupScheduledAt: string | null;
  caseFinalizedAt: string | null;
};

type Item = { label: string; timestamp: string | null };

export default function CaseTimeline({
  caseCreatedAt,
  specialistAcceptedAt,
  diagnosisSubmittedAt,
  treatmentGeneratedAt,
  followupScheduledAt,
  caseFinalizedAt,
}: CaseTimelineProps) {
  const items: Item[] = [
    { label: "Case Created", timestamp: caseCreatedAt },
    { label: "Specialist Accepted", timestamp: specialistAcceptedAt },
    { label: "Diagnosis Submitted", timestamp: diagnosisSubmittedAt },
    { label: "Treatment Generated", timestamp: treatmentGeneratedAt },
    { label: "Follow-up Scheduled", timestamp: followupScheduledAt },
    { label: "Case Finalized", timestamp: caseFinalizedAt },
  ];

  return (
    <section className="rounded-2xl border border-white/40 bg-gradient-to-br from-white/70 to-blue-100/40 p-5 shadow-md backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]">
      <h3 className="text-base font-semibold text-slate-800">Case Timeline</h3>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => {
          const done = Boolean(item.timestamp);
          return (
            <div key={item.label} className="flex items-start gap-3">
              <div className="mt-0.5 flex flex-col items-center">
                <span className={`h-3 w-3 rounded-full ${done ? "bg-blue-600" : "bg-slate-300"}`} />
                {index !== items.length - 1 ? <span className="mt-1 h-6 w-px bg-slate-300" /> : null}
              </div>
              <div className="rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm">
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-slate-500">
                  {item.timestamp ? new Date(item.timestamp).toLocaleString() : "Pending"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
