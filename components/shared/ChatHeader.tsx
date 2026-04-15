"use client";

type ChatHeaderProps = {
  caseId?: string | null;
  patientName?: string | null;
  priority?: "emergency" | "normal" | string | null;
};

export default function ChatHeader({ caseId, patientName, priority }: ChatHeaderProps) {
  const isEmergency = priority === "emergency";

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/85 p-3 text-slate-900 shadow-sm backdrop-blur-md">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-600">Clinical Discussion</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5 text-sm text-slate-700">
          <p>
            <span className="text-slate-500">Case:</span> {caseId ?? "-"}
          </p>
          <p>
            <span className="text-slate-500">Patient:</span> {patientName ?? "-"}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            isEmergency ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
          }`}
        >
          {isEmergency ? "Emergency" : "Normal"}
        </span>
      </div>
    </div>
  );
}
