"use client";

import { FormEvent, useEffect, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";

type Gender = "male" | "female" | "other";

interface CaseOption {
  id: string;
  patient_id: string;
  created_at: string;
  priority?: "emergency" | "routine" | null;
  patient?: {
    generated_patient_id?: string | null;
  } [] | null;
  status?: string;
}

const DICOM_ACCEPT = ".dcm,application/dicom";
const DICOM_MIME = "application/dicom";
const DicomViewer = dynamic(() => import("@/app/components/DicomViewer"), { ssr: false });

function isDicomFile(file: File): boolean {
  const ext = file.name.toLowerCase().split(".").pop();
  const mime = file.type?.toLowerCase();
  return ext === "dcm" || mime === DICOM_MIME || mime === "application/x-dicom";
}

export default function RuralDashboardPage() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);
  const [patientSaved, setPatientSaved] = useState(false);
  const [vitalsSaved, setVitalsSaved] = useState(false);
  const [xrayUploaded, setXrayUploaded] = useState(false);
  const [caseSubmitted, setCaseSubmitted] = useState(false);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [consentWarning, setConsentWarning] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [savingVitals, setSavingVitals] = useState(false);
  const [uploadingXray, setUploadingXray] = useState(false);
  const [submittingCase, setSubmittingCase] = useState(false);
  const [pendingPriority, setPendingPriority] = useState<"emergency" | "normal" | null>(null);
  const [waitingCaseId, setWaitingCaseId] = useState<string | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<{ full_name: string | null } | null>(null);
  const [waitingRequest, setWaitingRequest] = useState<{
    specialist_name?: string | null;
    rural_message?: string | null;
    specialist_message?: string | null;
    specialist_diagnosis_report?: string | null;
    case_status?: string | null;
    accepted_at?: string | null;
    completed_at?: string | null;
  } | null>(null);
  const [pastCasesList, setPastCasesList] = useState<CaseOption[]>([]);
  const [viewingCaseId, setViewingCaseId] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<{
    patient?: {
      name?: string;
      generated_patient_id?: string | null;
      age?: number | null;
      gender?: string | null;
      height_cm?: number | null;
      weight_kg?: number | null;
      smoking_history?: string | null;
    };
    vitals?: { spo2?: number | null; respiratory_rate?: number | null; created_at?: string | null } | null;
    spirometry?: {
      fvc?: number | null;
      fev1?: number | null;
      fev1_fvc?: number | null;
      fev1_fev6?: number | null;
      pef?: number | null;
      created_at?: string | null;
    } | null;
    xrays?: { path: string }[];
    rural_diagnosis?: string | null;
    specialist_diagnosis?: string | null;
    finalized_report?: string | null;
    follow_up_notes?: string | null;
    case_status?: string | null;
    ct_scan_required?: boolean | null;
    bronchoscopy_required?: boolean | null;
  } | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  const [patientForm, setPatientForm] = useState({
    name: "",
    phone_number: "",
    age: "",
    gender: "male" as Gender,
    height_cm: "",
    weight_kg: "",
    smoking_history: "",
    diagnosis_date: "",
    consent_given: false,
  });
  const [patientCode, setPatientCode] = useState<string | null>(null);

  const [vitalsForm, setVitalsForm] = useState({
    spo2: "",
    respiratory_rate: "",
  });

  const [spirometryForm, setSpirometryForm] = useState({
    fvc: "",
    fev1: "",
    fev1_fvc: "",
    fev1_fev6: "",
    pef: "",
  });

  const [xrayFile, setXrayFile] = useState<File | null>(null);
  const [xrayValidationError, setXrayValidationError] = useState<string | null>(null);
  const [showXrayModal, setShowXrayModal] = useState(false);
  const [xrayUrl, setXrayUrl] = useState<string | null>(null);
  const [xrayPath, setXrayPath] = useState<string | null>(null);

  const [ruralDiagnosisReport, setRuralDiagnosisReport] = useState("");
  const [viewMode, setViewMode] = useState<"main" | "new_case" | "past_cases" | "waiting" | "case_detail">("main");
  const [showSpecialistModal, setShowSpecialistModal] = useState(false);
  const [specialists, setSpecialists] = useState<{ id: string; full_name: string | null }[]>([]);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null);
  const [ruralMessage, setRuralMessage] = useState("");

  const resetMessages = () => {
    setStatusMessage(null);
    setErrorMessage(null);
    setConsentWarning(false);
    setXrayValidationError(null);
  };

  const resetCaseState = () => {
    setPatientId(null);
    setCurrentCaseId(null);
    setPatientSaved(false);
    setVitalsSaved(false);
    setXrayUploaded(false);
    setCaseSubmitted(false);
    setPatientCode(null);
    setWaitingCaseId(null);
    setViewingCaseId(null);
    setCaseDetail(null);
    setPatientForm({
      name: "",
      phone_number: "",
      age: "",
      gender: "male",
      height_cm: "",
      weight_kg: "",
      smoking_history: "",
      diagnosis_date: "",
      consent_given: false,
    });
    setVitalsForm({ spo2: "", respiratory_rate: "" });
    setSpirometryForm({ fvc: "", fev1: "", fev1_fvc: "", fev1_fev6: "", pef: "" });
    setXrayFile(null);
    setRuralDiagnosisReport("");
    setRuralMessage("");
    setSelectedSpecialistId(null);
    setPendingPriority(null);
    setSpecialists([]);
  };

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  const handleCreatePatient = async (event: FormEvent) => {
    event.preventDefault();
    resetMessages();

    if (!patientForm.consent_given) {
      setConsentWarning(true);
      setErrorMessage("Patient consent is required before saving.");
      return;
    }

    setSavingPatient(true);
    const { data: userResult, error: userError } = await supabase.auth.getUser();

    if (userError || !userResult.user) {
      setErrorMessage("Unable to determine current user.");
      setSavingPatient(false);
      return;
    }

    const { data: roleRows } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userResult.user.id)
      .limit(1);
    const role = roleRows?.[0] as { role?: string } | undefined;
    if (!role || role.role !== "rural_doctor") {
      setErrorMessage("Only rural doctors can register patients.");
      setSavingPatient(false);
      return;
    }

    const diagnosisDate = patientForm.diagnosis_date ? new Date(patientForm.diagnosis_date) : null;
    const { data: patientRows, error: patientError } = await supabase
      .from("patients")
      .insert({
        created_by: userResult.user.id,
        name: patientForm.name,
        phone_number: patientForm.phone_number,
        age: Number(patientForm.age) || null,
        gender: patientForm.gender,
        height_cm: patientForm.height_cm ? Number(patientForm.height_cm) : null,
        weight_kg: patientForm.weight_kg ? Number(patientForm.weight_kg) : null,
        smoking_history: patientForm.smoking_history || null,
        diagnosis_date: diagnosisDate?.toISOString().slice(0, 10) || null,
        consent_given: patientForm.consent_given,
      })
      .select();

    setSavingPatient(false);

    const patient = patientRows?.[0] as { id: string; generated_patient_id?: string | null } | undefined;
    if (patientError || !patient) {
      setErrorMessage(patientError?.message ?? "Patient insert failed.");
      return;
    }
    setPatientId(patient.id);
    setPatientCode(patient.generated_patient_id ?? null);
    setCurrentCaseId(null);
    setPatientSaved(true);
    setCaseSubmitted(false);
    setStatusMessage("Patient saved. You can now add vitals and spirometry.");
  };

  const handleSaveVitalsAndSpirometry = async (event: FormEvent) => {
    event.preventDefault();
    resetMessages();

    if (!patientId) {
      setErrorMessage("Create and save a patient first.");
      return;
    }

    setSavingVitals(true);

    const { error: vitalsError } = await supabase.from("vitals").insert({
      patient_id: patientId,
      spo2: vitalsForm.spo2 ? Number(vitalsForm.spo2) : null,
      respiratory_rate: vitalsForm.respiratory_rate ? Number(vitalsForm.respiratory_rate) : null,
    });

    if (vitalsError) {
      setSavingVitals(false);
      setErrorMessage(`Vitals save failed: ${vitalsError.message}`);
      return;
    }

    const { error: spirometryError } = await supabase.from("spirometry").insert({
      patient_id: patientId,
      fvc: spirometryForm.fvc ? Number(spirometryForm.fvc) : null,
      fev1: spirometryForm.fev1 ? Number(spirometryForm.fev1) : null,
      fev1_fvc: spirometryForm.fev1_fvc ? Number(spirometryForm.fev1_fvc) : null,
      fev1_fev6: spirometryForm.fev1_fev6 ? Number(spirometryForm.fev1_fev6) : null,
      pef: spirometryForm.pef ? Number(spirometryForm.pef) : null,
    });

    setSavingVitals(false);

    if (spirometryError) {
      setErrorMessage(`Spirometry save failed: ${spirometryError.message}`);
      return;
    }

    setVitalsSaved(true);
    setStatusMessage("Vitals and spirometry saved. You can now upload X-ray and submit case.");
  };

  const handleXrayFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setXrayValidationError(null);
    setXrayFile(null);

    if (!file) return;

    if (!isDicomFile(file)) {
      setXrayValidationError("Only DICOM X-ray files are accepted.");
      return;
    }

    setXrayFile(file);
  };

  const handleUploadXray = async (event: FormEvent) => {
    event.preventDefault();
    resetMessages();

    if (!patientId || !vitalsSaved) {
      setErrorMessage("Save patient and vitals/spirometry first.");
      return;
    }

    if (!xrayFile) {
      setXrayValidationError("Only DICOM X-ray files are accepted.");
      return;
    }

    if (!isDicomFile(xrayFile)) {
      setXrayValidationError("Only DICOM X-ray files are accepted.");
      return;
    }

    setUploadingXray(true);

    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) {
      setErrorMessage("Unable to determine current user.");
      setUploadingXray(false);
      return;
    }

    const fileExt = xrayFile.name.toLowerCase().endsWith(".dcm") ? "dcm" : "dcm";
    const fileName = `${patientId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("x_rays")
      .upload(fileName, xrayFile, {
        contentType: DICOM_MIME,
        upsert: false,
      });

    if (uploadError) {
      setUploadingXray(false);
      setErrorMessage(uploadError.message);
      return;
    }

    const { error: xrayRecordError } = await supabase.from("xrays").insert({
      patient_id: patientId,
      file_path: fileName,
      uploaded_by: userResult.user.id,
    });

    setUploadingXray(false);

    if (xrayRecordError) {
      setErrorMessage(xrayRecordError.message);
      return;
    }

    setXrayUploaded(true);
    setStatusMessage("X-ray uploaded. You can now submit the case.");
  };

  const openSpecialistModal = async () => {
    setPendingPriority(null);
    setRuralMessage("");
    setErrorMessage(null);
    setShowSpecialistModal(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "specialist");
    setSpecialists((data ?? []) as { id: string; full_name: string | null }[]);
  };

  const handleConfirmSubmitWithSpecialist = async () => {
    if (!patientId || !vitalsSaved || !pendingPriority || !selectedSpecialistId) {
      setErrorMessage("Select a specialist and priority.");
      return;
    }
    setSubmittingCase(true);
    resetMessages();

    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user) {
      setSubmittingCase(false);
      setErrorMessage("Unable to determine current user.");
      return;
    }

    const casePriority = pendingPriority === "emergency" ? "emergency" : "routine";

    const { data: caseRows, error: caseError } = await supabase
      .from("cases")
      .insert({
        patient_id: patientId,
        rural_doctor_id: userResult.user.id,
        specialist_id: selectedSpecialistId,
        priority: casePriority,
        status: "pending",
        assigned_at: new Date().toISOString(),
        rural_diagnosis_report: ruralDiagnosisReport.trim() || null,
      })
      .select("id");

    if (caseError) {
      setSubmittingCase(false);
      setErrorMessage(caseError.message);
      return;
    }

    const caseRow = caseRows?.[0] as { id: string } | undefined;
    if (!caseRow) {
      setSubmittingCase(false);
      setErrorMessage("Case creation failed.");
      return;
    }

    const { error: reqError } = await supabase.from("specialist_requests").insert({
      case_id: caseRow.id,
      rural_doctor_id: userResult.user.id,
      specialist_id: selectedSpecialistId,
      priority: casePriority,
      rural_message: ruralMessage.trim() || null,
    });

    if (reqError) {
      setSubmittingCase(false);
      setErrorMessage(reqError.message);
      return;
    }

    setSubmittingCase(false);
    setShowSpecialistModal(false);
    setPendingPriority(null);
    setSelectedSpecialistId(null);
    setRuralMessage("");
    setCaseSubmitted(true);
    setCurrentCaseId(caseRow.id);
    setWaitingCaseId(caseRow.id);
    setViewMode("waiting");
  };

  const handleFinalizeCase = async () => {
    if (!waitingCaseId) return;
    setFinalizing(true);
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/finalize-case/...`, {
      method: "POST",
    });
    setFinalizing(false);
    if (!response.ok) {
      setErrorMessage("Failed to finalize case.");
      return;
    }
    await fetchPastCases();
    setWaitingCaseId(null);
    resetCaseState();
    setViewMode("main");
    setStatusMessage("Patient case finalized");
  };

  const step2Enabled = patientSaved;
  const step3Enabled = patientSaved && vitalsSaved;
  const step4Enabled = patientSaved && vitalsSaved;
  const canSubmitCase = step4Enabled && !caseSubmitted;

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.user.id)
        .limit(1);
      const profile = data?.[0] as { full_name: string | null } | undefined;
      if (!profile) {
        console.error("Profile lookup returned empty for user", user.user.id);
      }
      setDoctorProfile(profile ? { full_name: profile.full_name } : null);
    };
    fetchProfile();
  }, []);

  const fetchPastCases = async () => {
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user) {
      setPastCasesList([]);
      return;
    }
    const { data } = await supabase
      .from("cases")
      .select(
        `
          id,
          priority,
          patient:patients (
            generated_patient_id
          )
        `
      )
      .eq("rural_doctor_id", userResult.user.id)
      .eq("status", "finalized")
      .order("created_at", { ascending: false });
    if (!data) {
      setPastCasesList([]);
      return;
    }
    setPastCasesList(data as CaseOption[]);
  };

  const fetchActiveCase = async () => {
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user) {
      return;
    }
    const { data } = await supabase
      .from("cases")
      .select("*")
      .eq("rural_doctor_id", userResult.user.id)
      .neq("status", "finalized")
      .order("created_at", { ascending: false })
      .limit(1);
    const activeCase = data?.[0] as { id?: string } | undefined;
    if (activeCase?.id) {
      setWaitingCaseId(activeCase.id);
      setViewMode("waiting");
    }
  };

  useEffect(() => {
    if (viewMode !== "past_cases") return;
    fetchPastCases();
  }, [viewMode]);

  useEffect(() => {
    fetchActiveCase();
    fetchPastCases();
  }, []);

  useEffect(() => {
    if (!waitingCaseId) {
      setWaitingRequest(null);
      return;
    }
    const fetchRequest = async () => {
      const { data: reqRows } = await supabase
        .from("specialist_requests")
        .select("id, rural_message, specialist_id, specialist_message, accepted_at, completed_at")
        .eq("case_id", waitingCaseId)
        .limit(1);
      const req = reqRows?.[0] as
        | {
            rural_message: string | null;
            specialist_id?: string;
            specialist_message?: string | null;
            accepted_at?: string | null;
            completed_at?: string | null;
          }
        | undefined;
      if (!req) {
        setWaitingRequest(null);
        return;
      }
      const specialistId = req.specialist_id;
      let profName: string | null = null;
      if (specialistId) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", specialistId)
          .limit(1);
        const profileRow = profileRows?.[0] as { full_name: string | null } | undefined;
        if (!profileRow) {
          console.error("Specialist profile lookup returned empty", specialistId);
        }
        profName = profileRow?.full_name ?? null;
      }
      const { data: caseRows } = await supabase
        .from("cases")
        .select("specialist_diagnosis_report, status")
        .eq("id", waitingCaseId)
        .limit(1);
      const caseRow = caseRows?.[0] as
        | { specialist_diagnosis_report?: string | null; status?: string | null }
        | undefined;
      if (!caseRow) {
        console.error("Waiting case lookup returned empty", waitingCaseId);
      }
      setWaitingRequest({
        specialist_name: profName,
        rural_message: req.rural_message,
        specialist_message: req.specialist_message ?? null,
        specialist_diagnosis_report: caseRow?.specialist_diagnosis_report ?? null,
        case_status: caseRow?.status ?? null,
        accepted_at: req.accepted_at ?? null,
        completed_at: req.completed_at ?? null,
      });
    };
    fetchRequest();
    const interval = setInterval(fetchRequest, 5000);
    return () => clearInterval(interval);
  }, [waitingCaseId]);

  useEffect(() => {
    if (viewMode !== "case_detail" || !viewingCaseId) {
      setCaseDetail(null);
      return;
    }
    const fetchDetail = async () => {
      const { data: caseRows } = await supabase
        .from("cases")
        .select(
          "patient_id, rural_diagnosis_report, specialist_diagnosis_report, follow_up_notes, status, ct_scan_required, bronchoscopy_required"
        )
        .eq("id", viewingCaseId)
        .limit(1);
      const c = caseRows?.[0] as
        | {
            patient_id: string;
            rural_diagnosis_report?: string | null;
            specialist_diagnosis_report?: string | null;
            follow_up_notes?: string | null;
            status?: string | null;
            ct_scan_required?: boolean | null;
            bronchoscopy_required?: boolean | null;
          }
        | undefined;
      if (!c) {
        console.error("Case detail lookup returned empty", viewingCaseId);
        return;
      }
      const { data: patientRows } = await supabase
        .from("patients")
        .select("name, generated_patient_id, age, gender, height_cm, weight_kg, smoking_history")
        .eq("id", (c as { patient_id: string }).patient_id)
        .limit(1);
      const p = patientRows?.[0] as
        | (Record<string, string | number | null> & { name?: string })
        | undefined;
      if (!p) {
        console.error("Case detail patient lookup returned empty", (c as { patient_id: string }).patient_id);
      }
      const { data: v } = await supabase
        .from("vitals")
        .select("*")
        .eq("patient_id", (c as { patient_id: string }).patient_id)
        .order("created_at", { ascending: false })
        .limit(1);
      const { data: s } = await supabase
        .from("spirometry")
        .select("*")
        .eq("patient_id", (c as { patient_id: string }).patient_id)
        .order("created_at", { ascending: false })
        .limit(1);
      const { data: x } = await supabase
        .from("xrays")
        .select("file_path")
        .eq("patient_id", (c as { patient_id: string }).patient_id);
      setCaseDetail({
        patient: p
          ? {
              name: (p as { name?: string }).name,
              generated_patient_id: p.generated_patient_id !== null && p.generated_patient_id !== undefined ? String(p.generated_patient_id) : null,
              age: (p as { age?: number | null } | undefined)?.age ?? null,
              gender: (p as { gender?: string | null } | undefined)?.gender ?? null,
              height_cm: (p as { height_cm?: number | null } | undefined)?.height_cm ?? null,
              weight_kg: (p as { weight_kg?: number | null } | undefined)?.weight_kg ?? null,
              smoking_history: (p as { smoking_history?: string | null } | undefined)?.smoking_history ?? null,
            }
          : undefined,
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
        xrays: (x ?? []).map((r) => ({ path: (r as { file_path: string }).file_path })),
        rural_diagnosis: (c as { rural_diagnosis_report?: string | null }).rural_diagnosis_report,
        specialist_diagnosis: (c as { specialist_diagnosis_report?: string | null }).specialist_diagnosis_report,
        finalized_report: null,
        follow_up_notes: (c as { follow_up_notes?: string | null }).follow_up_notes ?? null,
        case_status: (c as { status?: string | null }).status ?? null,
        ct_scan_required: (c as { ct_scan_required?: boolean | null }).ct_scan_required ?? null,
        bronchoscopy_required: (c as { bronchoscopy_required?: boolean | null }).bronchoscopy_required ?? null,
      });
    };
    fetchDetail();
  }, [viewMode, viewingCaseId]);

  const waitingStatus = waitingRequest
    ? waitingRequest.completed_at
      ? "completed"
      : waitingRequest.accepted_at
      ? "accepted"
      : "pending"
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Rural Doctor Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Register patients, capture vitals and spirometry, upload chest X-rays, and submit cases.
        </p>
        {doctorProfile && (
          <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm text-slate-300">
            <span className="font-medium text-slate-200">Doctor:</span> {doctorProfile.full_name ?? "-"}
          </div>
        )}
      </div>

      {viewMode === "main" && (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              resetCaseState();
              setViewMode("new_case");
            }}
            className="rounded-xl border-2 border-slate-600 bg-slate-800 px-6 py-4 text-left text-slate-100 hover:border-primary hover:bg-slate-800/80"
          >
            <span className="font-semibold">1. NEW PATIENT CASE</span>
            <p className="mt-1 text-xs text-slate-400">Register patient, vitals, X-ray, and submit to specialist.</p>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("past_cases")}
            className="rounded-xl border-2 border-slate-600 bg-slate-800 px-6 py-4 text-left text-slate-100 hover:border-primary hover:bg-slate-800/80"
          >
            <span className="font-semibold">2. PAST CASES</span>
            <p className="mt-1 text-xs text-slate-400">View previous cases and reports.</p>
          </button>
        </div>
      )}

      {viewMode === "waiting" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-slate-100">Loading / Waiting</h2>
          {!waitingRequest ? (
            <p className="mt-2 text-slate-400">Waiting for Specialist to accept the request.</p>
          ) : waitingStatus === "pending" ? (
            <p className="mt-2 text-slate-400">Waiting for Specialist to accept the request.</p>
          ) : waitingStatus === "accepted" ? (
            <div className="mt-2 space-y-2">
              <p className="text-slate-200">
                Dr. {waitingRequest.specialist_name ?? "Specialist"} accepted your request.
              </p>
              {waitingRequest.rural_message && (
                <p className="text-sm text-slate-400">Message: {waitingRequest.rural_message}</p>
              )}
              {waitingRequest.specialist_message && (
                <p className="text-sm text-slate-400">Specialist message: {waitingRequest.specialist_message}</p>
              )}
              <p className="text-slate-400">Status: Waiting for Specialist Report</p>
            </div>
          ) : waitingStatus === "completed" ? (
            <div className="mt-2 space-y-4">
              <p className="text-slate-200">Specialist has completed the diagnosis.</p>
              {waitingRequest.case_status === "finalized" && waitingRequest.specialist_diagnosis_report && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300">Specialist Diagnosis Report</h3>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
                    {waitingRequest.specialist_diagnosis_report}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && window.confirm("Finalize this patient case?")) {
                    handleFinalizeCase();
                  }
                }}
                disabled={finalizing}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-600 disabled:opacity-50"
              >
                {finalizing ? "Finalizing..." : "Finalize Patient Case"}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-slate-400">Waiting for Specialist to accept the request.</p>
          )}
          <button
            type="button"
            onClick={() => setViewMode("main")}
            className="mt-4 text-sm text-slate-400 hover:text-slate-200"
          >
            Back to dashboard
          </button>
        </div>
      )}

            {viewMode === "past_cases" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-4xl space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">Past Cases</h3>
              <button
                type="button"
                onClick={() => setViewMode("main")}
                className="text-sm text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <div className="rounded-xl border border-slate-700">
              <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 400 }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/80">
                      <th className="px-4 py-2 text-left text-slate-300">Index</th>
                      <th className="px-4 py-2 text-left text-slate-300">Patient ID</th>
                      <th className="px-4 py-2 text-left text-slate-300">Emergency / Normal</th>
                      <th className="px-4 py-2 text-left text-slate-300">View More Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastCasesList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-slate-400">
                          No completed cases available.
                        </td>
                      </tr>
                    ) : (
                      pastCasesList.map((c, i) => (
                        <tr key={c.id} className="border-b border-slate-700/50">
                          <td className="px-4 py-2 text-slate-300">{i + 1}</td>
                          <td className="px-4 py-2 text-slate-200">
                            {c.patient?.[0]?.generated_patient_id ?? "-"}
                          </td>
                          <td className="px-4 py-2 text-slate-200">
                            {c.priority === "emergency" ? "Emergency" : "Normal"}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                setViewingCaseId(c.id);
                                setViewMode("case_detail");
                              }}
                              className="text-primary hover:underline"
                            >
                              View More Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}{viewMode === "case_detail" && caseDetail && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setViewingCaseId(null);
              setViewMode("past_cases");
            }}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Back to Past Cases
          </button>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-semibold text-slate-100">{caseDetail.patient?.name ?? "Patient"}</h2>
            <p className="text-sm text-slate-400">Patient ID: {caseDetail.patient?.generated_patient_id ?? "-"}</p>
            <div className="mt-4 grid gap-4 text-sm">
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Patient Information</h3>
                <div className="mt-2 grid gap-1 text-slate-200">
                  <div>Name: {caseDetail.patient?.name ?? "-"}</div>
                  <div>Patient ID: {caseDetail.patient?.generated_patient_id ?? "-"}</div>
                  <div>
                    Age: {caseDetail.patient?.age ?? "-"} | Gender: {caseDetail.patient?.gender ?? "-"}
                  </div>
                  <div>
                    Height: {caseDetail.patient?.height_cm ?? "-"} | Weight: {caseDetail.patient?.weight_kg ?? "-"}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Clinical History</h3>
                <p className="mt-2 whitespace-pre-wrap text-slate-200">
                  {caseDetail.patient?.smoking_history ?? "-"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Vitals</h3>
                <div className="mt-2 grid gap-1 text-slate-200">
                  <div>SpO₂: {caseDetail.vitals?.spo2 == null ? "—" : `${caseDetail.vitals.spo2}%`}</div>
                  <div>
                    Respiratory Rate:{" "}
                    {caseDetail.vitals?.respiratory_rate == null
                      ? "—"
                      : `${caseDetail.vitals.respiratory_rate} breaths/min`}
                  </div>
                  <div>FVC: {caseDetail.spirometry?.fvc == null ? "—" : `${caseDetail.spirometry.fvc} L`}</div>
                  <div>FEV₁: {caseDetail.spirometry?.fev1 == null ? "—" : `${caseDetail.spirometry.fev1} L`}</div>
                  <div>
                    FEV₁ / FVC: {caseDetail.spirometry?.fev1_fvc == null ? "—" : `${caseDetail.spirometry.fev1_fvc}%`}
                  </div>
                  <div>
                    FEV₁ / FEV₆:{" "}
                    {caseDetail.spirometry?.fev1_fev6 == null ? "—" : `${caseDetail.spirometry.fev1_fev6}%`}
                  </div>
                  <div>PEF: {caseDetail.spirometry?.pef == null ? "—" : `${caseDetail.spirometry.pef} L/min`}</div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Rural Diagnosis</h3>
                <p className="mt-2 whitespace-pre-wrap text-slate-200">{caseDetail.rural_diagnosis ?? "-"}</p>
              </div>
              {caseDetail.case_status === "finalized" && (
                <div className="rounded-lg border border-slate-700 p-3">
                  <h3 className="text-sm font-medium text-slate-300">Specialist Diagnosis</h3>
                  <p className="mt-2 whitespace-pre-wrap text-slate-200">{caseDetail.specialist_diagnosis ?? "-"}</p>
                </div>
              )}
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Recommended Further Investigations</h3>
                <div className="mt-2 space-y-2 text-slate-200">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(caseDetail.ct_scan_required)} readOnly />
                    CT Scan
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(caseDetail.bronchoscopy_required)} readOnly />
                    Bronchoscopy
                  </label>
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">Follow-up Notes</h3>
                <p className="mt-2 whitespace-pre-wrap text-slate-200">{caseDetail.follow_up_notes ?? "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-medium text-slate-300">X-ray Image</h3>
                {caseDetail.xrays && caseDetail.xrays.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setXrayUrl(null);
                      setXrayPath(caseDetail.xrays?.[0]?.path ?? null);
                      setShowXrayModal(true);
                    }}
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

      {statusMessage && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-400">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      {viewMode === "new_case" && (
        <>
          <button
            type="button"
            onClick={() => setViewMode("main")}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Back to dashboard
          </button>
      {consentWarning && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-2 text-sm text-amber-400">
          Patient consent is required. Please check the consent checkbox before saving.
        </div>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <form
          onSubmit={handleCreatePatient}
          className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <h2 className="text-sm font-semibold text-slate-100">Step 1: Patient intake</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2 space-y-1">
              <label className="text-slate-200">Name</label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={patientForm.name}
                onChange={(e) => setPatientForm((p) => ({ ...p, name: e.target.value }))}
                required
                readOnly={patientSaved}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-slate-200">Phone number</label>
              <input
                type="tel"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={patientForm.phone_number}
                onChange={(e) => setPatientForm((p) => ({ ...p, phone_number: e.target.value }))}
                required
                readOnly={patientSaved}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">Age</label>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={patientForm.age}
                onChange={(e) => setPatientForm((p) => ({ ...p, age: e.target.value }))}
                required
                readOnly={patientSaved}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">Gender</label>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={patientForm.gender}
                onChange={(e) => setPatientForm((p) => ({ ...p, gender: e.target.value as Gender }))}
                disabled={patientSaved}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">Height (cm)</label>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={patientForm.height_cm}
                onChange={(e) => setPatientForm((p) => ({ ...p, height_cm: e.target.value }))}
                readOnly={patientSaved}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">Weight (kg)</label>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={patientForm.weight_kg}
                onChange={(e) => setPatientForm((p) => ({ ...p, weight_kg: e.target.value }))}
                readOnly={patientSaved}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-slate-200">Patient History</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={patientForm.smoking_history}
                onChange={(e) => setPatientForm((p) => ({ ...p, smoking_history: e.target.value }))}
                readOnly={patientSaved}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-slate-200">Diagnosis date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={patientForm.diagnosis_date}
                onChange={(e) => setPatientForm((p) => ({ ...p, diagnosis_date: e.target.value }))}
                required
                readOnly={patientSaved}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2 text-xs text-slate-300">
              <input
                id="consent"
                type="checkbox"
                checked={patientForm.consent_given}
                onChange={(e) => setPatientForm((p) => ({ ...p, consent_given: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-primary disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={patientSaved}
              />
              <label htmlFor="consent">
                Informed consent obtained for sharing data with specialist center.
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={!patientForm.consent_given || patientSaved || savingPatient}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingPatient ? "Saving..." : patientSaved ? "Saved" : "Save patient"}
          </button>
        </form>

        <form
          onSubmit={handleSaveVitalsAndSpirometry}
          className={`space-y-4 rounded-2xl border border-slate-800 p-4 ${step2Enabled ? "bg-slate-900/60" : "bg-slate-900/30 opacity-60"}`}
        >
          <h2 className="text-sm font-semibold text-slate-100">Step 2: Vitals & spirometry</h2>
          <p className="text-xs text-slate-400">Save patient first to enable this section.</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <label className="text-slate-200">SpO₂ (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={vitalsForm.spo2}
                onChange={(e) => setVitalsForm((p) => ({ ...p, spo2: e.target.value }))}
                required
                disabled={!step2Enabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">Respiratory Rate (breaths/min)</label>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={vitalsForm.respiratory_rate}
                onChange={(e) => setVitalsForm((p) => ({ ...p, respiratory_rate: e.target.value }))}
                required
                disabled={!step2Enabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">FVC (L)</label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={spirometryForm.fvc}
                onChange={(e) => setSpirometryForm((p) => ({ ...p, fvc: e.target.value }))}
                required
                disabled={!step2Enabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">FEV₁ (L)</label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={spirometryForm.fev1}
                onChange={(e) => setSpirometryForm((p) => ({ ...p, fev1: e.target.value }))}
                required
                disabled={!step2Enabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">FEV₁ / FVC (%)</label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={spirometryForm.fev1_fvc}
                onChange={(e) => setSpirometryForm((p) => ({ ...p, fev1_fvc: e.target.value }))}
                disabled={!step2Enabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">FEV₁ / FEV₆ (%)</label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={spirometryForm.fev1_fev6}
                onChange={(e) => setSpirometryForm((p) => ({ ...p, fev1_fev6: e.target.value }))}
                disabled={!step2Enabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">PEF (L/min)</label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={spirometryForm.pef}
                onChange={(e) => setSpirometryForm((p) => ({ ...p, pef: e.target.value }))}
                required
                disabled={!step2Enabled}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!step2Enabled || vitalsSaved || savingVitals}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingVitals ? "Saving..." : vitalsSaved ? "Saved" : "Save vitals & spirometry"}
          </button>
        </form>
      </section>

      <section
        className={`space-y-4 rounded-2xl border border-slate-800 p-4 ${step3Enabled ? "bg-slate-900/60" : "bg-slate-900/30 opacity-60"}`}
      >
        <h2 className="text-sm font-semibold text-slate-100">Step 3: X-ray upload</h2>
        <p className="text-xs text-slate-400">
          Save vitals and spirometry first. Only DICOM (.dcm) files accepted.
        </p>
        <form onSubmit={handleUploadXray} className="space-y-4">
          <div className="space-y-1 text-sm">
            <label className="text-slate-200">Chest X-ray (DICOM only)</label>
            <input
              type="file"
              accept={DICOM_ACCEPT}
              onChange={handleXrayFileChange}
              disabled={!step3Enabled || caseSubmitted}
              className="w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          {xrayValidationError && (
            <p className="text-sm text-amber-400">{xrayValidationError}</p>
          )}
          <button
            type="submit"
            disabled={!step3Enabled || !xrayFile || xrayUploaded || uploadingXray || caseSubmitted}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploadingXray ? "Uploading..." : xrayUploaded ? "Uploaded" : "Upload X-ray"}
          </button>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-slate-100">Doctor Diagnosis Report</h2>
        <textarea
          rows={4}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-60"
          value={ruralDiagnosisReport}
          onChange={(e) => setRuralDiagnosisReport(e.target.value)}
          placeholder="Clinical diagnosis, findings, notes..."
          readOnly={caseSubmitted}
        />
        <button
          type="button"
          onClick={() => canSubmitCase && openSpecialistModal()}
          disabled={!canSubmitCase || submittingCase}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submittingCase ? "Submitting..." : caseSubmitted ? "Submitted" : "Submit Patient Case"}
        </button>
      </section>

        </>
      )}

      {showSpecialistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Select Available Specialist</h3>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 mb-4"
              value={selectedSpecialistId ?? ""}
              onChange={(e) => setSelectedSpecialistId(e.target.value || null)}
            >
              <option value="">Choose specialist</option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id}>
                  Dr. {s.full_name ?? s.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Priority</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingPriority("emergency")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    pendingPriority === "emergency"
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-slate-600 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Emergency
                </button>
                <span className="text-xs text-slate-500">OR</span>
                <button
                  type="button"
                  onClick={() => {
                    setPendingPriority("normal");
                    setRuralMessage("");
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    pendingPriority === "normal"
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-600 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Normal
                </button>
              </div>
            </div>
            <label className="block text-sm text-slate-400 mb-1">Notify message (optional)</label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 mb-4"
              value={ruralMessage}
              onChange={(e) => setRuralMessage(e.target.value)}
              placeholder="Add a note for the specialist"
            />
            {errorMessage && <p className="text-sm text-red-400 mb-2">{errorMessage}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSpecialistModal(false);
                  setPendingPriority(null);
                  setSelectedSpecialistId(null);
                  setRuralMessage("");
                }}
                className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmitWithSpecialist}
                disabled={!selectedSpecialistId || !pendingPriority || submittingCase}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-600 disabled:opacity-50"
              >
                {submittingCase ? "Submitting..." : "Confirm"}
              </button>
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



