"use client";

type PrescriptionItem = {
  id: string;
  medication_name: string | null;
  dosage: string | null;
  frequency: string | null;
  duration_days: string | null;
  instructions: string | null;
};

type PrescriptionSummaryProps = {
  items: PrescriptionItem[];
};

export default function PrescriptionSummary({ items }: PrescriptionSummaryProps) {
  return (
    <section className="glass-panel p-6 w-full flex flex-col h-full hover:-translate-y-1 transition-transform duration-300">
      <h3 className="medical-caption text-purple-700 mb-4">Prescribed Pharmacological Regimen</h3>
      {items.length === 0 ? (
        <div className="rounded-xl bg-white/85 border border-slate-200 p-6 text-center">
          <p className="text-sm font-medium text-slate-600 italic">No prescription entries attached.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white/85 border border-slate-200 overflow-hidden shadow-inner">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm text-slate-700">
              <thead className="bg-slate-100 text-[10px] uppercase tracking-widest text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Medicine</th>
                  <th className="px-4 py-3">Dosage</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.medication_name || "-"}</td>
                    <td className="px-4 py-3">{item.dosage || "-"}</td>
                    <td className="px-4 py-3">{item.frequency || "-"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.duration_days || "-"}</td>
                    <td className="px-4 py-3">{item.instructions || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
