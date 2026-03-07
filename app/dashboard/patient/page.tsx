"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();
  const [viewState, setViewState] = useState("list");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentView = params.get("view") || "list";

    if (currentView === viewState) return;

    const next = new URLSearchParams(params);

    if (viewState === "list") {
      next.delete("view");
      next.delete("caseId");
      next.delete("requestId");
    } else {
      next.set("view", viewState);
    }

    const url =
      next.toString().length > 0
        ? `${window.location.pathname}?${next.toString()}`
        : window.location.pathname;

    router.replace(url);
  }, [router, viewState]);
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view") || "list";
      setViewState(view);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const view = searchParams.get("view");

    if (!view) {
      setViewState("list");
      return;
    }

    setViewState(view);
  }, [searchParams]);

  const [patientName, setPatientName] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [caseSummary, setCaseSummary] = useState<CaseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [ready, setReady] = useState(false);
  const [baseDataReady, setBaseDataReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!baseDataReady) return;
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const caseId = params.get("caseId");
    if (view === "report" && caseId) {
      setReady(true);
      return;
    }
    setReady(true);
  }, [baseDataReady]);

  useEffect(() => {
    const load = async () => {
      setBaseDataReady(false);
      const view = viewState;
      const caseId = searchParams.get("caseId");
      const storedPatientId = typeof window !== "undefined" ? localStorage.getItem("patient_id") : null;
      if (!storedPatientId) {
        router.push("/patient-login");
        return;
      }
      setPatientId(storedPatientId);
      const { data: patientRow } = await supabase
        .from("patients")
        .select("name")
        .eq("id", storedPatientId)
        .maybeSingle();

      if (patientRow?.name) {
        setPatientName(patientRow.name);
      }

      let caseRows:
        | {
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
          }[]
        | null = null;
      let caseError: { message?: string } | null = null;

      if (view === "report" && caseId) {
        const { data, error } = await supabase
          .from("cases")
          .select(
            "id, created_at, reviewed_at, rural_diagnosis_report, specialist_diagnosis_report, follow_up_notes, ct_scan_required, bronchoscopy_required, report_pdf_path, status"
          )
          .eq("id", caseId)
          .eq("patient_id", storedPatientId)
          .eq("status", "finalized")
          .limit(1);
        caseRows = data as CaseSummary[] | null;
        caseError = error as { message?: string } | null;
      } else {
        const { data, error } = await supabase
          .from("cases")
          .select(
            "id, created_at, reviewed_at, rural_diagnosis_report, specialist_diagnosis_report, follow_up_notes, ct_scan_required, bronchoscopy_required, report_pdf_path, status"
          )
          .eq("patient_id", storedPatientId)
          .eq("status", "finalized")
          .order("reviewed_at", { ascending: false });
        caseRows = data as CaseSummary[] | null;
        caseError = error as { message?: string } | null;
      }
      if (caseError) {
        setError("Unable to load patient report.");
        setBaseDataReady(true);
        return;
      }
      const caseRow = (caseRows ?? [])[0] as CaseSummary | undefined;
      setCaseSummary(caseRow ?? null);
      setBaseDataReady(true);
    };
    load();
  }, [router, searchParams, viewState]);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/patient-login");
  };

  if (!ready) {
    return (
      <div className="p-6 text-slate-400">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 p-6">
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800"
      >
        Logout
      </button>
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
