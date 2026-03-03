"use client";

import { FormEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";

const DicomViewer = dynamic(() => import("@/app/components/DicomViewer"), { ssr: false });

interface SpecialistRequestRow {
  id: string;
  case_id: string;
  specialist_id: string;
  rural_message: string | null;
  created_at: string;
  accepted_at?: string | null;
  completed_at?: string | null;
  case_priority?: "emergency" | "normal";
  patient_id?: string;
  patient_name?: string | null;
  rural_doctor_name?: string | null;
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
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState<"emergency" | "normal">("emergency");
  const [emergencyPending, setEmergencyPending] = useState<SpecialistRequestRow[]>([]);
  const [normalPending, setNormalPending] = useState<SpecialistRequestRow[]>([]);
  const [acceptedRequests, setAcceptedRequests] = useState<SpecialistRequestRow[]>([]);
  const [pastRequests, setPastRequests] = useState<SpecialistRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewState, setViewState] = useState<"list" | "accept" | "review" | "past">("list");
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

  const loadPastCasesForSpecialist = async (specialistId: string) => {
    const { data: caseRows, error } = await supabase
      .from("cases")
      .select("id, patient_id, priority, reviewed_at, status")
      .eq("specialist_id", specialistId)
      .eq("status", "finalized")
      .order("reviewed_at", { ascending: false });
    if (error) {
      setError(error.message);
      setPastRequests([]);
      return;
    }
    const results = await Promise.all(
      (caseRows ?? []).map(async (c) => {
        const patientId = (c as { patient_id?: string }).patient_id ?? "";
        const { data: patientRows } = await supabase
          .from("patients")
          .select("name, generated_patient_id, created_by")
          .eq("id", patientId)
          .limit(1);
        const patientRow = patientRows?.[0] as
          | ({ name?: string | null; created_by?: string | null } & Record<string, string | null>)
          | undefined;
        const { data: ruralRows } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", patientRow?.created_by ?? "")
          .limit(1);
        const ruralProfile = ruralRows?.[0] as { full_name?: string | null } | undefined;
        return {
          id: (c as { id: string }).id,
          case_id: (c as { id: string }).id,
          specialist_id: specialistId,
          rural_message: null,
          created_at: ((c as { reviewed_at?: string | null }).reviewed_at ?? "") as string,
          case_priority: (c as { priority?: string }).priority === "emergency" ? "emergency" : "normal",
          patient_id: patientId || undefined,
          patient_name: patientRow?.name ?? null,
          rural_doctor_name: ruralProfile?.full_name ?? null,
          generated_patient_id:
            (patientRow as { generated_patient_id?: string | null } | undefined)?.generated_patient_id ?? null,
        } as SpecialistRequestRow;
      })
    );
    setPastRequests(results);
  };

  const loadRequests = async (specialistId: string) => {
    setError(null);
    const { data: reqData, error: reqErr } = await supabase
      .from("specialist_requests")
      .select("id, case_id, rural_message, specialist_message, accepted_at, completed_at, created_at")
      .eq("specialist_id", specialistId)
      .order("created_at", { ascending: false });

    if (reqErr) {
      setError(reqErr.message);
      return;
    }
    const requests = (reqData ?? []) as (SpecialistRequestRow & { case_id: string })[];
    const caseIds = requests.map((r) => r.case_id);
    const requestsByCaseId = new Map<string, SpecialistRequestRow & { case_id: string }>();
    for (const r of requests) {
      requestsByCaseId.set(r.case_id, r);
    }
    const casesById = new Map<
      string,
      { priority?: "emergency" | "routine"; patient_id?: string; status?: string }
    >();
    let emergencyCaseRows: { id: string; priority?: "emergency" | "routine"; patient_id?: string; status?: string }[] =
      [];
    let routineCaseRows: { id: string; priority?: "emergency" | "routine"; patient_id?: string; status?: string }[] = [];
    if (caseIds.length > 0) {
      const { data: emergencyCases } = await supabase
        .from("cases")
        .select("id, priority, patient_id, status")
        .in("id", caseIds)
        .eq("priority", "emergency");
      const { data: routineCases } = await supabase
        .from("cases")
        .select("id, priority, patient_id, status")
        .in("id", caseIds)
        .eq("priority", "routine");
      emergencyCaseRows = (emergencyCases ?? []) as {
        id: string;
        priority?: "emergency" | "routine";
        patient_id?: string;
        status?: string;
      }[];
      routineCaseRows = (routineCases ?? []) as {
        id: string;
        priority?: "emergency" | "routine";
        patient_id?: string;
        status?: string;
      }[];
      for (const c of [...emergencyCaseRows, ...routineCaseRows]) {
        const row = c as { id: string; priority?: "emergency" | "routine"; patient_id?: string; status?: string };
        casesById.set(row.id, row);
      }
    }
    const accepted: SpecialistRequestRow[] = [];
    const buildPendingRows = async (
      caseRows: { id: string; priority?: "emergency" | "routine"; patient_id?: string }[],
      priority: "emergency" | "normal"
    ) => {
      const rows: SpecialistRequestRow[] = [];
      for (const c of caseRows) {
        const request = requestsByCaseId.get(c.id);
        const isAccepted = Boolean(request?.accepted_at);
        if (isAccepted) continue;
        const patientId = c.patient_id;
        if (!patientId) continue;
        const { data: patientRows } = await supabase
          .from("patients")
          .select("name, created_by, generated_patient_id")
          .eq("id", patientId)
          .limit(1);
        const patientRow = patientRows?.[0] as { name?: string | null; created_by?: string } | undefined;
        const createdBy = patientRow?.created_by;
        let ruralDoctorName: string | null = null;
        if (createdBy) {
          const { data: profRows } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", createdBy)
            .limit(1);
          const prof = profRows?.[0] as { full_name: string | null } | undefined;
          ruralDoctorName = prof?.full_name ?? null;
        }
        rows.push({
          id: request?.id ?? c.id,
          case_id: c.id,
          specialist_id: request?.specialist_id ?? specialistId,
          rural_message: request?.rural_message ?? null,
          created_at: request?.created_at ?? "",
          accepted_at: request?.accepted_at ?? null,
          completed_at: request?.completed_at ?? null,
          specialist_message: request?.specialist_message ?? null,
          case_priority: priority,
          patient_id: patientId,
          patient_name: patientRow?.name ?? null,
          rural_doctor_name: ruralDoctorName,
          generated_patient_id:
            (patientRow as { generated_patient_id?: string | null } | undefined)?.generated_patient_id ?? null,
        });
      }
      return rows;
    };
    const [emergencyPendingRows, normalPendingRows] = await Promise.all([
      buildPendingRows(emergencyCaseRows, "emergency"),
      buildPendingRows(routineCaseRows, "normal"),
    ]);
    for (const r of requests) {
      const caseRow = casesById.get(r.case_id);
      if (!caseRow) continue;
      const patientId = caseRow.patient_id;
      if (!patientId) continue;
      const { data: patientRows } = await supabase
        .from("patients")
        .select("name, created_by, generated_patient_id")
        .eq("id", patientId)
        .limit(1);
      const patientRow = patientRows?.[0] as { name?: string | null; created_by?: string } | undefined;
      const createdBy = patientRow?.created_by;
      let ruralDoctorName: string | null = null;
      if (createdBy) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", createdBy)
          .limit(1);
        const prof = profRows?.[0] as { full_name: string | null } | undefined;
        ruralDoctorName = prof?.full_name ?? null;
      }
      const row: SpecialistRequestRow = {
        ...r,
        case_priority: caseRow.priority === "emergency" ? "emergency" : "normal",
        patient_id: patientId,
        patient_name: patientRow?.name ?? null,
        rural_doctor_name: ruralDoctorName,
        generated_patient_id: (patientRow as { generated_patient_id?: string | null } | undefined)?.generated_patient_id ?? null,
      };
      const isCompleted = Boolean((r as { completed_at?: string | null }).completed_at);
      const isAccepted = Boolean((r as { accepted_at?: string | null }).accepted_at);
      if (isAccepted && !isCompleted) accepted.push(row);
    }
    setEmergencyPending(emergencyPendingRows);
    setNormalPending(normalPendingRows);
    setAcceptedRequests(accepted);
  };

  useEffect(() => {
    if (userId) {
      loadRequests(userId);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadPastCasesForSpecialist(userId);
    }
  }, [userId]);

  const activeList = activeTab === "emergency" ? emergencyPending : normalPending;

  const handleViewAccept = (req: SpecialistRequestRow) => {
    setSelectedRequest(req);
    setAcceptMessage("");
    setViewState("accept");
  };

  const handleOpenReview = (req: SpecialistRequestRow) => {
    if (req.case_id && req.patient_id)
      loadReviewData(req.case_id, req.id, req.patient_id, () => setViewState("review"));
  };

  const handleAcceptRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setAccepting(true);
    const { error: err } = await supabase
      .from("specialist_requests")
      .update({
        accepted_at: new Date().toISOString(),
        specialist_message: acceptMessage.trim() || null,
      })
      .eq("id", selectedRequest.id);
    setAccepting(false);
    if (err) {
      setError(err.message);
      return;
    }
    const { error: caseErr } = await supabase
      .from("cases")
      .update({ specialist_id: selectedRequest.specialist_id })
      .eq("id", selectedRequest.case_id);
    if (caseErr) {
      setError(caseErr.message);
      return;
    }
    setSelectedRequest(null);
    setViewState("list");
    if (userId) {
      loadRequests(userId);
    }
    if (selectedRequest.case_id && selectedRequest.patient_id) {
      loadReviewData(selectedRequest.case_id, selectedRequest.id, selectedRequest.patient_id, () => {
        setViewState("review");
      });
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
      .select("rural_diagnosis_report")
      .eq("id", caseId)
      .limit(1);
    const caseRow = caseRows?.[0] as { rural_diagnosis_report?: string | null } | undefined;
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

  const handleViewPastDetails = (req: SpecialistRequestRow) => {
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
        | (Record<string, unknown> & { patients?: Record<string, unknown> | Record<string, unknown>[] })
        | undefined;
      const patientRow = Array.isArray(caseRow?.patients) ? caseRow?.patients?.[0] : caseRow?.patients;
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
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">
          Welcome back Dr. {profile?.full_name ?? "Specialist"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Active requests and case review. Review patient data and submit your diagnosis.
        </p>
        {profile && (
          <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm text-slate-300">
            <span className="font-medium text-slate-200">Doctor:</span> {profile.full_name ?? "-"}
          </div>
        )}
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {viewState === "list" && !viewingPastCaseId && (
        <>
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-slate-100">ACTIVE REQUESTS</h2>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("emergency")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "emergency"
                    ? "bg-red-600 text-white"
                    : "border border-slate-600 text-slate-400 hover:bg-slate-800"
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
                    : "border border-slate-600 text-slate-400 hover:bg-slate-800"
                }`}
              >
                Normal {normalPending.length > 0 && `(${normalPending.length})`}
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-slate-400">
                    <th className="px-3 py-2">Patient Name</th>
                    <th className="px-3 py-2">Emergency Note</th>
                    <th className="px-3 py-2">Rural Doctor Name</th>
                    <th className="px-3 py-2">VIEW</th>
                  </tr>
                </thead>
                <tbody>
                  {activeList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-slate-500">
                        No {activeTab === "emergency" ? "emergency" : "normal"} requests at the moment.
                      </td>
                    </tr>
                  ) : (
                    activeList.map((r) => (
                      <tr key={r.id} className="border-b border-slate-700/50">
                        <td className="px-3 py-2 text-slate-200">{r.patient_name ?? "-"}</td>
                        <td className="px-3 py-2 text-slate-300">{r.rural_message ?? "-"}</td>
                        <td className="px-3 py-2 text-slate-300">{r.rural_doctor_name ?? "-"}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => handleViewAccept(r)}
                            className="text-primary hover:underline"
                          >
                            VIEW
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {acceptedRequests.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-medium text-slate-400">In progress (accepted, not yet completed)</h3>
                <div className="mt-2 space-y-2">
                  {acceptedRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-200">{r.patient_name ?? "-"}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenReview(r)}
                        className="text-primary hover:underline"
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-slate-100">PAST CASES</h2>
            <div className="mt-4">
              <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 400 }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-slate-400">
                      <th className="px-3 py-2">Index</th>
                      <th className="px-3 py-2">Patient ID</th>
                      <th className="px-3 py-2">Emergency / Normal</th>
                      <th className="px-3 py-2">Rural Doctor Name</th>
                      <th className="px-3 py-2">View Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastRequests.map((r, i) => (
                      <tr key={r.id} className="border-b border-slate-700/50">
                        <td className="px-3 py-2 text-slate-300">{i + 1}</td>
                        <td className="px-3 py-2 text-slate-200">{r.generated_patient_id ?? "-"}</td>
                        <td className="px-3 py-2 text-slate-200">
                          {r.case_priority === "emergency" ? "Emergency" : "Normal"}
                        </td>
                        <td className="px-3 py-2 text-slate-300">{r.rural_doctor_name ?? "-"}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => handleViewPastDetails(r)}
                            className="text-primary hover:underline"
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
        </>
      )}

      {viewState === "accept" && selectedRequest && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-slate-100">Accept Request</h2>
          <p className="mt-1 text-sm text-slate-400">
            Patient: {selectedRequest.patient_name ?? "-"} · {selectedRequest.case_priority === "emergency" ? "Emergency" : "Normal"}
          </p>
          <form onSubmit={handleAcceptRequest} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm text-slate-400">Message (optional)</label>
              <textarea
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
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
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={accepting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-600 disabled:opacity-50"
              >
                {accepting ? "Accepting…" : "Accept Request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewState === "review" && reviewData && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setReviewData(null);
              setViewState("list");
            }}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Back to requests
          </button>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="border-b border-slate-700 pb-3">
              <h2 className="text-lg font-semibold text-slate-100">
                {reviewData.patientName ?? "Patient"} ({reviewData.generatedPatientId ?? "-"})
              </h2>
              <div className="mt-2 text-sm text-slate-300">
                Age: {reviewData.patientMeta.age ?? "-"} | Gender: {reviewData.patientMeta.gender ?? "-"} | Height:{" "}
                {reviewData.patientMeta.height_cm ?? "-"} | Weight: {reviewData.patientMeta.weight_kg ?? "-"}
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-300">Patient History</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                {reviewData.patientHistory ?? "-"}
              </p>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-300">Vitals & Spirometry</h3>
              <div className="mt-2 space-y-2 text-sm text-slate-200">
                {reviewData.vitals.length === 0 && reviewData.spirometry.length === 0 && <div>-</div>}
                {reviewData.vitals.map((v, i) => (
                  <div key={`vital-${i}`}>
                    SpO₂: {v.spo2 == null ? "—" : `${v.spo2}%`} | RR: {v.respiratory_rate == null ? "—" : `${v.respiratory_rate} breaths/min`}
                  </div>
                ))}
                {reviewData.spirometry.map((s, i) => (
                  <div key={`spiro-${i}`}>
                    FVC: {s.fvc == null ? "—" : `${s.fvc} L`} | FEV₁: {s.fev1 == null ? "—" : `${s.fev1} L`} | FEV₁/FVC: {s.fev1_fvc == null ? "—" : `${s.fev1_fvc}%`} | FEV₁/FEV₆:{" "}
                    {s.fev1_fev6 == null ? "—" : `${s.fev1_fev6}%`} | PEF: {s.pef == null ? "—" : `${s.pef} L/min`}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-300">X-Ray</h3>
              <button
                type="button"
                onClick={() => reviewData.xrayPaths[0] && openXrayModal(reviewData.xrayPaths[0])}
                className="mt-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                VIEW X-RAY
              </button>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-300">Specialist Diagnosis</h3>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={furtherDiagnosisRequired}
                  onChange={(e) => setFurtherDiagnosisRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-primary"
                />
                Further diagnosis required
              </label>
              {furtherDiagnosisRequired && (
                <div className="mt-2 space-y-2 text-sm text-slate-300">
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
              <label className="mt-2 block text-sm text-slate-400">Specialist Diagnosis Report</label>
              <textarea
                rows={5}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={specialistDiagnosisReport}
                onChange={(e) => setSpecialistDiagnosisReport(e.target.value)}
                placeholder="Your diagnosis and recommendations…"
              />
              <button
                type="button"
                onClick={handleFinishCase}
                disabled={finishing}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-600 disabled:opacity-50"
              >
                {finishing ? "Saving…" : "Finish"}
              </button>
            </div>
          </div>
        </div>
      )}

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
            }}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Back to Past Cases
          </button>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-semibold text-slate-100">{pastCaseDetail?.patientName ?? "Patient"}</h2>
            <p className="text-sm text-slate-400">Patient ID: {pastCaseDetail?.generatedPatientId ?? "-"}</p>
            <div className="mt-4 grid gap-4 text-sm">
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Patient Information</h3>
                <div className="mt-2 grid gap-1 text-slate-200">
                  <div>Name: {pastCaseDetail.patientName ?? "-"}</div>
                  <div>Patient ID: {pastCaseDetail.generatedPatientId ?? "-"}</div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Clinical History</h3>
                <p className="mt-2 whitespace-pre-wrap text-slate-200">{pastCaseDetail.patientHistory ?? "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Vitals</h3>
                <div className="mt-2 grid gap-1 text-slate-200">
                  <div>SpO₂: {pastCaseDetail.vitals?.spo2 == null ? "—" : `${pastCaseDetail.vitals.spo2}%`}</div>
                  <div>
                    Respiratory Rate:{" "}
                    {pastCaseDetail.vitals?.respiratory_rate == null
                      ? "—"
                      : `${pastCaseDetail.vitals.respiratory_rate} breaths/min`}
                  </div>
                  <div>FVC: {pastCaseDetail.spirometry?.fvc == null ? "—" : `${pastCaseDetail.spirometry.fvc} L`}</div>
                  <div>FEV₁: {pastCaseDetail.spirometry?.fev1 == null ? "—" : `${pastCaseDetail.spirometry.fev1} L`}</div>
                  <div>
                    FEV₁ / FVC:{" "}
                    {pastCaseDetail.spirometry?.fev1_fvc == null ? "—" : `${pastCaseDetail.spirometry.fev1_fvc}%`}
                  </div>
                  <div>
                    FEV₁ / FEV₆:{" "}
                    {pastCaseDetail.spirometry?.fev1_fev6 == null ? "—" : `${pastCaseDetail.spirometry.fev1_fev6}%`}
                  </div>
                  <div>PEF: {pastCaseDetail.spirometry?.pef == null ? "—" : `${pastCaseDetail.spirometry.pef} L/min`}</div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Rural Diagnosis</h3>
                <p className="mt-2 whitespace-pre-wrap text-slate-200">{pastCaseDetail.ruralDiagnosis ?? "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Specialist Diagnosis</h3>
                <p className="mt-2 whitespace-pre-wrap text-slate-200">{pastCaseDetail.specialistDiagnosis ?? "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Recommended Further Investigations</h3>
                <div className="mt-2 space-y-2 text-slate-200">
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
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Follow-up Notes</h3>
                <p className="mt-2 whitespace-pre-wrap text-slate-200">{pastCaseDetail.followUps ?? "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">X-ray Image</h3>
                {pastCaseDetail.xrayPaths?.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => openXrayModal(pastCaseDetail.xrayPaths[0])}
                    className="mt-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
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
  );
}







