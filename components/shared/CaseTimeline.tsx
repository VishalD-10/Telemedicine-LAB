"use client";

import { Check, Clock, ShieldCheck, Activity, Pill, Calendar, Award } from "lucide-react";

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
  icon: React.ElementType;
  done: boolean;
  color: string;
  glow: string;
};

const COLOR_RULES: Record<keyof TimelineTimestamps, { color: string; glow: string; icon: React.ElementType }> = {
  caseCreated: { color: "bg-slate-400", glow: "shadow-[0_0_15px_-3px_rgba(148,163,184,0.3)]", icon: Clock },
  specialistAssigned: { color: "bg-blue-500", glow: "shadow-[0_0_15px_-3px_rgba(59,130,246,0.5)]", icon: Activity },
  diagnosisCompleted: { color: "bg-cyan-500", glow: "shadow-[0_0_15px_-3px_rgba(6,182,212,0.5)]", icon: ShieldCheck },
  treatmentGenerated: { color: "bg-emerald-500", glow: "shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]", icon: Pill },
  followupScheduled: { color: "bg-amber-500", glow: "shadow-[0_0_15px_-3px_rgba(245,158,11,0.5)]", icon: Calendar },
  caseFinalized: { color: "bg-purple-500", glow: "shadow-[0_0_15px_-3px_rgba(168,85,247,0.5)]", icon: Award },
};

export default function CaseTimeline({ caseId, timestamps, title = "Consultation Roadmap" }: CaseTimelineProps) {
  // Ensure that if a later step is done, earlier ones are also considered done for UI consistency
  const nodes: TimelineNode[] = [
    { key: "caseCreated", label: "Intake Recorded", done: Boolean(timestamps.caseCreated || timestamps.caseFinalized), ...COLOR_RULES.caseCreated },
    { key: "specialistAssigned", label: "Expert Assignment", done: Boolean(timestamps.specialistAssigned || timestamps.caseFinalized), ...COLOR_RULES.specialistAssigned },
    { key: "diagnosisCompleted", label: "Diagnostic Synthesis", done: Boolean(timestamps.diagnosisCompleted || timestamps.caseFinalized), ...COLOR_RULES.diagnosisCompleted },
    { key: "treatmentGenerated", label: "Protocol Development", done: Boolean(timestamps.treatmentGenerated || timestamps.caseFinalized), ...COLOR_RULES.treatmentGenerated },
    { key: "followupScheduled", label: "Continuity Scheduled", done: Boolean(timestamps.followupScheduled || timestamps.caseFinalized), ...COLOR_RULES.followupScheduled },
    { key: "caseFinalized", label: "Final Validation", done: Boolean(timestamps.caseFinalized), ...COLOR_RULES.caseFinalized },
  ];

  const lastDoneIndex = nodes.map((n) => n.done).lastIndexOf(true);

  return (
    <section className="glass-panel p-6 overflow-hidden border border-slate-200/50 shadow-xl transition-all duration-500">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">{title}</h3>
        </div>
        <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded-full text-slate-400">
          ID: {caseId?.slice(0, 8).toUpperCase() ?? "NEW"}
        </span>
      </div>

      <div className="relative">
        {/* Connection Line */}
        <div className="absolute left-[17.5px] top-6 bottom-6 w-[2px] bg-slate-100" />
        
        <div className="space-y-6">
          {nodes.map((node, index) => {
            const isActive = index === (lastDoneIndex + 1) && index < nodes.length;
            const isCompleted = node.done;
            const at = timestamps[node.key];
            const NodeIcon = node.icon;

            return (
              <div
                key={node.key}
                className={`group relative flex items-start gap-5 transition-all duration-500 ${
                  isCompleted ? "opacity-100" : "opacity-60"
                }`}
              >
                {/* Node Circle */}
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl p-2 transition-all duration-500 scale-90 group-hover:scale-100 ${
                      isCompleted
                        ? `${node.color} text-white ${node.glow}`
                        : isActive
                        ? "bg-white border-2 border-blue-400 text-blue-500 shadow-lg animate-pulse"
                        : "bg-slate-50 border border-slate-200 text-slate-300"
                    }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5" strokeWidth={3} /> : <NodeIcon className="w-5 h-5" />}
                  </div>
                </div>

                {/* Node Content */}
                <div className={`flex-1 min-w-0 transition-all duration-500 ${isActive ? "translate-x-1" : ""}`}>
                  <div className="flex flex-col">
                    <p className={`text-sm font-bold tracking-tight ${isCompleted ? "text-slate-800" : "text-slate-500"}`}>
                      {node.label}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isCompleted ? (
                        <p className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 rounded-full">
                          {at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Verified"}
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium text-slate-400 italic">
                          {isActive ? "Currently Processing..." : "Awaiting Progression"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
