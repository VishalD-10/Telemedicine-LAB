"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import PulmoAIChat from "@/components/patient/PulmoAIChat";
import DiagnosisSummary from "@/components/patient/DiagnosisSummary";
import TreatmentSummary from "@/components/patient/TreatmentSummary";
import PrescriptionSummary from "@/components/patient/PrescriptionSummary";
import FollowupReminder from "@/components/patient/FollowupReminder";
import CaseTimeline from "@/components/shared/CaseTimeline";
import { supabase } from "@/lib/supabaseClient";

type CaseSummary = {
  id?: string | null;
  created_at?: string | null;
  assigned_at?: string | null;
  reviewed_at?: string | null;
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
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  temperature_f?: number | null;
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

type DiagnosisDetail = {
  diagnosisName: string | null;
  severity: string | null;
  clinicalNotes: string | null;
  createdAt: string | null;
};

type TreatmentDetail = {
  medications: string | null;
  treatmentTitle: string | null;
  lifestyleAdvice: string | null;
  pulmonaryRehab: string | null;
  referralRecommendation: string | null;
  createdAt: string | null;
};

type PrescriptionDetail = {
  id: string;
  medication_name: string | null;
  dosage: string | null;
  frequency: string | null;
  duration_days: string | null;
  instructions: string | null;
};

type FollowupDetail = {
  nextVisitDate: string | null;
  notes: string | null;
  diagnosticProcedures: string[];
  createdAt: string | null;
};

type SpecialistRequestDetail = {
  acceptedAt: string | null;
  completedAt: string | null;
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
  const [diagnosisDetail, setDiagnosisDetail] = useState<DiagnosisDetail | null>(null);
  const [treatmentDetail, setTreatmentDetail] = useState<TreatmentDetail | null>(null);
  const [prescriptionDetails, setPrescriptionDetails] = useState<PrescriptionDetail[]>([]);
  const [followupDetail, setFollowupDetail] = useState<FollowupDetail | null>(null);
  const [specialistRequestDetail, setSpecialistRequestDetail] = useState<SpecialistRequestDetail | null>(null);
  const [clinicalPanelsLoading, setClinicalPanelsLoading] = useState(false);

  const loadDashboard = async () => {
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
      .select(`
          id,
          created_at,
          assigned_at,
          reviewed_at,
          status,
          specialist_id
        `)
      .eq("patient_id", storedPatientId)
      .order("created_at", { ascending: false });

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
      .select(`
          spo2,
          respiratory_rate,
          systolic_bp,
          diastolic_bp,
          temperature_f,
          created_at
        `)
      .eq("patient_id", storedPatientId)
      .order("created_at", { ascending: false })
      .limit(1);
    setVitalsData(vitalsRows ? [(vitalsRows[0] as VitalsRow)] : []);

    const { data: spirometryRows } = await supabase
      .from("spirometry")
      .select("fvc, fev1, fev1_fvc, fev1_fev6, pef, created_at")
      .eq("patient_id", storedPatientId)
      .order("created_at", { ascending: false })
      .limit(1);
    setSpirometryData((spirometryRows ?? []) as SpirometryRow[]);
  };

  useEffect(() => {
    loadDashboard();
  }, [router]);

  const selectedCase = useMemo(
    () => caseList.find((c) => c.id === selectedCaseId) ?? caseList[0] ?? null,
    [caseList, selectedCaseId]
  );
  const selectedVitals = vitalsData[0] ?? null;
  const selectedSpirometry = spirometryData[0] ?? null;

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
        .maybeSingle();

      const fullName = data?.full_name ?? null;
      setSpecialistName(fullName ? `Dr. ${fullName}` : "Pending");
    };

    loadSpecialistName();
  }, [selectedCase?.specialist_id]);

  const loadClinicalPanels = async (caseId: string) => {
    setClinicalPanelsLoading(true);
    const [diagRes, treatmentRes, rxRes, followupRes, requestRes] = await Promise.all([
      supabase.from("case_diagnoses").select("*").eq("case_id", caseId).order("created_at", { ascending: false }).limit(1),
      supabase
        .from("case_treatment_plans")
        .select(`
            id,
            medications,
            pulmonary_rehabilitation,
            lifestyle_recommendations,
            referral_recommendation,
            created_at
          `)
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.from("prescriptions").select("*").eq("case_id", caseId).order("created_at", { ascending: true }),
      supabase.from("followups").select("scheduled_date, notes, diagnostic_procedures, created_at").eq("case_id", caseId).maybeSingle(),
      supabase.from("specialist_requests").select("accepted_at, completed_at").eq("case_id", caseId).order("created_at", { ascending: false }).limit(1),
    ]);
    setClinicalPanelsLoading(false);

    const diagnosisRow = (diagRes.data?.[0] ?? null) as Record<string, unknown> | null;
    const treatmentRow = (treatmentRes.data?.[0] ?? null) as Record<string, unknown> | null;
    const followupRow = (followupRes.data ?? null) as Record<string, unknown> | null;
    const prescriptionRows = (rxRes.data ?? []) as Record<string, unknown>[];
    const specialistRequestRow = (requestRes.data?.[0] ?? null) as Record<string, unknown> | null;

    let treatmentTitle: string | null = null;
    if (diagnosisRow?.diagnosis_id) {
      const { data: treatmentTemplate } = await supabase
        .from("treatment_plan_templates")
        .select("treatment_title")
        .eq("diagnosis_id", diagnosisRow.diagnosis_id as string | number)
        .maybeSingle();
      treatmentTitle = (treatmentTemplate?.treatment_title as string | undefined) ?? null;
    }

    setDiagnosisDetail(
      diagnosisRow
        ? {
            diagnosisName: (diagnosisRow.diagnosis_name as string | undefined) ?? null,
            severity: (diagnosisRow.severity as string | undefined) ?? null,
            clinicalNotes: (diagnosisRow.specialist_notes as string | undefined) ?? null,
            createdAt: (diagnosisRow.created_at as string | undefined) ?? null,
          }
        : null
    );

    setTreatmentDetail(
      treatmentRow
        ? {
            medications: (treatmentRow.medications as string | undefined) ?? null,
            treatmentTitle,
            lifestyleAdvice: (treatmentRow.lifestyle_recommendations as string | undefined) ?? null,
            pulmonaryRehab: (treatmentRow.pulmonary_rehabilitation as string | undefined) ?? null,
            referralRecommendation: (treatmentRow.referral_recommendation as string | undefined) ?? null,
            createdAt: (treatmentRow.created_at as string | undefined) ?? null,
          }
        : null
    );

    setPrescriptionDetails(
      prescriptionRows.map((row, index) => ({
        id: String((row.id as string | number | undefined) ?? `rx-${index}`),
        medication_name: String((row.medication_name as string | number | undefined) ?? "") || null,
        dosage: String((row.dosage as string | number | undefined) ?? "") || null,
        frequency: String((row.frequency as string | number | undefined) ?? "") || null,
        duration_days: String((row.duration_days as string | number | undefined) ?? "") || null,
        instructions: String((row.instructions as string | number | undefined) ?? "") || null,
      }))
    );

    setFollowupDetail(
      followupRow
        ? {
            nextVisitDate: (followupRow.scheduled_date as string | undefined) ?? null,
            notes: (followupRow.notes as string | undefined) ?? null,
            diagnosticProcedures: (followupRow.diagnostic_procedures as string[] | undefined) ?? [],
            createdAt: (followupRow.created_at as string | undefined) ?? null,
          }
        : null
    );

    setSpecialistRequestDetail(
      specialistRequestRow
        ? {
            acceptedAt: (specialistRequestRow.accepted_at as string | undefined) ?? null,
            completedAt: (specialistRequestRow.completed_at as string | undefined) ?? null,
          }
        : null
    );
  };

  useEffect(() => {
    if (!selectedCase?.id) {
      setDiagnosisDetail(null);
      setTreatmentDetail(null);
      setPrescriptionDetails([]);
      setFollowupDetail(null);
      setSpecialistRequestDetail(null);
      return;
    }
    loadClinicalPanels(selectedCase.id);
  }, [selectedCase?.id]);

  useEffect(() => {
    const channel = supabase
      .channel("case-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases" },
        () => {
          loadDashboard();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_diagnoses" },
        () => {
          if (selectedCase?.id) loadClinicalPanels(selectedCase.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_treatment_plans" },
        () => {
          if (selectedCase?.id) loadClinicalPanels(selectedCase.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prescriptions" },
        () => {
          if (selectedCase?.id) loadClinicalPanels(selectedCase.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "followups" },
        () => {
          if (selectedCase?.id) loadClinicalPanels(selectedCase.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCase?.id]);

  const caseData = useMemo(
    () => ({
      ...(selectedCase ?? {}),
      name: patient?.name ?? "",
      generated_patient_id: patient?.generated_patient_id ?? "",
      specialist_diagnosis: diagnosisDetail?.diagnosisName ?? "",
    }),
    [diagnosisDetail?.diagnosisName, patient?.generated_patient_id, selectedCase]
  );

  const reportSummary = useMemo(
    () =>
      `Patient ID: ${caseData?.generated_patient_id || ""}

Vitals:
BP: ${selectedVitals?.systolic_bp || ""} / ${selectedVitals?.diastolic_bp || ""}
Temperature: ${selectedVitals?.temperature_f || ""}
SpO2: ${selectedVitals?.spo2 || ""}
Respiratory Rate: ${selectedVitals?.respiratory_rate || ""}

Spirometry:
FVC: ${selectedSpirometry?.fvc || ""}
FEV1: ${selectedSpirometry?.fev1 || ""}
FEV1/FVC: ${selectedSpirometry?.fev1_fvc || ""}
PEF: ${selectedSpirometry?.pef || ""}

Specialist Diagnosis:
${caseData?.specialist_diagnosis || ""}`,
    [caseData, selectedSpirometry, selectedVitals]
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

  const diagnosisExplanation = useMemo(() => {
    const diagnosis = diagnosisDetail?.diagnosisName?.trim();
    if (!diagnosis) return "Your doctor reviewed your reports and shared this diagnosis for your care plan.";
    return `Your doctor says your condition is "${diagnosis}". This helps guide your medicines and next check-up plan.`;
  }, [diagnosisDetail?.diagnosisName]);

  const handleDownload = async () => {
    if (!selectedCase?.id) return;
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

  return (
    <div className="min-h-screen will-change-auto scroll-smooth bg-gradient-to-br from-blue-100 via-white to-blue-50 flex">
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
                          : selectedCase?.status === "reviewing"
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
                              : caseItem.status === "reviewing"
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
                      <p>
                        Blood Pressure:{" "}
                        {selectedVitals?.systolic_bp !== null && selectedVitals?.diastolic_bp !== null
                          ? `${selectedVitals.systolic_bp} / ${selectedVitals.diastolic_bp} mmHg`
                          : "-"}
                      </p>
                      <p>
                        Temperature:{" "}
                        {selectedVitals?.temperature_f !== null ? `${selectedVitals.temperature_f} °F` : "-"}
                      </p>
                      <p>SpO2: {selectedVitals?.spo2 ?? "-"}</p>
                      <p>Respiratory Rate: {selectedVitals?.respiratory_rate ?? "-"} breaths/min</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-gray-800">Spirometry</h3>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>FVC: {selectedSpirometry?.fvc ?? "-"} L</p>
                      <p>FEV1: {selectedSpirometry?.fev1 ?? "-"} L</p>
                      <p>FEV1/FVC: {selectedSpirometry?.fev1_fvc ?? "-"} %</p>
                      <p>FEV1/FEV6: {selectedSpirometry?.fev1_fev6 ?? "-"} %</p>
                      <p>PEF: {selectedSpirometry?.pef ?? "-"} L/min</p>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={downloading}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {downloading ? "Downloading..." : "Download Report"}
                    </button>
                  </div>

                  {clinicalPanelsLoading ? (
                    <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                      <div className="h-44 animate-pulse rounded-2xl bg-blue-100/60" />
                      <div className="h-44 animate-pulse rounded-2xl bg-blue-100/60" />
                      <div className="h-44 animate-pulse rounded-2xl bg-blue-100/60 md:col-span-2" />
                    </div>
                  ) : (
                    <>
                      <div className="md:col-span-2">
                        <DiagnosisSummary
                          diagnosisName={diagnosisDetail?.diagnosisName ?? null}
                          severity={diagnosisDetail?.severity ?? null}
                          explanation={diagnosisDetail?.clinicalNotes ?? diagnosisExplanation}
                          doctorName={specialistName}
                          date={diagnosisDetail?.createdAt ?? selectedCase.reviewed_at ?? selectedCase.created_at ?? null}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <TreatmentSummary
                          treatmentTitle={treatmentDetail?.treatmentTitle ?? null}
                          medicationOverview={treatmentDetail?.medications ?? null}
                          lifestyleAdvice={treatmentDetail?.lifestyleAdvice ?? null}
                          rehabGuidance={treatmentDetail?.pulmonaryRehab ?? null}
                          referralRecommendation={treatmentDetail?.referralRecommendation ?? null}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <PrescriptionSummary items={prescriptionDetails} />
                      </div>

                      <div>
                        <FollowupReminder
                          nextVisitDate={followupDetail?.nextVisitDate ?? null}
                          followupNotes={followupDetail?.notes ?? null}
                          diagnosticProcedures={followupDetail?.diagnosticProcedures ?? []}
                        />
                      </div>

                      <div>
                        <CaseTimeline
                          caseId={selectedCase.id ?? null}
                          timestamps={{
                            caseCreated: selectedCase.created_at ?? null,
                            specialistAssigned: specialistRequestDetail?.acceptedAt ?? null,
                            diagnosisCompleted: diagnosisDetail?.createdAt ?? null,
                            treatmentGenerated: treatmentDetail?.createdAt ?? null,
                            followupScheduled: followupDetail?.createdAt ?? null,
                            caseFinalized:
                              selectedCase.status === "finalized"
                                ? followupDetail?.createdAt ?? specialistRequestDetail?.completedAt ?? null
                                : null,
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          <div className="rounded-2xl border border-white/50 bg-gradient-to-br from-white/85 to-blue-100/60 p-5 shadow-md backdrop-blur-xl transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-2 hover:-translate-y-1 hover:shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">Need help understanding your report?</h3>
            <p className="mt-2 text-sm text-slate-600">
              You can ask PulmoAI simple questions in the chat bubble. It explains your report in easy language.
            </p>
            <div className="mt-3 inline-flex animate-float-slow rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
              PulmoAI chat is active on this page
            </div>
            <p className="mt-3 text-sm text-gray-500">
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
