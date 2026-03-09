"use client";
export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useState } from "react";
import dynamicImport from "next/dynamic";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const DicomViewer = dynamicImport(() => import("@/app/components/DicomViewer"), { ssr: false });

interface SpecialistRequestRow {
  id: string;
  case_id: string;
  specialist_id: string;
  rural_message: string | null;
  rural_doctor_id?: string | null;
  created_at: string;
  accepted_at?: string | null;
  completed_at?: string | null;
  case_priority?: "emergency" | "normal";
  patient_id?: string;
  patient_name?: string | null;
  ruralDoctorName?: string;
  rural_doctor_name?: string | null;
  rural_doctor?: { full_name?: string | null } | null;
  profiles?: { full_name?: string | null } | null;
  generated_patient_id?: string | null;
  specialist_message?: string | null;
}

interface CaseReviewData {
  caseId: string;
  requestId: string;
  patientName: string | null;
  generatedPatientId: string | null;
  patientHistory: string | null;
  patientMeta: { age?: number | null; gender?: string | null; height_cm?: number | null; weight_kg?: number | null };
  vitals: { spo2?: number | null; respiratory_rate?: number | null; created_at?: string | null }[];
  spirometry: { fvc?: number | null; fev1?: number | null; fev1_fvc?: number | null; fev1_fev6?: number | null; pef?: number | null; created_at?: string | null }[];
  ruralDiagnosis: string | null;
  xrayPaths: string[];
}

