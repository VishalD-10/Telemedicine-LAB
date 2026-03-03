"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type CaseSummary = {
  id?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
  rural_diagnosis_report?: string | null;
  specialist_diagnosis_report?: string | null;
  follow_up_notes?: string | null;
  ct_scan_required?: boolean | null;
  bronchoscopy_required?: boolean | null;
  report_pdf_path?: string | null;
  status?: string | null;
};

export default function PatientDashboardPage() {
  const router = useRouter();
  const [patientName, setPatientName] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [caseSummary, setCaseSummary] = useState<CaseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const storedPatientId = typeof window !== "undefined" ? localStorage.getItem("patient_id") : null;
      if (!storedPatientId) {
        router.push("/patient-login");
        return;
      }
      setPatientId(storedPatientId);

      const { data: caseRows } = await supabase
        .from("cases")
        .select(
          "id, created_at, reviewed_at, rural_diagnosis_report, specialist_diagnosis_report, follow_up_notes, ct_scan_required, bronchoscopy_required, report_pdf_path, status"
        )
        .eq("patient_id", storedPatientId)
        .eq("status", "finalized")
        .order("reviewed_at", { ascending: false });
      const caseRow = (caseRows ?? [])[0] as CaseSummary | undefined;
      setCaseSummary(caseRow ?? null);
    };
    load();
  }, [router]);

  const handleDownload = async () => {
    if (!caseSummary?.report_pdf_path || !caseSummary?.id) return;
    const storedPatientId =
      patientId ?? (typeof window !== "undefined" ? localStorage.getItem("patient_id") : null);
    if (!storedPatientId) {
      router.push("/patient-login");
      return;
    }
    setDownloading(true);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/download-report/${caseSummary.id}`,
      {
        method: "GET",
        headers: { "x-patient-id": storedPatientId },
      }
    );
    setDownloading(false);
    if (!response.ok) {
      setError("Unable to download report.");
      return;
    }
    const result = (await response.json()) as { signed_url?: string };
    if (!result.signed_url) {
      setError("Unable to download report.");
      return;
    }
    window.open(result.signed_url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Welcome to Tele-Pulmonology</h1>
        <p className="mt-1 text-slate-300">Hello {patientName ?? "Patient"}</p>
      </header>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <aside className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Visit Details</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <div>
              <span className="text-slate-400">Date Visited:</span>{" "}
              {caseSummary?.created_at ? new Date(caseSummary.created_at).toLocaleDateString() : "-"}
            </div>
            <div>
              <span className="text-slate-400">Reviewed By:</span> Specialist
            </div>
          </div>
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:col-span-1">
          <h2 className="text-sm font-semibold text-slate-200">Specialist Diagnosis Message</h2>
          <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">
            {caseSummary?.specialist_diagnosis_report ?? "-"}
          </p>
          <h3 className="mt-4 text-sm font-semibold text-slate-200">Follow-up Message</h3>
          <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">
            {caseSummary?.follow_up_notes ?? "-"}
          </p>
        </section>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-center">
          <button
            type="button"
            onClick={handleDownload}
            disabled={caseSummary?.status !== "finalized" || !caseSummary?.report_pdf_path || downloading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-600 disabled:opacity-50"
          >
            {downloading ? "Downloading..." : "Download Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
