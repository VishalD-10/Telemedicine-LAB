"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import PulmoAIChat from "@/components/patient/PulmoAIChat";
import { supabase } from "@/lib/supabaseClient";

type CaseSummary = {
  id?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
  rural_diagnosis_report?: string | null;
  specialist_diagnosis_report?: string | null;
  follow_up_notes?: string | null;
  report_pdf_path?: string | null;
  status?: string | null;
  specialist_id?: string | null;
};

type PatientRow = {
  name?: string | null;
  generated_patient_id?: string | null;
  age?: number | null;
  gender?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  smoking_history?: string | null;
};

type VitalsRow = {
  spo2?: number | null;
  respiratory_rate?: number | null;
  created_at?: string | null;
};

type SpirometryRow = {
  fvc?: number | null;
  fev1?: number | null;
  fev1_fvc?: number | null;
  fev1_fev6?: number | null;
  pef?: number | null;
  created_at?: string | null;
};

export default function PatientDashboardUI() {
  const router = useRouter();
  const [viewState, setViewState] = useState<"dashboard" | "caseDetails" | "pastCases">("dashboard");

  const [patientId, setPatientId] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [caseList, setCaseList] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [specialistName, setSpecialistName] = useState<string>("Pending");
  const [vitalsData, setVitalsData] = useState<VitalsRow[]>([]);
  const [spirometryData, setSpirometryData] = useState<SpirometryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const load = async () => {
      setError(null);
      const storedPatientId = typeof window !== "undefined" ? localStorage.getItem("patient_id") : null;
      if (!storedPatientId) {
        router.replace("/patient-login");
        return;
      }

      setPatientId(storedPatientId);

      const { data: patientRow } = await supabase
        .from("patients")
        .select("name, generated_patient_id, age, gender, height_cm, weight_kg, smoking_history")
        .eq("id", storedPatientId)
        .maybeSingle();
      setPatient((patientRow as PatientRow) ?? null);

      const { data: caseRows, error: caseError } = await supabase
        .from("cases")
        .select(
          "id, created_at, reviewed_at, rural_diagnosis_report, specialist_diagnosis_report, follow_up_notes, report_pdf_path, status, specialist_id"
        )
        .eq("patient_id", storedPatientId)
        .eq("status", "finalized")
        .order("reviewed_at", { ascending: false });

      if (caseError) {
        setError("Unable to load patient report.");
        return;
      }

      const rows = (caseRows ?? []) as CaseSummary[];
      setCaseList(rows);
      setSelectedCaseId((current) => {
        if (current && rows.some((r) => r.id === current)) return current;
        return rows[0]?.id ?? null;
      });

      const { data: vitalsRows } = await supabase
        .from("vitals")
        .select("spo2, respiratory_rate, created_at")
        .eq("patient_id", storedPatientId)
        .order("created_at", { ascending: false });
      setVitalsData((vitalsRows ?? []) as VitalsRow[]);

      const { data: spirometryRows } = await supabase
        .from("spirometry")
        .select("fvc, fev1, fev1_fvc, fev1_fev6, pef, created_at")
        .eq("patient_id", storedPatientId)
        .order("created_at", { ascending: false });
      setSpirometryData((spirometryRows ?? []) as SpirometryRow[]);
    };

    load();
  }, [router]);

  const selectedCase = useMemo(
    () => caseList.find((c) => c.id === selectedCaseId) ?? caseList[0] ?? null,
    [caseList, selectedCaseId]
  );

  useEffect(() => {
    const loadSpecialistName = async () => {
      if (!selectedCase?.specialist_id) {
        setSpecialistName("Pending");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", selectedCase.specialist_id)
        .limit(1);

      const fullName = (data?.[0] as { full_name?: string | null } | undefined)?.full_name;
      setSpecialistName(fullName ? `Dr. ${fullName}` : "Pending");
    };

    loadSpecialistName();
  }, [selectedCase?.specialist_id]);

  const caseData = useMemo(
    () => ({
      ...(selectedCase ?? {}),
      name: patient?.name ?? "",
      generated_patient_id: patient?.generated_patient_id ?? "",
      vitals: vitalsData,
      spirometry: spirometryData,
      specialist_diagnosis:
        selectedCase?.specialist_diagnosis_report ?? selectedCase?.rural_diagnosis_report ?? "",
    }),
    [patient?.generated_patient_id, selectedCase, spirometryData, vitalsData]
  );
  const vitals = caseData?.vitals?.[0] ?? {};
  const spirometry = caseData?.spirometry?.[0] ?? {};

  const reportSummary = useMemo(
    () =>
      `Patient ID: ${caseData?.generated_patient_id || ""}

Vitals:
SpO2: ${vitals?.spo2 || ""}
Respiratory Rate: ${vitals?.respiratory_rate || ""}

Spirometry:
FVC: ${spirometry?.fvc || ""}
FEV1: ${spirometry?.fev1 || ""}
FEV1/FVC: ${spirometry?.fev1_fvc || ""}
PEF: ${spirometry?.pef || ""}

Specialist Diagnosis:
${caseData?.specialist_diagnosis || ""}`,
    [caseData, spirometry, vitals]
  );

  const autoReportScript = useMemo(() => {
    const sanitizedReport = reportSummary.replace(/`/g, "");
    const message = `Patient Report:\n${sanitizedReport}\n\nExplain this lung report to the patient in simple terms.`;
    return `setTimeout(function() {
  if (window.Chatling && typeof window.Chatling.sendMessage === "function") {
    window.Chatling.sendMessage(${JSON.stringify(message)});
  }
}, 4000);`;
  }, [reportSummary]);

  const hasPatientContext = useMemo(
    () => Boolean(caseData?.generated_patient_id),
    [caseData]
  );

  const handleDownload = async () => {
    if (!selectedCase?.report_pdf_path || !selectedCase?.id) return;
    const storedPatientId =
      patientId ?? (typeof window !== "undefined" ? localStorage.getItem("patient_id") : null);
    if (!storedPatientId) {
      router.replace("/patient-login");
      return;
    }

    setDownloading(true);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/download-report/${selectedCase.id}`,
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
    if ((window as any).Chatling) {
      (window as any).Chatling.destroy();
    }
    router.replace("/login");
  };

  if (!ready) {
    return <div className="p-6 text-gray-600">Loading dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-blue-50 flex">
      <div className="flex-1 p-8 md:p-10 overflow-x-hidden">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl shadow-md p-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">Patient Dashboard</h1>
              <p className="mt-1 text-gray-600">Hello {patient?.name ?? "Patient"}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setViewState("dashboard")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  viewState === "dashboard" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border border-gray-200"
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setViewState("pastCases")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  viewState === "pastCases" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border border-gray-200"
                }`}
              >
                Your History
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400"
              >
                Logout
              </button>
            </div>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          {viewState === "dashboard" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="bg-white rounded-2xl shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-800">Patient Case Summary</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs text-gray-600">Patient ID</p>
                    <p className="mt-1 text-sm font-medium text-gray-800">{patient?.generated_patient_id ?? "-"}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs text-gray-600">Case Status</p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        selectedCase?.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : selectedCase?.status === "accepted"
                          ? "bg-blue-100 text-blue-700"
                          : selectedCase?.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : selectedCase?.status === "finalized"
                          ? "bg-emerald-200 text-emerald-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {selectedCase?.status ?? "N/A"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs text-gray-600">Specialist Assigned</p>
                    <p className="mt-1 text-sm font-medium text-gray-800">{specialistName}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs text-gray-600">Last Update</p>
                    <p className="mt-1 text-sm font-medium text-gray-800">
                      {selectedCase?.reviewed_at
                        ? new Date(selectedCase.reviewed_at).toLocaleString()
                        : selectedCase?.created_at
                        ? new Date(selectedCase.created_at).toLocaleString()
                        : "-"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-2xl shadow-md p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-800">Your History</h2>
                  <button
                    type="button"
                    onClick={() => setViewState("pastCases")}
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    View all
                  </button>
                </div>

                {caseList.length === 0 ? (
                  <p className="text-sm text-gray-600">No past consultations available.</p>
                ) : (
                  <div className="space-y-3">
                    {caseList.slice(0, 4).map((caseItem, index) => (
                      <div
                        key={caseItem.id ?? `case-${index}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"
                      >
                        <div>
                          <p className="text-xs text-gray-600">Patient ID</p>
                          <p className="text-sm font-medium text-gray-800">{patient?.generated_patient_id ?? "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Date</p>
                          <p className="text-sm text-gray-800">
                            {caseItem.created_at ? new Date(caseItem.created_at).toLocaleDateString() : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Status</p>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              caseItem.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : caseItem.status === "accepted"
                                ? "bg-blue-100 text-blue-700"
                                : caseItem.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : caseItem.status === "finalized"
                                ? "bg-emerald-200 text-emerald-800"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {caseItem.status ?? "N/A"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCaseId(caseItem.id ?? null);
                            setViewState("caseDetails");
                          }}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                        >
                          View Details
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {viewState === "pastCases" && (
            <section className="bg-white rounded-2xl shadow-md p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800">Your History</h2>
                <button
                  type="button"
                  onClick={() => setViewState("dashboard")}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-blue-50"
                >
                  Back to Dashboard
                </button>
              </div>

              {caseList.length === 0 ? (
                <p className="py-10 text-center text-gray-600">No past consultations available.</p>
              ) : (
                <div className="space-y-3">
                  {caseList.map((caseItem, index) => (
                    <div
                      key={caseItem.id ?? `past-${index}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"
                    >
                      <div>
                        <p className="text-xs text-gray-600">Patient ID</p>
                        <p className="text-sm font-medium text-gray-800">{patient?.generated_patient_id ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Date</p>
                        <p className="text-sm text-gray-800">
                          {caseItem.created_at ? new Date(caseItem.created_at).toLocaleDateString() : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Status</p>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            caseItem.status === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : caseItem.status === "accepted"
                              ? "bg-blue-100 text-blue-700"
                              : caseItem.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : caseItem.status === "finalized"
                              ? "bg-emerald-200 text-emerald-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {caseItem.status ?? "N/A"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCaseId(caseItem.id ?? null);
                          setViewState("caseDetails");
                        }}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                      >
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {viewState === "caseDetails" && (
            <section className="bg-white rounded-2xl shadow-md p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800">Case Details</h2>
                <button
                  type="button"
                  onClick={() => setViewState("pastCases")}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-blue-50"
                >
                  Back to Your History
                </button>
              </div>

              {!selectedCase ? (
                <p className="text-gray-600">No case selected.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2">
                    <h3 className="text-sm font-semibold text-gray-800">Patient Information</h3>
                    <div className="mt-2 grid gap-2 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-3">
                      <p>Name: {patient?.name ?? "-"}</p>
                      <p>Patient ID: {patient?.generated_patient_id ?? "-"}</p>
                      <p>Age: {patient?.age ?? "-"}</p>
                      <p>Gender: {patient?.gender ?? "-"}</p>
                      <p>Height: {patient?.height_cm ?? "-"} cm</p>
                      <p>Weight: {patient?.weight_kg ?? "-"} kg</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-gray-800">Vitals</h3>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>SpO2: {vitals?.spo2 ?? "--"}</p>
                      <p>Respiratory Rate: {vitals?.respiratory_rate ?? "--"} breaths/min</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-gray-800">Spirometry</h3>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>FVC: {spirometry?.fvc ?? "--"} L</p>
                      <p>FEV1: {spirometry?.fev1 ?? "--"} L</p>
                      <p>FEV1/FVC: {spirometry?.fev1_fvc ?? "--"} %</p>
                      <p>FEV1/FEV6: {spirometry?.fev1_fev6 ?? "--"} %</p>
                      <p>PEF: {spirometry?.pef ?? "--"} L/min</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2">
                    <h3 className="text-sm font-semibold text-gray-800">Rural Diagnosis</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                      {selectedCase.rural_diagnosis_report ?? "-"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2">
                    <h3 className="text-sm font-semibold text-gray-800">Specialist Diagnosis</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                      {selectedCase.specialist_diagnosis_report ?? "-"}
                    </p>
                  </div>

                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={selectedCase.status !== "finalized" || !selectedCase.report_pdf_path || downloading}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {downloading ? "Downloading..." : "Download Report"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500 mt-4">
              PulmoAI provides educational information only. Diagnosis and treatment decisions must be made by your
              doctor.
            </p>
          </div>
        </div>
      </div>

      {hasPatientContext && (
        <>
          <PulmoAIChat patientId={caseData.generated_patient_id} />
          <Script id="pulmoai-auto-report" strategy="afterInteractive">
            {autoReportScript}
          </Script>
        </>
      )}
    </div>
  );
}
