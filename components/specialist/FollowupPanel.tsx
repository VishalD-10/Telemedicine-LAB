"use client";

import { useEffect, useRef, useState } from "react";

type FollowupPanelProps = {
  selectedDiagnosisId?: string | null;
  interval: string;
  date: string;
  notes: string;
  suggestedIntervalDays?: number | null;
  saving?: boolean;
  onIntervalChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSave: () => void;
};

const shellClass =
  "rounded-2xl border border-blue-100/70 bg-gradient-to-br from-white/90 to-blue-50/70 p-5 shadow-[0_16px_42px_-26px_rgba(30,64,175,0.6)] backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_20px_46px_-24px_rgba(30,64,175,0.65)]";

const fieldClass =
  "w-full rounded-xl border border-blue-100 bg-white/80 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200";

export default function FollowupPanel({
  selectedDiagnosisId,
  interval,
  date,
  notes,
  suggestedIntervalDays,
  saving,
  onIntervalChange,
  onDateChange,
  onNotesChange,
  onSave,
}: FollowupPanelProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const currentDiagnosisIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedDiagnosisId) return;
    if (currentDiagnosisIdRef.current === selectedDiagnosisId) return;
    currentDiagnosisIdRef.current = selectedDiagnosisId;
    onIntervalChange("2 weeks");
    onNotesChange("");
  }, [selectedDiagnosisId, onIntervalChange, onNotesChange]);

  useEffect(() => {
    if (!suggestedIntervalDays || suggestedIntervalDays <= 0) return;
    const weeks = Math.max(1, Math.round(suggestedIntervalDays / 7));
    const label =
      weeks <= 1 ? "1 week" :
      weeks <= 2 ? "2 weeks" :
      weeks <= 4 ? "4 weeks" :
      weeks <= 6 ? "6 weeks" :
      "3 months";
    onIntervalChange(label);
  }, [suggestedIntervalDays, onIntervalChange]);

  return (
    <section className={`${shellClass} animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}>
      <h3 className="text-base font-semibold text-slate-800">Follow-up Scheduling</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-700">
          Suggested Interval
          <select
            className={`${fieldClass} mt-1`}
            value={interval}
            onChange={(e) => {
              onIntervalChange(e.target.value);
              setIsDirty(true);
              setIsSaved(false);
            }}
          >
            <option value="1 week">1 week</option>
            <option value="2 weeks">2 weeks</option>
            <option value="4 weeks">4 weeks</option>
            <option value="6 weeks">6 weeks</option>
            <option value="3 months">3 months</option>
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Custom Follow-up Date
          <input
            className={`${fieldClass} mt-1`}
            type="date"
            value={date}
            onChange={(e) => {
              onDateChange(e.target.value);
              setIsDirty(true);
              setIsSaved(false);
            }}
          />
        </label>
      </div>
      <label className="mt-3 block text-sm text-slate-700">
        Follow-up Notes
        <textarea
          className={`${fieldClass} mt-1 min-h-20`}
          value={notes}
          onChange={(e) => {
            onNotesChange(e.target.value);
            setIsDirty(true);
            setIsSaved(false);
          }}
          placeholder="Monitoring focus, warning signs, and escalation guidance"
        />
      </label>
      <div className="mt-4">
        <button
          type="button"
          onClick={async () => {
            setIsSaving(true);
            await onSave();
            setIsSaving(false);
            setIsSaved(true);
            setIsDirty(false);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
          }}
          disabled={isSaving || Boolean(saving) || (isSaved && !isDirty)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {isSaving || saving ? "Saving..." : isSaved && !isDirty ? "Saved" : "Save"}
        </button>
        {isSaved ? (
          <button
            type="button"
            onClick={() => {
              setIsSaved(false);
              setIsDirty(true);
            }}
            className="ml-2 rounded-xl border border-blue-200 bg-white/90 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
          >
            Modify
          </button>
        ) : null}
      </div>
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          Saved successfully
        </div>
      )}
    </section>
  );
}
