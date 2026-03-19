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
    <section className="rounded-2xl border border-white/50 bg-gradient-to-br from-white/80 to-blue-100/50 p-5 shadow-md backdrop-blur-xl transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-2 hover:-translate-y-1 hover:shadow-lg">
      <h3 className="text-lg font-semibold text-slate-800">Prescribed Pharmacological Regimen</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No prescription entries.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm text-slate-700">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2">Medicine</th>
                <th className="pb-2">Dosage</th>
                <th className="pb-2">Frequency</th>
                <th className="pb-2">Duration</th>
                <th className="pb-2">Instructions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-white/60">
                  <td className="px-2 py-3">{item.medication_name || "-"}</td>
                  <td className="px-2 py-3">{item.dosage || "-"}</td>
                  <td className="px-2 py-3">{item.frequency || "-"}</td>
                  <td className="px-2 py-3">{item.duration_days || "-"}</td>
                  <td className="px-2 py-3">{item.instructions || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
