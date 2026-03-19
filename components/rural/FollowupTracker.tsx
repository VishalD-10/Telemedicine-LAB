"use client";

type FollowupTrackerProps = {
  nextFollowupDate: string | null;
};

function getCountdown(nextFollowupDate: string | null) {
  if (!nextFollowupDate) return { text: "-", status: "No Date" };
  const today = new Date();
  const followDate = new Date(nextFollowupDate);
  const diffMs = followDate.getTime() - today.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days > 0) return { text: `${days} day(s) remaining`, status: "Scheduled" };
  if (days === 0) return { text: "Due today", status: "Due" };
  return { text: `${Math.abs(days)} day(s) overdue`, status: "Overdue" };
}

export default function FollowupTracker({ nextFollowupDate }: FollowupTrackerProps) {
  const countdown = getCountdown(nextFollowupDate);
  const badgeClass =
    countdown.status === "Overdue"
      ? "bg-red-100 text-red-700"
      : countdown.status === "Due"
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <section className="rounded-2xl border border-white/40 bg-gradient-to-br from-white/70 to-blue-100/40 p-5 shadow-md backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]">
      <h3 className="text-base font-semibold text-slate-800">Follow-up Monitoring</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-white/70 p-3 shadow-sm">
          <p className="text-xs text-slate-500">Next follow-up date</p>
          <p className="mt-1 text-sm font-medium text-slate-700">
            {nextFollowupDate ? new Date(nextFollowupDate).toLocaleDateString() : "-"}
          </p>
        </div>
        <div className="rounded-xl bg-white/70 p-3 shadow-sm md:col-span-2">
          <p className="text-xs text-slate-500">Countdown</p>
          <p className="mt-1 text-sm font-medium text-slate-700">{countdown.text}</p>
        </div>
      </div>
      <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{countdown.status}</span>
    </section>
  );
}