export default function SpecialistDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState<"emergency" | "normal">("emergency");
  const [emergencyPending, setEmergencyPending] = useState<SpecialistRequestRow[]>([]);
  const [normalPending, setNormalPending] = useState<SpecialistRequestRow[]>([]);
  const [acceptedRequests, setAcceptedRequests] = useState<SpecialistRequestRow[]>([]);
  const [pastRequests, setPastRequests] = useState<SpecialistRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewState, setViewState] = useState<"list" | "accept" | "review" | "past">("list");

  const [ready, setReady] = useState(false);
  const [baseDataReady, setBaseDataReady] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SpecialistRequestRow | null>(null);
  const [acceptMessage, setAcceptMessage] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [reviewData, setReviewData] = useState<CaseReviewData | null>(null);
  const [furtherDiagnosisRequired, setFurtherDiagnosisRequired] = useState(false);
  const [specialistDiagnosisReport, setSpecialistDiagnosisReport] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showXrayModal, setShowXrayModal] = useState(false);
  const [xrayUrl, setXrayUrl] = useState<string | null>(null);
  const [xrayPath, setXrayPath] = useState<string | null>(null);
  const [viewingPastCaseId, setViewingPastCaseId] = useState<string | null>(null);
  const [furtherDiagnosisTypes, setFurtherDiagnosisTypes] = useState<{ ctScan: boolean; bronchoscopy: boolean }>({
    ctScan: false,
    bronchoscopy: false,
  });
  const [pastCaseDetail, setPastCaseDetail] = useState<{
    patientName: string | null;
    generatedPatientId: string | null;
    patientHistory: string | null;
    ruralDiagnosis: string | null;
    specialistDiagnosis: string | null;
    followUps: string | null;
    finalReport?: string | null;
    vitals?: { spo2?: number | null; respiratory_rate?: number | null; created_at?: string | null } | null;
    spirometry?: {
      fvc?: number | null;
      fev1?: number | null;
      fev1_fvc?: number | null;
      fev1_fev6?: number | null;
      pef?: number | null;
      created_at?: string | null;
    } | null;
    ctScanRequired?: boolean | null;
    bronchoscopyRequired?: boolean | null;
    xrayPaths: string[];
  } | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      setUserId(user.user.id);
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.user.id)
        .limit(1);
      const profile = data?.[0] as { full_name: string | null } | undefined;
      setProfile(profile ?? null);
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const loadPastCasesForSpecialist = async () => {
    if (!userId) return;
    const { data: pastCases } = await supabase
      .from("cases")
      .select("id, patient_id, priority, status")
      .eq("specialist_id", userId)
      .eq("status", "finalized");
    const results = await Promise.all(
      (pastCases ?? []).map(async (c) => {
        const patientId = (c as { patient_id?: string | null }).patient_id ?? "";
        const { data: patientRows } = await supabase
          .from("patients")
          .select("name, generated_patient_id, created_by")
          .eq("id", patientId)
          .limit(1);
        const patientRow = patientRows?.[0] as
          | ({ name?: string | null; created_by?: string | null } & Record<string, string | null>)
          | undefined;
        let ruralDoctorName: string | null = null;
        if (patientRow?.created_by) {
          const { data: profileRows } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", patientRow.created_by)
            .limit(1);
          ruralDoctorName = (profileRows?.[0] as { full_name?: string | null } | undefined)?.full_name ?? null;
        }
        return {
          id: (c as { id: string }).id,
          case_id: (c as { id: string }).id,
          specialist_id: userId,
          rural_message: null,
          created_at: "",
          case_priority: (c as { priority?: string }).priority === "emergency" ? "emergency" : "normal",
          patient_id: patientId || undefined,
          patient_name: patientRow?.name ?? null,
          ruralDoctorName: ruralDoctorName ?? "-",
          rural_doctor_name: ruralDoctorName,
          rural_doctor: { full_name: ruralDoctorName },
          generated_patient_id:
            (patientRow as { generated_patient_id?: string | null } | undefined)?.generated_patient_id ?? null,
        } as SpecialistRequestRow;
      })
    );
    setPastRequests(results);
  };

  const loadRequests = async (specialistId: string) => {
    setError(null);
    const { data: requests, error } = await supabase
      .from("specialist_requests")
      .select(
        "id, case_id, rural_message, specialist_message, accepted_at, completed_at, created_at"
      )
      .eq("specialist_id", specialistId)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    const caseIds = [...new Set((requests ?? []).map((r) => (r as { case_id?: string | null }).case_id).filter(Boolean))] as string[];
    const { data: caseRows, error: caseErr } = await supabase
      .from("cases")
      .select(`
        id,
        patient_id,
        priority,
        status,
        rural_doctor_id
      `)
      .in("id", caseIds);
    if (caseErr) {
      setError(caseErr.message);
      return;
    }

    const cases = (caseRows ?? []) as {
      id: string;
      patient_id?: string | null;
      priority?: string | null;
      status?: string | null;
      rural_doctor_id?: string | null;
    }[];

    const ruralDoctorIds = [
      ...new Set(
        (cases ?? [])
          .map((c) => c.rural_doctor_id)
          .filter(Boolean)
      ),
    ];

    const { data: doctorRows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ruralDoctorIds);

    const doctorMap: Record<string, string> = {};

    (doctorRows ?? []).forEach((d) => {
      const row = d as { id?: string; full_name?: string | null };
      if (!row.id) return;
      doctorMap[row.id] = row.full_name ?? "-";
    });

    const caseMap: Record<
      string,
      {
        priority?: string | null;
        status?: string | null;
        rural_doctor_id?: string | null;
        patient_id?: string | null;
      }
    > = {};
    cases.forEach((c) => {
      const row = c as {
        id: string;
        patient_id?: string | null;
        priority?: string | null;
        status?: string | null;
        rural_doctor_id?: string | null;
      };
      caseMap[row.id] = row;
    });

    const buildRows = async (rows: unknown[]) => {
      const mapped: SpecialistRequestRow[] = [];
      for (const r of rows) {
        const caseId = (r as { case_id?: string | null }).case_id ?? "";
        const caseData = caseMap[caseId];
        if (!caseData || caseData.status === "finalized") continue;
        const patientId = caseData.patient_id ?? "";
        const { data: patientRows } = await supabase
          .from("patients")
          .select("name, generated_patient_id")
          .eq("id", patientId)
          .limit(1);
        const patientRow = patientRows?.[0];
        const ruralDoctorName =
          doctorMap[caseData.rural_doctor_id ?? ""] ?? "-";
        if (!patientId) continue;
        mapped.push({
          id: (r as { id: string }).id,
          case_id: (r as { case_id: string }).case_id,
          specialist_id: specialistId,
          rural_message: (r as { rural_message?: string | null }).rural_message ?? null,
          created_at: (r as { created_at?: string | null }).created_at ?? "",
          accepted_at: (r as { accepted_at?: string | null }).accepted_at ?? null,
          completed_at: (r as { completed_at?: string | null }).completed_at ?? null,
          specialist_message: (r as { specialist_message?: string | null }).specialist_message ?? null,
          case_priority: caseData.priority === "emergency" ? "emergency" : "normal",
          patient_id: patientId,
          patient_name: patientRow?.name ?? null,
          ruralDoctorName,
          rural_doctor_name: ruralDoctorName,
          generated_patient_id:
            patientRow?.generated_patient_id ?? null,
        });
      }
      return mapped;
    };

    const allRows = await buildRows((requests ?? []) as unknown[]);
    const acceptedRows: SpecialistRequestRow[] = [];

    for (const r of allRows) {
      const isAccepted = Boolean(r.accepted_at);
      const isCompleted = Boolean(r.completed_at);

      if (isAccepted && !isCompleted) {
        acceptedRows.push(r);
      }
    }

    const pendingRows = allRows.filter((r) => !r.accepted_at && !r.completed_at);
    const emergencyPendingRows = pendingRows.filter((r) => r.case_priority === "emergency");
    const normalPendingRows = pendingRows.filter((r) => r.case_priority !== "emergency");

    setEmergencyPending(emergencyPendingRows);
    setNormalPending(normalPendingRows);
    setAcceptedRequests(acceptedRows);
  };

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const loadBase = async () => {
      setBaseDataReady(false);
      await loadRequests(userId);
      await loadPastCasesForSpecialist();
      if (active) setBaseDataReady(true);
    };
    loadBase();
    return () => {
      active = false;
    };
  }, [userId]);


  const activeList = activeTab === "emergency" ? emergencyPending : normalPending;
  const reviewRequest =
    [...emergencyPending, ...normalPending, ...acceptedRequests].find((r) => r.id === reviewData?.requestId) ??
    selectedRequest;

  const handleViewAccept = (req: SpecialistRequestRow) => {
    setSelectedRequest(req);
    setAcceptMessage("");
    setViewState("accept");
  };

  const handleOpenReview = (req: SpecialistRequestRow) => {
    setViewState("review");
    if (req.case_id && req.patient_id)
      loadReviewData(req.case_id, req.id, req.patient_id, () => setViewState("review"));
  };

  const selectedRequestId = selectedRequest?.id ?? null;

  const handleAcceptRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRequestId || !selectedRequest?.case_id) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("specialist_requests")
      .update({
        accepted_at: new Date().toISOString(),
        specialist_message: acceptMessage || null,
      })
      .eq("id", selectedRequest.id);

    if (error) {
      console.error("Accept request failed:", error);
      return;
    }

    await loadRequests(user.id);

    if (selectedRequest?.case_id && selectedRequest?.patient_id) {
      await loadReviewData(
        selectedRequest.case_id,
        selectedRequest.id,
        selectedRequest.patient_id
      );

      setViewState("review");
      return;
    }
  };

  const loadReviewData = async (
    caseId: string,
    requestId: string,
    patientId: string,
    onDone?: () => void
  ) => {
    const { data: caseRows } = await supabase
      .from("cases")
      .select("id, patient_id, rural_diagnosis_report, specialist_diagnosis_report, status")
      .eq("id", caseId)
      .limit(1);
    const caseRow = caseRows?.[0] as
      | {
          id?: string;
          patient_id?: string;
          rural_diagnosis_report?: string | null;
          specialist_diagnosis_report?: string | null;
          status?: string | null;
        }
      | undefined;
    const { data: patientRows } = await supabase
      .from("patients")
      .select("name, age, gender, height_cm, weight_kg, smoking_history, generated_patient_id")
      .eq("id", patientId)
      .limit(1);
    const patientRow = patientRows?.[0] as
      | (Record<string, string | number | null> & { name?: string | null })
      | undefined;
    const { data: vitalsRows } = await supabase
      .from("vitals")
      .select("spo2, respiratory_rate, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    const { data: spirometryRows } = await supabase
      .from("spirometry")
      .select("fvc, fev1, fev1_fvc, fev1_fev6, pef, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    const { data: xrayRows } = await supabase
      .from("xrays")
      .select("file_path")
      .eq("patient_id", patientId);
    const xrayPaths = (xrayRows ?? []).map((r) => (r as { file_path: string }).file_path);
    setReviewData({
      caseId,
      requestId,
      patientName: patientRow?.name ?? null,
      generatedPatientId: (patientRow as { generated_patient_id?: string | null } | undefined)?.generated_patient_id ?? null,
      patientHistory: (patientRow as { smoking_history?: string | null } | undefined)?.smoking_history ?? null,
      patientMeta: {
        age: (patientRow as { age?: number | null } | undefined)?.age ?? null,
        gender: (patientRow as { gender?: string | null } | undefined)?.gender ?? null,
        height_cm: (patientRow as { height_cm?: number | null } | undefined)?.height_cm ?? null,
        weight_kg: (patientRow as { weight_kg?: number | null } | undefined)?.weight_kg ?? null,
      },
      vitals: (vitalsRows ?? []) as { spo2?: number | null; respiratory_rate?: number | null; created_at?: string | null }[],
      spirometry: (spirometryRows ?? []) as {
        fvc?: number | null;
        fev1?: number | null;
        fev1_fvc?: number | null;
        fev1_fev6?: number | null;
        pef?: number | null;
        created_at?: string | null;
      }[],
      ruralDiagnosis: caseRow?.rural_diagnosis_report ?? null,
      xrayPaths,
    });
    onDone?.();
  };

  const handleFinishCase = async () => {
    if (!reviewData || !typeof window) return;
    if (!window.confirm("Submit your diagnosis and finish this case?")) return;
    setFinishing(true);
    const caseUpdate: {
      specialist_diagnosis_report: string | null;
      ct_scan_required: boolean;
      bronchoscopy_required: boolean;
    } = {
      specialist_diagnosis_report: specialistDiagnosisReport.trim() || null,
      ct_scan_required: furtherDiagnosisRequired ? furtherDiagnosisTypes.ctScan : false,
      bronchoscopy_required: furtherDiagnosisRequired ? furtherDiagnosisTypes.bronchoscopy : false,
    };
    const { error: caseErr } = await supabase
      .from("cases")
      .update(caseUpdate)
      .eq("id", reviewData.caseId);
    if (caseErr) {
      setError(caseErr.message);
      setFinishing(false);
      return;
    }
    const finalizeRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/finalize-case/${reviewData.caseId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!finalizeRes.ok) {
      setError("Failed to finalize case.");
      setFinishing(false);
      return;
    }
    if (userId) {
      await loadRequests(userId);
    }
    const { error: reqErr } = await supabase
      .from("specialist_requests")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", reviewData.requestId);
    setFinishing(false);
    if (reqErr) {
      setError(reqErr.message);
      return;
    }
    setReviewData(null);
    setSpecialistDiagnosisReport("");
    setFurtherDiagnosisRequired(false);
    setFurtherDiagnosisTypes({ ctScan: false, bronchoscopy: false });
    setViewState("list");
    if (userId) {
      loadRequests(userId);
    }
  };

  const openXrayModal = async (path: string) => {
    setXrayUrl(null);
    setXrayPath(path);
    setShowXrayModal(true);
  };

  function handleViewPastDetails(req: SpecialistRequestRow) {
    setViewingPastCaseId(req.case_id);
    const load = async () => {
      const { data: caseRows } = await supabase
        .from("cases")
        .select(
          "id, priority, rural_diagnosis_report, specialist_diagnosis_report, follow_up_notes, ct_scan_required, bronchoscopy_required, patients (name, generated_patient_id, age, gender, height_cm, weight_kg, smoking_history)"
        )
        .eq("id", req.case_id)
        .limit(1);
      const caseRow = caseRows?.[0] as
        | (Record<string, unknown> & { patients?: Record<string, unknown> | null })
        | undefined;
      const patientRow = caseRow?.patients ?? null;
      const { data: v } = await supabase
        .from("vitals")
        .select("*")
        .eq("patient_id", req.patient_id)
        .order("created_at", { ascending: false })
        .limit(1);
      const { data: s } = await supabase
        .from("spirometry")
        .select("*")
        .eq("patient_id", req.patient_id)
        .order("created_at", { ascending: false })
        .limit(1);
      const { data: x } = await supabase
        .from("xrays")
        .select("file_path")
        .eq("patient_id", req.patient_id);
      setPastCaseDetail({
        patientName: (patientRow as { name?: string | null } | null)?.name ?? null,
        generatedPatientId: (patientRow as { generated_patient_id?: string | null } | null)?.generated_patient_id ?? null,
        patientHistory: (patientRow as { smoking_history?: string | null } | null)?.smoking_history ?? null,
        ruralDiagnosis: (caseRow as { rural_diagnosis_report?: string | null } | null)?.rural_diagnosis_report ?? null,
        specialistDiagnosis: (caseRow as { specialist_diagnosis_report?: string | null } | null)?.specialist_diagnosis_report ?? null,
        followUps: (caseRow as { follow_up_notes?: string | null } | null)?.follow_up_notes ?? null,
        finalReport: null,
        vitals: (v?.[0] as { spo2?: number | null; respiratory_rate?: number | null; created_at?: string | null }) ?? null,
        spirometry:
          (s?.[0] as {
            fvc?: number | null;
            fev1?: number | null;
            fev1_fvc?: number | null;
            fev1_fev6?: number | null;
            pef?: number | null;
            created_at?: string | null;
          }) ?? null,
        ctScanRequired: (caseRow as { ct_scan_required?: boolean | null } | null)?.ct_scan_required ?? null,
        bronchoscopyRequired: (caseRow as { bronchoscopy_required?: boolean | null } | null)?.bronchoscopy_required ?? null,
        xrayPaths: (x ?? []).map((r) => (r as { file_path: string }).file_path),
      });
    };
    load();
  }

  if (!ready) {
    return (
      <div className="p-6 text-slate-400">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 h-screen bg-white shadow-md border-r border-gray-200 p-6 flex flex-col justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Tele-Pulmonology</h1>
          <p className="text-sm text-gray-600 mt-1">Specialist Dashboard</p>
          <div className="mt-8 space-y-2">
            <button
              type="button"
              onClick={() => {
                setViewState("list");
                setViewingPastCaseId(null);
                setPastCaseDetail(null);
              }}
              className={`w-full text-left rounded-xl px-4 py-3 text-sm font-medium ${
                viewState === "list" || viewState === "accept" || viewState === "review"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200"
              }`}
            >
              Active Requests
            </button>
            <button
              type="button"
              onClick={() => {
                setViewState("past");
                setViewingPastCaseId(null);
                setPastCaseDetail(null);
              }}
              className={`w-full text-left rounded-xl px-4 py-3 text-sm font-medium ${
                viewState === "past" || Boolean(viewingPastCaseId)
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200"
              }`}
            >
              Past Cases
            </button>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow"
        >
          Logout
        </button>
      </aside>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
        <h1 className="text-2xl font-semibold text-slate-800">
          Welcome back Dr. {profile?.full_name ?? "Specialist"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Active requests and case review. Review patient data and submit your diagnosis.
        </p>
        {profile && (
          <div className="mt-2 rounded-lg border border-white/40 bg-white/70 px-4 py-2 text-sm text-slate-700 backdrop-blur-xl">
            <span className="font-medium text-slate-800">Doctor:</span> {profile.full_name ?? "-"}
          </div>
        )}
        </div>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {viewState === "list" && !viewingPastCaseId && (
        <>
          <section className="bg-white shadow-md rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-800">ACTIVE REQUESTS</h2>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("emergency")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "emergency"
                    ? "bg-red-600 text-white"
                    : "border border-gray-300 bg-white/70 text-gray-700 hover:bg-blue-50"
                }`}
              >
                Emergency {emergencyPending.length > 0 && `(${emergencyPending.length})`}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("normal")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "normal"
                    ? "bg-blue-600 text-white"
                    : "border border-gray-300 bg-white/70 text-gray-700 hover:bg-blue-50"
                }`}
              >
                Normal {normalPending.length > 0 && `(${normalPending.length})`}
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {activeList.length === 0 ? (
                <div className="bg-white shadow-md rounded-xl p-6 text-gray-700">
                  No {activeTab === "emergency" ? "emergency" : "normal"} requests at the moment.
                </div>
              ) : (
                activeList.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-xl p-4 shadow-md bg-white ${
                      r.case_priority === "emergency" ? "border-l-4 border-red-400" : "border border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 text-sm text-gray-800">
                        <div className="font-semibold">Patient ID: {r.generated_patient_id ?? r.patient_name ?? "-"}</div>
                        <div>
                          <span className={r.case_priority === "emergency"
                            ? "px-3 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700"
                            : "px-3 py-1 text-xs rounded-full bg-green-100 text-green-700"}>
                            {r.case_priority === "emergency" ? "Emergency" : "Normal"}
                          </span>
                        </div>
                        <div className="text-gray-600">Submitted: {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</div>
                        <div className="text-gray-600">Rural Doctor: {r.ruralDoctorName ?? "-"}</div>
                        <div className="text-gray-600">Message: {r.rural_message ?? "-"}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewAccept(r)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow"
                      >
                        View Case
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {acceptedRequests.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-medium text-gray-600">In progress (accepted, not yet completed)</h3>
                <div className="mt-2 space-y-2">
                  {acceptedRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      <span className="text-gray-700">{r.patient_name ?? "-"}</span>
                      <span className="px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Accepted</span>
                      <button
                        type="button"
                        onClick={() => handleOpenReview(r)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow"
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {viewState === "past" && !viewingPastCaseId && (
        <section className="bg-white shadow-md rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-800">PAST CASES</h2>
          <div className="mt-4">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-y-auto overflow-x-hidden" style={{ maxHeight: 480 }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white text-sm text-left">
                    <th className="px-4 py-3">Index</th>
                    <th className="px-4 py-3">Patient ID</th>
                    <th className="px-4 py-3">Emergency / Normal</th>
                    <th className="px-4 py-3">Rural Doctor Name</th>
                    <th className="px-4 py-3">View Details</th>
                  </tr>
                </thead>
                <tbody>
                  {pastRequests.map((r, i) => (
                    <tr key={r.id} className="hover:bg-blue-50 transition border-b border-blue-100">
                      <td className="px-4 py-3 text-gray-700">{i + 1}</td>
                      <td className="px-4 py-3 text-gray-700">{r.generated_patient_id ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <span className={r.case_priority === "emergency" ? "px-3 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700" : "px-3 py-1 text-xs rounded-full bg-green-100 text-green-700"}>
                          {r.case_priority === "emergency" ? "Emergency" : "Normal"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.ruralDoctorName}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <button
                          type="button"
                          onClick={() => handleViewPastDetails(r)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {viewState === "accept" ? (
        selectedRequest ? (
          <div className="bg-white shadow-md rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-800">Accept Request</h2>
          <p className="mt-1 text-sm text-gray-600">
            Patient: {selectedRequest.patient_name ?? "-"} - {selectedRequest.case_priority === "emergency" ? "Emergency" : "Normal"}
          </p>
          <form onSubmit={handleAcceptRequest} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-600">Message (optional)</label>
              <textarea
                rows={3}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-800 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
                value={acceptMessage}
                onChange={(e) => setAcceptMessage(e.target.value)}
                placeholder="Message for the rural doctor"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRequest(null);
                  setViewState("list");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={accepting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow disabled:opacity-50"
              >
                {accepting ? "Accepting..." : "Accept Request"}
              </button>
            </div>
          </form>
          </div>
        ) : (
          <div className="p-6 text-slate-400">Loading request...</div>
        )
      ) : null}

      {viewState === "review" ? (
        reviewData ? (
          <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setReviewData(null);
              setViewState("list");
            }}
            className="text-sm text-slate-600 hover:text-slate-800"
          >
            Back to requests
          </button>
          <div className="space-y-6">
            <div className="bg-white shadow-md rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-800">
                {reviewData.patientName ?? "Patient"} ({reviewData.generatedPatientId ?? "-"})
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <span className="px-3 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Pending</span>
                {reviewRequest?.accepted_at ? <span className="px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Accepted</span> : null}
                {reviewRequest?.completed_at ? <span className="px-3 py-1 text-xs rounded-full bg-green-100 text-green-700">Completed</span> : null}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="bg-white shadow-md rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Patient Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
                    <div className="bg-white rounded-xl p-3 border border-gray-200">Name: {reviewData.patientName ?? "-"}</div>
                    <div className="bg-white rounded-xl p-3 border border-gray-200">Age: {reviewData.patientMeta.age ?? "-"}</div>
                    <div className="bg-white rounded-xl p-3 border border-gray-200">Gender: {reviewData.patientMeta.gender ?? "-"}</div>
                    <div className="bg-white rounded-xl p-3 border border-gray-200">Height: {reviewData.patientMeta.height_cm ?? "-"}</div>
                    <div className="bg-white rounded-xl p-3 border border-gray-200">Weight: {reviewData.patientMeta.weight_kg ?? "-"}</div>
                  </div>
                </div>

                <div className="bg-white shadow-md rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Clinical History</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{reviewData.patientHistory ?? "-"}</p>
                </div>

                <div className="bg-white shadow-md rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Vitals & Spirometry</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    {reviewData.vitals.length === 0 && reviewData.spirometry.length === 0 && <div>-</div>}
                    {reviewData.vitals.map((v, i) => (
                      <div key={`vital-${i}`}>
                        SpO2: {v.spo2 == null ? "-" : `${v.spo2}%`} | Respiratory Rate: {v.respiratory_rate == null ? "-" : `${v.respiratory_rate} breaths/min`}
                      </div>
                    ))}
                    {reviewData.spirometry.map((s, i) => (
                      <div key={`spiro-${i}`}>
                        FVC: {s.fvc == null ? "-" : `${s.fvc} L`} | FEV1: {s.fev1 == null ? "-" : `${s.fev1} L`} | FEV1/FVC: {s.fev1_fvc == null ? "-" : `${s.fev1_fvc}%`} | FEV1/FEV6: {s.fev1_fev6 == null ? "-" : `${s.fev1_fev6}%`} | PEF: {s.pef == null ? "-" : `${s.pef} L/min`}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white shadow-md rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Rural Doctor Diagnosis</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{reviewData.ruralDiagnosis ?? "-"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white shadow-md rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">X-Ray Viewer</h3>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-600 truncate">
                      File: {reviewData.xrayPaths[0] ? reviewData.xrayPaths[0].split("/").pop() : "-"}
                    </p>
                    <button
                      type="button"
                      onClick={() => reviewData.xrayPaths[0] && openXrayModal(reviewData.xrayPaths[0])}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow"
                    >
                      View X-Ray
                    </button>
                  </div>
                </div>

                <div className="bg-white shadow-md rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-800">Specialist Diagnosis Report</h3>
                  <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={furtherDiagnosisRequired}
                      onChange={(e) => setFurtherDiagnosisRequired(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-primary"
                    />
                    Further diagnosis required
                  </label>
                  {furtherDiagnosisRequired && (
                    <div className="mt-2 space-y-2 text-sm text-gray-600">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={furtherDiagnosisTypes.ctScan}
                          onChange={(e) =>
                            setFurtherDiagnosisTypes((prev) => ({ ...prev, ctScan: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-primary"
                        />
                        CT Scan Required
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={furtherDiagnosisTypes.bronchoscopy}
                          onChange={(e) =>
                            setFurtherDiagnosisTypes((prev) => ({ ...prev, bronchoscopy: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-primary"
                        />
                        Bronchoscopy Required
                      </label>
                    </div>
                  )}
                  <textarea
                    rows={8}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-800 bg-white placeholder:text-gray-400 mt-3 focus:ring-2 focus:ring-blue-500"
                    value={specialistDiagnosisReport}
                    onChange={(e) => setSpecialistDiagnosisReport(e.target.value)}
                    placeholder="Your diagnosis and recommendations..."
                  />
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={handleFinishCase}
                      disabled={finishing}
                      className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-500 disabled:opacity-50"
                    >
                      Finish
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        ) : (
          <div className="p-6 text-slate-400">Loading request...</div>
        )
      ) : null}

      {viewState === "past" && viewingPastCaseId && !pastCaseDetail ? (
        <div className="p-6 text-slate-400">
          Loading case details...
        </div>
      ) : null}

      {viewingPastCaseId && !pastCaseDetail && (
        <div className="text-slate-400 p-6">
          Select a case to view details.
        </div>
      )}

      {viewingPastCaseId && pastCaseDetail && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setViewingPastCaseId(null);
              setPastCaseDetail(null);
              setViewState("past");
            }}
            className="text-sm text-slate-600 hover:text-slate-800"
          >
            Back to Past Cases
          </button>
          <div className="bg-white shadow-md rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-800">{pastCaseDetail?.patientName ?? "Patient"}</h2>
            <p className="text-sm text-slate-600">Patient ID: {pastCaseDetail?.generatedPatientId ?? "-"}</p>
            <div className="mt-4 grid gap-4 text-sm">
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-medium text-slate-700">Patient Information</h3>
                <div className="mt-2 grid gap-1 text-slate-700">
                  <div>Name: {pastCaseDetail.patientName ?? "-"}</div>
                  <div>Patient ID: {pastCaseDetail.generatedPatientId ?? "-"}</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-medium text-slate-700">Clinical History</h3>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">{pastCaseDetail.patientHistory ?? "-"}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-medium text-slate-700">Vitals</h3>
                <div className="mt-2 grid gap-1 text-slate-700">
                  <div>SpO2: {pastCaseDetail.vitals?.spo2 == null ? "-" : `${pastCaseDetail.vitals.spo2}%`}</div>
                  <div>
                    Respiratory Rate:{" "}
                    {pastCaseDetail.vitals?.respiratory_rate == null
                      ? "-"
                      : `${pastCaseDetail.vitals.respiratory_rate} breaths/min`}
                  </div>
                  <div>FVC: {pastCaseDetail.spirometry?.fvc == null ? "-" : `${pastCaseDetail.spirometry.fvc} L`}</div>
                  <div>FEV1: {pastCaseDetail.spirometry?.fev1 == null ? "-" : `${pastCaseDetail.spirometry.fev1} L`}</div>
                  <div>
                    FEV1 / FVC:{" "}
                    {pastCaseDetail.spirometry?.fev1_fvc == null ? "-" : `${pastCaseDetail.spirometry.fev1_fvc}%`}
                  </div>
                  <div>
                    FEV1 / FEV6:{" "}
                    {pastCaseDetail.spirometry?.fev1_fev6 == null ? "-" : `${pastCaseDetail.spirometry.fev1_fev6}%`}
                  </div>
                  <div>PEF: {pastCaseDetail.spirometry?.pef == null ? "-" : `${pastCaseDetail.spirometry.pef} L/min`}</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-medium text-slate-700">Rural Diagnosis</h3>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">{pastCaseDetail.ruralDiagnosis ?? "-"}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-medium text-slate-700">Specialist Diagnosis</h3>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">{pastCaseDetail.specialistDiagnosis ?? "-"}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-medium text-slate-700">Recommended Further Investigations</h3>
                <div className="mt-2 space-y-2 text-slate-700">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(pastCaseDetail.ctScanRequired)} readOnly />
                    CT Scan
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(pastCaseDetail.bronchoscopyRequired)} readOnly />
                    Bronchoscopy
                  </label>
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-medium text-slate-700">Follow-up Notes</h3>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">{pastCaseDetail.followUps ?? "-"}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-medium text-slate-700">X-ray Image</h3>
                {pastCaseDetail.xrayPaths?.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => openXrayModal(pastCaseDetail.xrayPaths[0])}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow"
                  >
                    View X-ray
                  </button>
                ) : (
                  <p className="mt-2 text-slate-400">-</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <DicomViewer
        isOpen={showXrayModal}
        xrayUrl={xrayUrl}
        xrayPath={xrayPath}
        onClose={() => {
          setShowXrayModal(false);
          setXrayUrl(null);
          setXrayPath(null);
        }}
      />
      </div>
    </div>
  );
}


