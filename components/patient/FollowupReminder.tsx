"use client";

type FollowupReminderProps = {
  nextVisitDate: string | null;
  followupNotes: string | null;
  diagnosticProcedures: string[];
};

function getCountdownText(nextVisitDate: string | null) {
  if (!nextVisitDate) return { text: "-", label: "No date set" };
  const now = new Date();
  const visit = new Date(nextVisitDate);
  const diffDays = Math.ceil((visit.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return { text: `${diffDays} day(s) left`, label: "Upcoming" };
  if (diffDays === 0) return { text: "Today", label: "Due now" };
  return { text: `${Math.abs(diffDays)} day(s) late`, label: "Overdue" };
}

export default function FollowupReminder({ nextVisitDate, followupNotes, diagnosticProcedures }: FollowupReminderProps) {
  const countdown = getCountdownText(nextVisitDate);
  const badgeClass =
    countdown.label === "Overdue"
      ? "bg-red-500/20 text-red-300 border border-red-500/30"
      : countdown.label === "Due now"
      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";

  return (
    <section className="glass-panel p-6 w-full flex flex-col h-full hover:-translate-y-1 transition-transform duration-300">
      <div className="flex justify-between items-start mb-6">
        <h3 className="medical-caption text-cyan-700">Next Check-up</h3>
        <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-widest font-bold shadow-sm ${badgeClass}`}>
          {countdown.label}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <div className="rounded-xl bg-white/85 border border-slate-200 p-4 transition hover:bg-white text-center flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">Status</p>
          <p className="font-bold text-slate-900">{countdown.text}</p>
        </div>
        <div className="rounded-xl bg-white/85 border border-slate-200 p-4 transition hover:bg-white text-center flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">Next visit date</p>
          <p className="text-lg font-bold text-slate-900 tracking-wide">
            {nextVisitDate ? new Date(nextVisitDate).toLocaleDateString() : "-"}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-white/85 border border-slate-200 p-4 transition hover:bg-white mb-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">Follow-up Notes</p>
        <p className="text-sm font-medium text-slate-700 leading-relaxed">{followupNotes || "-"}</p>
      </div>

      <div className="rounded-xl bg-white/85 border border-slate-200 p-4 transition hover:bg-white flex-1">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-3 block border-b border-slate-200 pb-2">Further Diagnostic Procedures</p>
        {diagnosticProcedures?.length ? (
          <ul className="space-y-2 mt-2">
            {diagnosticProcedures.map((item, i) => (
              <li key={i} className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-cyan-400/80 rounded-full"></span>
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-medium text-slate-600 italic mt-2">No further procedures listed.</p>
        )}
      </div>
    </section>
  );
}
