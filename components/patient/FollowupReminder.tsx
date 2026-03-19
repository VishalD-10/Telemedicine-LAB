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
      ? "bg-red-100 text-red-700"
      : countdown.label === "Due now"
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <section className="rounded-2xl border border-white/50 bg-gradient-to-br from-white/80 to-blue-100/50 p-5 shadow-md backdrop-blur-xl transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-2 hover:-translate-y-1 hover:shadow-lg">
      <h3 className="text-lg font-semibold text-slate-800">Next Check-up</h3>
      <div className="mt-3 rounded-xl bg-white/80 p-4">
        <p className="text-xs text-slate-500">Next visit date</p>
        <p className="mt-1 text-sm font-medium text-slate-800">
          {nextVisitDate ? new Date(nextVisitDate).toLocaleDateString() : "-"}
        </p>
      </div>
      <div className="mt-3 rounded-xl bg-white/80 p-4">
        <p className="text-xs text-slate-500">Follow-up Notes</p>
        <p className="text-sm text-slate-800">{followupNotes || "-"}</p>
      </div>
      <div className="mt-3">
        <p className="text-xs text-slate-500">Further Diagnostic Procedures</p>
        {diagnosticProcedures?.length ? (
          <ol className="list-decimal ml-5 text-sm text-slate-800">
            {diagnosticProcedures.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-600">-</p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-white/80 p-4">
        <p className="text-sm text-slate-700">{countdown.text}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{countdown.label}</span>
      </div>
    </section>
  );
}
