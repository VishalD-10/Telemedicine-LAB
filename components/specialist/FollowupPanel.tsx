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
  onSave: () => Promise<{ error?: string } | void>;
};

const shellClass =
  "glass-panel p-6 relative overflow-hidden transition-all duration-300 max-w-full";

const fieldClass =
  "glass-input w-full";

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
      <h3 className="medical-caption text-blue-400 mb-4">Follow-up Scheduling</h3>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <label className="text-sm text-slate-300 block">
          Suggested Interval
          <select
            className={`${fieldClass} mt-2 text-slate-800`}
            value={interval}
            onChange={(e) => {
              onIntervalChange(e.target.value);
              setIsDirty(true);
              setIsSaved(false);
            }}
          >
            <option value="1 week" className="text-black">1 week</option>
            <option value="2 weeks" className="text-black">2 weeks</option>
            <option value="4 weeks" className="text-black">4 weeks</option>
            <option value="6 weeks" className="text-black">6 weeks</option>
            <option value="3 months" className="text-black">3 months</option>
          </select>
        </label>
        <label className="text-sm text-slate-300 block">
          Custom Follow-up Date
          <input
            className={`${fieldClass} mt-2 [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]`}
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
      <label className="mt-5 block text-sm text-slate-300">
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
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={async () => {
            setIsSaving(true);
            const result = await onSave();
            setIsSaving(false);
            const suc = (result as { success?: boolean } | null | undefined)?.success;
            if (suc) {
              setIsSaved(true);
              setIsDirty(false);
              setShowToast(true);
              setTimeout(() => setShowToast(false), 5500);
            }
          }}
          disabled={isSaving || Boolean(saving) || (isSaved && !isDirty)}
          className="glass-btn-primary flex-1 max-w-[200px]"
        >
          {isSaving || saving ? "Saving..." : isSaved && !isDirty ? "Schedule Follow-up" : "Schedule Follow-up"}
        </button>
        {isSaved ? (
          <button
            type="button"
            onClick={() => { setIsSaved(false); setIsDirty(true); }}
            className="glass-btn-secondary"
          >
            Modify
          </button>
        ) : null}
      </div>

      {showToast && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl bg-green-600 shadow-xl text-white text-sm font-medium transition-all animate-in slide-in-from-top-2 fade-in-0 duration-300">
          ✅ Follow-up saved successfully
        </div>
      )}
    </section>
  );
}
