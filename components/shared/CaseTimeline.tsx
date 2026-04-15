"use client";

type TimelineTimestamps = {
  caseCreated?: string | null;
  specialistAssigned?: string | null;
  diagnosisCompleted?: string | null;
  treatmentGenerated?: string | null;
  followupScheduled?: string | null;
  caseFinalized?: string | null;
};

type CaseTimelineProps = {
  caseId?: string | null;
  timestamps: TimelineTimestamps;
  title?: string;
};

type TimelineNode = {
  key: keyof TimelineTimestamps;
  label: string;
  done: boolean;
  color: string;
  glow: string;
};

const COLOR_RULES: Record<keyof TimelineTimestamps, { color: string; glow: string }> = {
  caseCreated: { color: "bg-slate-400", glow: "shadow-[0_0_0_4px_rgba(148,163,184,0.2)]" },
  specialistAssigned: { color: "bg-blue-500", glow: "shadow-[0_0_0_4px_rgba(59,130,246,0.24)]" },
  diagnosisCompleted: { color: "bg-cyan-500", glow: "shadow-[0_0_0_4px_rgba(6,182,212,0.24)]" },
  treatmentGenerated: { color: "bg-emerald-500", glow: "shadow-[0_0_0_4px_rgba(16,185,129,0.24)]" },
  followupScheduled: { color: "bg-amber-500", glow: "shadow-[0_0_0_4px_rgba(245,158,11,0.24)]" },
  caseFinalized: { color: "bg-purple-500", glow: "shadow-[0_0_0_4px_rgba(168,85,247,0.24)]" },
};

export default function CaseTimeline({ caseId, timestamps, title = "Case Timeline" }: CaseTimelineProps) {
  const nodes: TimelineNode[] = [
    { key: "caseCreated", label: "Case Created", done: Boolean(timestamps.caseCreated), ...COLOR_RULES.caseCreated },
    {
      key: "specialistAssigned",
      label: "Specialist Assigned",
      done: Boolean(timestamps.specialistAssigned),
      ...COLOR_RULES.specialistAssigned,
    },
    {
      key: "diagnosisCompleted",
      label: "Diagnosis Completed",
      done: Boolean(timestamps.diagnosisCompleted),
      ...COLOR_RULES.diagnosisCompleted,
    },
    {
      key: "treatmentGenerated",
      label: "Treatment Plan Generated",
      done: Boolean(timestamps.treatmentGenerated),
      ...COLOR_RULES.treatmentGenerated,
    },
    {
      key: "followupScheduled",
      label: "Follow-up Scheduled",
      done: Boolean(timestamps.followupScheduled),
      ...COLOR_RULES.followupScheduled,
    },
    { key: "caseFinalized", label: "Case Finalized", done: Boolean(timestamps.caseFinalized), ...COLOR_RULES.caseFinalized },
  ];

  const lastDoneIndex = nodes.map((n) => n.done).lastIndexOf(true);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-blue-50/80 p-5 text-slate-900 shadow-md backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-500">{caseId ? `Case ${caseId.slice(0, 8)}` : "Case"}</span>
      </div>

      <div className="space-y-3">
        {nodes.map((node, index) => {
          const isActive = index === lastDoneIndex;
          const at = timestamps[node.key];
          return (
            <div
              key={node.key}
              className="group relative flex items-start gap-3 rounded-xl px-2 py-1 transition-all duration-300 hover:bg-white/60 animate-in fade-in-0 slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="mt-0.5 flex flex-col items-center">
                <span
                  className={`h-3.5 w-3.5 rounded-full transition-all duration-300 ${
                    node.done ? `${node.color} ${isActive ? node.glow : ""}` : "bg-slate-300"
                  }`}
                />
                {index !== nodes.length - 1 ? <span className="mt-1 h-7 w-px bg-slate-300/80" /> : null}
              </div>
              <div className="rounded-lg bg-white/80 px-3 py-2 transition-all duration-300 group-hover:bg-white">
                <p className={`text-sm font-medium ${node.done ? "text-slate-900" : "text-slate-500"}`}>{node.label}</p>
                <p className={`text-xs ${node.done ? "text-slate-600" : "text-slate-500"}`}>
                  {at ? new Date(at).toLocaleString() : "Pending"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
