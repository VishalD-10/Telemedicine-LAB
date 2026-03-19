"use client";

type PrescriptionRow = {
  id: string;
  medication: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
};

type PrescriptionViewerProps = {
  rows: PrescriptionRow[];
};

export default function PrescriptionViewer({ rows }: PrescriptionViewerProps) {
  return (
    <section className="rounded-2xl border border-white/40 bg-gradient-to-br from-white/70 to-blue-100/40 p-5 shadow-md backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]">
      <h3 className="text-base font-semibold text-slate-800">Prescribed Pharmacological Regimen</h3>
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="rounded-xl bg-white/70 px-3 py-3 text-sm text-slate-500">
                  No prescription entries.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-white/60">
                  <td className="px-2 py-3">{row.medication || "-"}</td>
                  <td className="px-2 py-3">{row.dosage || "-"}</td>
                  <td className="px-2 py-3">{row.frequency || "-"}</td>
                  <td className="px-2 py-3">{row.duration || "-"}</td>
                  <td className="px-2 py-3">{row.instructions || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
