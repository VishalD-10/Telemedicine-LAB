﻿"use client";

import { FormEvent, useEffect, useRef, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, HeartPulse, History, Hospital, LogOut, Microscope, PlusCircle, Stethoscope, Wind } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import DiagnosisViewer from "@/components/rural/DiagnosisViewer";
import TreatmentViewer from "@/components/rural/TreatmentViewer";
import PrescriptionViewer from "@/components/rural/PrescriptionViewer";
import FollowupTracker from "@/components/rural/FollowupTracker";
import CaseTimeline from "@/components/shared/CaseTimeline";

type Gender = "male" | "female" | "other";

type CaseOption = {
  id: string;
  priority: string | null;
  created_at?: string | null;
  patient:
    | {
        generated_patient_id: string | null;
      }
    | {
        generated_patient_id: string | null;
      }[]
    | null;
};

type InProgressCaseOption = {
  id: string;
  status: "pending" | "accepted" | "completed" | string;
  created_at?: string | null;
  patient:
    | {
        name: string | null;
      }
    | {
        name: string | null;
      }[]
    | null;
  specialist_requests?:
    | {
        status: string | null;
        specialist:
          | {
              full_name: string | null;
            }
          | {
              full_name: string | null;
            }[]
          | null;
      }
    | {
        status: string | null;
        specialist:
          | {
              full_name: string | null;
            }
          | {
              full_name: string | null;
            }[]
          | null;
      }[]
    | null;
};

const DICOM_ACCEPT = ".dcm,application/dicom";
const DICOM_MIME = "application/dicom";
const DicomViewer = dynamic(() => import("@/app/components/DicomViewer"), { ssr: false });

function isDicomFile(file: File): boolean {
  const ext = file.name.toLowerCase().split(".").pop();
  const mime = file.type?.toLowerCase();
  return ext === "dcm" || mime === DICOM_MIME || mime === "application/x-dicom";
}

export default function RuralDashboardPage() {
  const router = useRouter();
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
    finalized_report?: string | null;
    follow_up_notes?: string | null;
    case_status?: string | null;
    specialist_name?: string | null;
    specialist_accepted_at?: string | null;
    specialist_completed_at?: string | null;
    case_created_at?: string | null;
    diagnosis?: {
      diagnosis_name?: string | null;
      severity?: string | null;
      specialist_notes?: string | null;
      created_at?: string | null;
    } | null;
    treatment?: {
      treatment_title?: string | null;
      medications?: string | null;
      inhaler_therapy?: string | null;
      oxygen_therapy?: string | null;
      pulmonary_rehabilitation?: string | null;
      lifestyle_recommendations?: string | null;
      referral_recommendation?: string | null;
      created_at?: string | null;
    } | null;
    prescriptions?: {
      id: string;
      medication: string | null;
      dosage: string | null;
      frequency: string | null;
      duration: string | null;
      instructions: string | null;
    }[];
    followup?: {
      scheduled_date?: string | null;
      notes?: string | null;
      diagnostic_procedures?: string[] | null;
      created_at?: string | null;
    } | null;
    specialist_report?: {
      specialist_name: string | null;
      diagnosis:
        | {
            primary_diagnosis: string | null;
            severity: string | null;
            clinical_notes: string | null;
            created_at: string | null;
          }
        | null;
      treatment:
        | {
            medications: string | null;
            inhaler_therapy: string | null;
            oxygen_therapy: boolean | null;
            pulmonary_rehabilitation: string | null;
            lifestyle_recommendations: string | null;
            referral_recommendation: string | null;
            created_at: string | null;
          }
        | null;
      prescriptions: {
        id: string;
        medication: string | null;
        dosage: string | null;
        frequency: string | null;
        duration: string | null;
        instructions: string | null;
      }[];
      followup:
        | {
            followup_date: string | null;
            created_at: string | null;
            diagnostic_procedures: string[] | null;
          }
        | null;
      timeline: {
        case_created_at: string | null;
        specialist_accepted_at: string | null;
        diagnosis_submitted_at: string | null;
        treatment_generated_at: string | null;
        followup_scheduled_at: string | null;
        case_finalized_at: string | null;
      };
      specialist_accepted_at: string | null;
      specialist_completed_at: string | null;
      case_created_at: string | null;
    } | null;
  } | null>(null);
  const [pastCaseLoading, setPastCaseLoading] = useState(false);
  const [emergencyCaseMap, setEmergencyCaseMap] = useState<Record<string, boolean>>({});
  const [waitingCaseClinicalDetail, setWaitingCaseClinicalDetail] = useState<{
    specialist_name?: string | null;
    diagnosis?: {
      diagnosis_name?: string | null;
      severity?: string | null;
      specialist_notes?: string | null;
      created_at?: string | null;
    } | null;
    treatment?: {
      medications?: string | null;
      inhaler_therapy?: string | null;
      oxygen_therapy?: boolean | null;
      pulmonary_rehabilitation?: string | null;
      lifestyle_recommendations?: string | null;
      referral_recommendation?: string | null;
      created_at?: string | null;
    } | null;
    prescriptions?: {
      id: string;
      medication: string | null;
      dosage: string | null;
      frequency: string | null;
      duration: string | null;
      instructions: string | null;
    }[];
    followup?: {
      followup_date?: string | null;
      created_at?: string | null;
      diagnostic_procedures?: string[];
    } | null;
    timeline?: {
      case_created_at?: string | null;
      specialist_accepted_at?: string | null;
      diagnosis_submitted_at?: string | null;
      treatment_generated_at?: string | null;
      followup_scheduled_at?: string | null;
      case_finalized_at?: string | null;
    };
  } | null>(null);
  const [waitingReport, setWaitingReport] = useState<{
    diagnosis?: Record<string, unknown> | null;
    treatment?: Record<string, unknown> | null;
    prescriptions?: Record<string, unknown>[];
    followup?: Record<string, unknown> | null;
    furtherDiagnostics?: string[];
  } | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [caseResolved, setCaseResolved] = useState(false);
  const completedNoticeRef = useRef<string | null>(null);

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
    systolic_bp: "",
    diastolic_bp: "",
    temperature: "",
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
  const [view, setView] = useState<"main" | "new_case" | "in_progress" | "past_cases" | "waiting" | "case_detail">("main");
  const [currentStep, setCurrentStep] = useState(1);
  const [pastCasesSearch, setPastCasesSearch] = useState("");
  const [pastCasesFilter, setPastCasesFilter] = useState<"All Cases" | "Emergency" | "Normal" | "Completed">("All Cases");
  const [inProgressCases, setInProgressCases] = useState<InProgressCaseOption[]>([]);
  const steps = [
    { title: "Patient Details" },
    { title: "Vitals & Spirometry" },
    { title: "X-ray Upload" },
    { title: "Diagnosis & Request" },
    { title: "Select Specialist" },
  ];

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
    setWaitingCaseClinicalDetail(null);
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
    setVitalsForm({ spo2: "", respiratory_rate: "", systolic_bp: "", diastolic_bp: "", temperature: "" });
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
      .select("id, generated_patient_id");

    setSavingPatient(false);

    const patient = patientRows?.[0] as { id?: string; generated_patient_id?: string | null } | undefined;
    const generatedPatientId =
      patient?.generated_patient_id !== null && patient?.generated_patient_id !== undefined
        ? String(patient.generated_patient_id)
        : null;
    if (patientError || !patient || !patient.id) {
      setErrorMessage(patientError?.message ?? "Patient insert failed.");
      return;
    }
    setPatientId(patient.id);
    setPatientCode(generatedPatientId);
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
      systolic_bp: vitalsForm.systolic_bp ? Number(vitalsForm.systolic_bp) : null,
      diastolic_bp: vitalsForm.diastolic_bp ? Number(vitalsForm.diastolic_bp) : null,
      temperature_f: vitalsForm.temperature ? Number(vitalsForm.temperature) : null,
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

    setVitalsForm((prev) => ({ ...prev, systolic_bp: "", diastolic_bp: "", temperature: "" }));
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
    setWaitingRequest(null);
    setWaitingReport(null);
    setWaitingCaseClinicalDetail(null);
    setWaitingCaseId(caseRow.id);
    setCaseResolved(false);
    setView("waiting");
  };

  const handleFinalizeCase = async () => {
    if (!waitingCaseId) return;
    setFinalizing(true);
    const { error } = await supabase.from("cases").update({ status: "finalized" }).eq("id", waitingCaseId);
    setFinalizing(false);
    if (error) {
      setErrorMessage("Failed to finalize case.");
      return;
    }
    await fetchPastCases();
    setWaitingCaseId(null);
    resetCaseState();
    setView("main");
    setStatusMessage("Patient case finalized");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
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
      setEmergencyCaseMap({});
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
      setEmergencyCaseMap({});
      return;
    }
    setPastCasesList(data as CaseOption[]);
    const caseIds = (data as CaseOption[]).map((row) => row.id);
    if (caseIds.length === 0) {
      setEmergencyCaseMap({});
      return;
    }
    const { data: reqRows } = await supabase
      .from("specialist_requests")
      .select("case_id, priority")
      .in("case_id", caseIds);
    const map: Record<string, boolean> = {};
    (reqRows ?? []).forEach((row) => {
      const parsed = row as { case_id?: string; priority?: string | null };
      if (parsed.case_id) {
        map[parsed.case_id] = parsed.priority === "emergency";
      }
    });
    setEmergencyCaseMap(map);
  };

  const fetchInProgressCases = async () => {
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user) {
      setInProgressCases([]);
      return;
    }

    const { data } = await supabase
      .from("cases")
      .select(
        `
          id,
          status,
          created_at,
          patient:patients (
            name
          ),
          specialist_requests (
            status,
            specialist:profiles (
              full_name
            )
          )
        `
      )
      .eq("rural_doctor_id", userResult.user.id)
      .neq("status", "finalized")
      .order("created_at", { ascending: false });

    setInProgressCases((data ?? []) as InProgressCaseOption[]);
  };

  const fetchActiveCase = async () => {
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user) return;

    const { data } = await supabase
      .from("cases")
      .select("id,status")
      .eq("rural_doctor_id", userResult.user.id)
      .in("status", ["pending", "accepted", "reviewing", "completed"])
      .order("created_at", { ascending: false })
      .limit(1);

    const activeCase = data?.[0];

    if (activeCase?.id) {
      setWaitingCaseId(activeCase.id);
    }
  };

  const loadCase = async () => {
    setCaseResolved(false);
    await fetchActiveCase();
    await fetchInProgressCases();
    await fetchPastCases();
    setCaseResolved(true);
  };

  const refetchCase = async () => {
    await loadCase();
  };

  const loadClinicalPanelsForCase = async (caseId: string, caseStatus?: string | null) => {
    if (caseStatus !== "completed" && caseStatus !== "finalized") {
      return null;
    }
    const [{ data: diagnosisRows }, { data: treatmentRows }, { data: prescriptionRows }, { data: followupRows }, { data: caseMetaRows }, { data: reqRows }] =
      await Promise.all([
        supabase.from("case_diagnoses").select("diagnosis_name, severity, specialist_notes, created_at").eq("case_id", caseId).order("created_at", { ascending: false }).limit(1),
        supabase.from("case_treatment_plans").select("medications, inhaler_therapy, oxygen_therapy, pulmonary_rehabilitation, lifestyle_recommendations, referral_recommendation, created_at").eq("case_id", caseId).order("created_at", { ascending: false }).limit(1),
        supabase.from("prescriptions").select("medication_name, dosage, frequency, duration_days, instructions").eq("case_id", caseId).order("created_at", { ascending: true }),
        supabase.from("followups").select("scheduled_date, diagnostic_procedures, created_at").eq("case_id", caseId).order("created_at", { ascending: false }).limit(1),
        supabase.from("cases").select("created_at").eq("id", caseId).limit(1),
        supabase.from("specialist_requests").select("accepted_at, completed_at, specialist_id").eq("case_id", caseId).limit(1),
      ]);

    const req = (reqRows?.[0] ?? null) as { accepted_at?: string | null; completed_at?: string | null; specialist_id?: string | null } | null;
    let specialistName: string | null = null;
    if (req?.specialist_id) {
      const { data: specialistRows } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", req.specialist_id)
        .limit(1);
      specialistName = (specialistRows?.[0] as { full_name?: string | null } | undefined)?.full_name ?? null;
    }

    const diagnosis = (diagnosisRows?.[0] ?? null) as Record<string, unknown> | null;
    const treatment = (treatmentRows?.[0] ?? null) as Record<string, unknown> | null;
    const followup = (followupRows?.[0] ?? null) as Record<string, unknown> | null;
    const caseMeta = (caseMetaRows?.[0] ?? null) as { created_at?: string | null } | null;
    const prescriptions = (prescriptionRows ?? []) as Record<string, unknown>[];

    const diagnosticsValue = followup?.diagnostic_procedures;
    const diagnosticProcedures = Array.isArray(diagnosticsValue)
      ? diagnosticsValue.map((item) => String(item)).filter(Boolean)
      : typeof diagnosticsValue === "string"
        ? diagnosticsValue.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)
        : [];

    return {
      specialist_name: specialistName,
      diagnosis: diagnosis
        ? {
            primary_diagnosis: (diagnosis.diagnosis_name as string | undefined) ?? null,
            severity: (diagnosis.severity as string | undefined) ?? null,
            clinical_notes: (diagnosis.specialist_notes as string | undefined) ?? null,
            created_at: (diagnosis.created_at as string | undefined) ?? null,
          }
        : null,
      treatment: treatment
        ? {
            medications: (treatment.medications as string | undefined) ?? null,
            inhaler_therapy: (treatment.inhaler_therapy as string | undefined) ?? null,
            oxygen_therapy: (treatment.oxygen_therapy as boolean | undefined) ?? null,
            pulmonary_rehabilitation: (treatment.pulmonary_rehabilitation as string | undefined) ?? null,
            lifestyle_recommendations: (treatment.lifestyle_recommendations as string | undefined) ?? null,
            referral_recommendation: (treatment.referral_recommendation as string | undefined) ?? null,
            created_at: (treatment.created_at as string | undefined) ?? null,
          }
        : null,
      prescriptions: prescriptions.map((row, index) => ({
        id: String((row.id as string | number | undefined) ?? `rx-${index}`),
        medication: (row.medication_name as string | undefined) ?? null,
        dosage: (row.dosage as string | undefined) ?? null,
        frequency: (row.frequency as string | undefined) ?? (row.instructions as string | undefined) ?? null,
        duration: (row.duration_days as string | number | undefined) != null ? String(row.duration_days) : null,
        instructions: (row.instructions as string | undefined) ?? null,
      })),
      followup: followup
        ? {
            followup_date: (followup.scheduled_date as string | undefined) ?? null,
            created_at: (followup.created_at as string | undefined) ?? null,
            diagnostic_procedures: diagnosticProcedures,
          }
        : null,
      timeline: {
        case_created_at: caseMeta?.created_at ?? null,
        specialist_accepted_at: req?.accepted_at ?? null,
        diagnosis_submitted_at: (diagnosis?.created_at as string | undefined) ?? null,
        treatment_generated_at: (treatment?.created_at as string | undefined) ?? null,
        followup_scheduled_at: (followup?.created_at as string | undefined) ?? null,
        case_finalized_at: caseStatus === "finalized" ? req?.completed_at ?? null : null,
      },
      specialist_accepted_at: req?.accepted_at ?? null,
      specialist_completed_at: req?.completed_at ?? null,
      case_created_at: caseMeta?.created_at ?? null,
    };
  };

  useEffect(() => {
    if (view !== "past_cases") return;
    fetchPastCases();
  }, [view]);

  useEffect(() => {
    if (view !== "in_progress") return;
    fetchInProgressCases();
  }, [view]);

  useEffect(() => {
    const loadBase = async () => {
      await loadCase();
    };
    loadBase();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("case-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases" },
        () => {
          refetchCase();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_diagnoses" },
        () => {
          refetchCase();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_treatment_plans" },
        () => {
          refetchCase();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prescriptions" },
        () => {
          refetchCase();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "followups" },
        () => {
          refetchCase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (view !== "waiting" || !waitingCaseId) return;
    completedNoticeRef.current = null;
    let interval: NodeJS.Timeout;
    const fetchRequest = async () => {
      setCaseResolved(false);
      try {
        const { data: request } = await supabase
          .from("specialist_requests")
          .select("id, status, specialist_message, accepted_at, completed_at")
          .eq("case_id", waitingCaseId)
          .maybeSingle();
        if (!request) {
          setWaitingRequest(null);
          setWaitingReport(null);
          return;
        }
        const { data: caseRows } = await supabase
          .from("cases")
          .select("id") // status intentionally not used; lifecycle sourced from specialist_requests
          .eq("id", waitingCaseId)
          .limit(1);
        const caseRow = caseRows?.[0];
        if (!caseRow) {
          console.error("Waiting case lookup returned empty", waitingCaseId);
        }
        const [diagnosisRes, treatmentRes, prescriptionRes, followupRes] = await Promise.all([
          supabase.from("case_diagnoses").select("diagnosis_name, severity, specialist_notes").eq("case_id", waitingCaseId).single(),
          supabase.from("case_treatment_plans").select("treatment_title, medications, inhaler_therapy, oxygen_therapy, pulmonary_rehabilitation, lifestyle_recommendations, referral_recommendation").eq("case_id", waitingCaseId).single(),
          supabase.from("prescriptions").select("medication_name, dosage, frequency, duration_days, instructions").eq("case_id", waitingCaseId),
          supabase.from("followups").select("scheduled_date, notes, diagnostic_procedures").eq("case_id", waitingCaseId).single(),
        ]);
        const diagnosticsValue = (followupRes.data as { diagnostic_procedures?: unknown } | null)?.diagnostic_procedures;
        const furtherDiagnostics = Array.isArray(diagnosticsValue)
          ? diagnosticsValue.map((item) => String(item)).filter(Boolean)
          : typeof diagnosticsValue === "string"
            ? diagnosticsValue.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)
            : [];
        setWaitingReport({
          diagnosis: diagnosisRes.data ?? null,
          treatment: treatmentRes.data ?? null,
          prescriptions: prescriptionRes.data ?? [],
          followup: followupRes.data ?? null,
          furtherDiagnostics,
        });
        const completedAt = (request as { completed_at?: string | null })?.completed_at ?? null;
        const detail = await loadClinicalPanelsForCase(
          waitingCaseId,
          completedAt ? "completed" : null
        );
        setWaitingRequest({
          specialist_name: null,
          rural_message: null,
          specialist_message: (request as { specialist_message?: string | null })?.specialist_message ?? null,
          accepted_at: (request as { accepted_at?: string | null })?.accepted_at ?? null,
          completed_at: (request as { completed_at?: string | null })?.completed_at ?? null,
        });
        setWaitingCaseClinicalDetail(detail);
        if (completedAt && view !== "waiting" && completedNoticeRef.current !== waitingCaseId) {
          setStatusMessage("Specialist has completed the case");
          completedNoticeRef.current = waitingCaseId;
        }
      } finally {
        setCaseResolved(true);
      }
    };
    fetchRequest();
    interval = setInterval(fetchRequest, 5000);
    const channel = supabase
      .channel(`case-updates-${waitingCaseId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "specialist_requests",
          filter: `case_id=eq.${waitingCaseId}`,
        },
        () => {
          fetchRequest();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cases",
          filter: `id=eq.${waitingCaseId}`,
        },
        () => {
          fetchRequest();
        }
      )
      .subscribe();
    return () => {
      clearInterval(interval);
      setWaitingReport(null);
      supabase.removeChannel(channel);
    };
  }, [view, waitingCaseId]);

  useEffect(() => {
    if (view !== "case_detail" || !viewingCaseId) {
      setCaseDetail(null);
      return;
    }
    const fetchDetail = async () => {
      setPastCaseLoading(true);
      try {
        const { data: caseRows } = await supabase
          .from("cases")
          .select("id, patient_id, specialist_id, created_at, status, rural_diagnosis_report")
          .eq("id", viewingCaseId)
          .limit(1);
        const c = caseRows?.[0] as { id?: string; patient_id: string; specialist_id?: string | null; created_at?: string | null; status?: string | null; rural_diagnosis_report?: string | null } | undefined;
        if (!c) {
          console.error("Case detail lookup returned empty", viewingCaseId);
          setCaseDetail(null);
          return;
        }
        const caseId = c.id ?? viewingCaseId;
        const patientId = c.patient_id;
        const { data: diagnosisRows } = await supabase
          .from("case_diagnoses")
          .select("diagnosis_name, severity, specialist_notes, created_at")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false })
          .limit(1);
        const diagnosis = diagnosisRows?.[0] ?? null;

        const { data: treatmentRows } = await supabase
          .from("case_treatment_plans")
          .select("medications, inhaler_therapy, oxygen_therapy, pulmonary_rehabilitation, lifestyle_recommendations, referral_recommendation, created_at")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false })
          .limit(1);
        const treatment = treatmentRows?.[0] ?? null;

        const { data: prescriptions } = await supabase
          .from("prescriptions")
          .select("medication_name, dosage, frequency, duration_days, instructions")
          .eq("case_id", caseId)
          .order("created_at", { ascending: true });

        const { data: followupRows } = await supabase
          .from("followups")
          .select("scheduled_date, notes, diagnostic_procedures, created_at")
          .eq("case_id", caseId);
        const followup = followupRows?.[0] ?? null;
        const diagnosticsValue = (followup as { diagnostic_procedures?: unknown } | null)?.diagnostic_procedures;
        const furtherDiagnostics = Array.isArray(diagnosticsValue)
          ? diagnosticsValue.map((item) => String(item)).filter(Boolean)
          : typeof diagnosticsValue === "string"
            ? diagnosticsValue.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)
            : [];

        const [
          patientRes,
          vitalsRes,
          spirometryRes,
          xrayRes,
          specialistRes,
        ] = await Promise.all([
          supabase.from("patients").select("name, generated_patient_id, age, gender, height_cm, weight_kg, smoking_history").eq("id", patientId).single(),
          supabase.from("vitals").select("spo2, respiratory_rate, systolic_bp, diastolic_bp, temperature_f, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1),
          supabase.from("spirometry").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1),
          supabase.from("xrays").select("file_path, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1),
          c.specialist_id ? supabase.from("profiles").select("full_name").eq("id", c.specialist_id).single() : Promise.resolve({ data: null }),
        ]);
        const p = patientRes.data as { name?: string; generated_patient_id?: string | null; age?: number | null; gender?: string | null; height_cm?: number | null; weight_kg?: number | null; smoking_history?: string | null } | null;
        const v = vitalsRes.data;
        const s = spirometryRes.data;
        const x = xrayRes.data;
        const clinicalPanels = await loadClinicalPanelsForCase(viewingCaseId, (c as { status?: string | null }).status ?? null);
        const specialistNameFromCase = (specialistRes as { data?: { full_name?: string | null } | null })?.data?.full_name ?? null;
        setCaseDetail({
          patient: p
            ? {
                name: p.name,
                generated_patient_id: p.generated_patient_id ?? null,
                age: p.age ?? null,
                gender: p.gender ?? null,
                height_cm: p.height_cm ?? null,
                weight_kg: p.weight_kg ?? null,
                smoking_history: p.smoking_history ?? null,
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
          rural_diagnosis: c.rural_diagnosis_report ?? null,
          finalized_report: null,
          case_status: c.status ?? null,
          specialist_name: specialistNameFromCase ?? clinicalPanels?.specialist_name ?? null,
          specialist_accepted_at: clinicalPanels?.specialist_accepted_at ?? null,
          specialist_completed_at: clinicalPanels?.specialist_completed_at ?? null,
          case_created_at: c.created_at ?? clinicalPanels?.case_created_at ?? null,
          diagnosis: (diagnosis as { diagnosis_name?: string | null; severity?: string | null; specialist_notes?: string | null; created_at?: string | null } | null)
            ? {
                diagnosis_name: (diagnosis as { diagnosis_name?: string | null }).diagnosis_name ?? null,
                severity: (diagnosis as { severity?: string | null }).severity ?? null,
                specialist_notes: (diagnosis as { specialist_notes?: string | null }).specialist_notes ?? null,
                created_at: (diagnosis as { created_at?: string | null }).created_at ?? null,
              }
            : null,
          treatment: (treatment as { medications?: string | null; inhaler_therapy?: string | null; oxygen_therapy?: boolean | null; pulmonary_rehabilitation?: string | null; lifestyle_recommendations?: string | null; referral_recommendation?: string | null; created_at?: string | null } | null)
            ? {
                treatment_title: null,
                medications: treatment?.medications ?? null,
                inhaler_therapy: treatment?.inhaler_therapy ?? null,
                oxygen_therapy:
                  treatment?.oxygen_therapy === true
                    ? "Required"
                    : treatment?.oxygen_therapy === false
                      ? "Not Required"
                      : null,
                pulmonary_rehabilitation: treatment?.pulmonary_rehabilitation ?? null,
                lifestyle_recommendations: treatment?.lifestyle_recommendations ?? null,
                referral_recommendation: treatment?.referral_recommendation ?? null,
                created_at: treatment?.created_at ?? null,
              }
            : null,
          prescriptions:
            (prescriptions as { medication_name?: string | null; dosage?: string | null; frequency?: string | null; duration_days?: string | number | null; instructions?: string | null }[] | null)?.map((row, idx) => ({
              id: `rx-${idx}`,
              medication: row.medication_name ?? null,
              dosage: row.dosage ?? null,
              frequency: row.frequency ?? row.instructions ?? null,
              duration: row.duration_days != null ? String(row.duration_days) : null,
              instructions: row.instructions ?? null,
            })) ?? [],
          followup: (followup as { scheduled_date?: string | null; notes?: string | null; diagnostic_procedures?: string[] | null; created_at?: string | null } | null)
            ? {
                scheduled_date: (followup as { scheduled_date?: string | null }).scheduled_date ?? null,
                notes: (followup as { notes?: string | null }).notes ?? null,
                diagnostic_procedures: furtherDiagnostics,
                created_at: (followup as { created_at?: string | null }).created_at ?? null,
              }
            : null,
          specialist_report: clinicalPanels ?? null,
        });
      } finally {
        setPastCaseLoading(false);
      }
    };
    fetchDetail();
  }, [view, viewingCaseId]);

  type WaitingStatus = "pending" | "accepted" | "completed" | null;
  const waitingStatus: WaitingStatus =
    caseResolved
      ? waitingRequest?.completed_at
        ? "completed"
        : waitingRequest?.accepted_at
          ? "accepted"
          : waitingRequest
            ? "pending"
            : null
      : null;

  const filteredPastCases = pastCasesList.filter((c) => {
    const patientCode = Array.isArray(c.patient) ? c.patient[0]?.generated_patient_id ?? "" : c.patient?.generated_patient_id ?? "";
    const normalized = patientCode.toLowerCase();
    const searchOk = normalized.includes(pastCasesSearch.trim().toLowerCase());
    const filterOk =
      pastCasesFilter === "All Cases" ||
      pastCasesFilter === "Completed" ||
      (pastCasesFilter === "Emergency" && c.priority === "emergency") ||
      (pastCasesFilter === "Normal" && c.priority !== "emergency");
    return searchOk && filterOk;
  });

  const doctorName = doctorProfile?.full_name ?? "Doctor";
  const isEmergencyViewingCase = viewingCaseId ? Boolean(emergencyCaseMap[viewingCaseId]) : false;
  const handleOpenNewCase = () => {
    resetCaseState();
    setCurrentStep(1);
    setView("new_case");
  };
  const handleOpenInProgressCases = () => setView("in_progress");
  const handleOpenPastCases = () => setView("past_cases");
  const floatingIcons = [
    { Icon: HeartPulse, className: "top-[8%] left-[8%]", delay: "0s" },
    { Icon: Stethoscope, className: "top-[18%] right-[16%]", delay: "1.2s" },
    { Icon: Microscope, className: "bottom-[22%] left-[16%]", delay: "2.4s" },
    { Icon: Hospital, className: "bottom-[12%] right-[12%]", delay: "3.6s" },
    { Icon: Activity, className: "top-[42%] left-[28%]", delay: "4.8s" },
    { Icon: Wind, className: "top-[52%] right-[28%]", delay: "5.4s" },
  ] as const;

  return (
    <div className="flex min-h-screen will-change-auto bg-gradient-to-br from-blue-50 to-blue-100 text-slate-900">
      <aside className="hidden w-64 min-h-screen flex-col justify-between rounded-r-3xl bg-gradient-to-b from-blue-600 to-blue-500 p-6 text-white shadow-xl md:fixed md:left-0 md:top-0 md:flex">
        <div className="space-y-8">
          <h1 className="text-xl font-semibold tracking-wide">Tele-Pulmonology</h1>
          <nav className="space-y-3">
            <p className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">Dashboard</p>
            <button
              type="button"
              onClick={handleOpenNewCase}
              className={`flex w-full items-center gap-3 rounded-xl bg-white/20 px-4 py-3 backdrop-blur-md border border-white/20 hover:bg-white/30 transition ${
                view === "new_case"
                  ? "ring-2 ring-white/40"
                  : ""
              }`}
            >
              <PlusCircle className="h-4 w-4" />
              <span>New Cases</span>
            </button>
            <button
              type="button"
              onClick={handleOpenInProgressCases}
              className={`flex w-full items-center gap-3 rounded-xl bg-white/20 px-4 py-3 backdrop-blur-md border border-white/20 hover:bg-white/30 transition ${
                view === "in_progress" || view === "waiting"
                  ? "ring-2 ring-white/40"
                  : ""
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>In Progress</span>
            </button>
            <button
              type="button"
              onClick={handleOpenPastCases}
              className={`flex w-full items-center gap-3 rounded-xl bg-white/20 px-4 py-3 backdrop-blur-md border border-white/20 hover:bg-white/30 transition ${
                view === "past_cases" || view === "case_detail"
                  ? "ring-2 ring-white/40"
                  : ""
              }`}
            >
              <History className="h-4 w-4" />
              <span>Past Cases</span>
            </button>
          </nav>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/20 bg-white/20 p-4 text-white backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/30 text-sm font-semibold text-white">
                {doctorName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">Dr. {doctorName}</p>
                <button type="button" onClick={() => setView("main")} className="text-xs text-blue-100 hover:text-white">
                  View Profile
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={handleLogout} className="logout-btn flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 md:ml-64 md:p-10">
        <div className="mb-6 space-y-3 md:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 flex items-center justify-between">
              <h1 className="text-base font-semibold tracking-wide">Tele-Pulmonology</h1>
              <button type="button" onClick={handleLogout} className="flex items-center gap-2 text-red-500 transition hover:text-red-600">
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleOpenNewCase}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 transition ${
                  view === "new_case"
                    ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                    : "bg-blue-500/10 text-slate-600 dark:text-slate-300"
                }`}
              >
                <PlusCircle className="h-4 w-4" />
                <span className="text-sm">New Cases</span>
              </button>
              <button
                type="button"
                onClick={handleOpenInProgressCases}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 transition ${
                  view === "in_progress" || view === "waiting"
                    ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                    : "bg-blue-500/10 text-slate-600 dark:text-slate-300"
                }`}
              >
                <Activity className="h-4 w-4" />
                <span className="text-sm">In Progress</span>
              </button>
              <button
                type="button"
                onClick={handleOpenPastCases}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 transition ${
                  view === "past_cases" || view === "case_detail"
                    ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                    : "bg-blue-500/10 text-slate-600 dark:text-slate-300"
                }`}
              >
                <History className="h-4 w-4" />
                <span className="text-sm">Past Cases</span>
              </button>
            </div>
          </div>
        </div>

        {view === "main" && (
          <div className="relative flex h-full min-h-[70vh] items-center justify-center overflow-hidden rounded-2xl border border-white/40 bg-white/70 text-center shadow-lg backdrop-blur-lg">
            {floatingIcons.map(({ Icon, className, delay }, index) => (
              <Icon
                key={index}
                className={`pointer-events-none absolute h-16 w-16 opacity-10 ${className}`}
                style={{ animation: `float 6s ease-in-out ${delay} infinite` }}
              />
            ))}
            <div className="relative z-10 max-w-xl space-y-3 px-6 text-center">
              <div className="text-3xl">👋</div>
              <h2 className="text-3xl font-semibold">Welcome back, Dr. {doctorName}</h2>
              <p className="mx-auto mt-3 max-w-md text-slate-500">
                Select an option from the dashboard to begin registering a patient case and connect with a specialist.
              </p>
              {waitingCaseId && (
                <button
                  type="button"
                  onClick={() => setView("waiting")}
                  className="mt-6 rounded-xl bg-blue-500/20 px-4 py-2 text-sm text-blue-600 transition hover:bg-blue-500/30 dark:text-blue-400"
                >
                  Resume Pending Case Review
                </button>
              )}
            </div>
          </div>
        )}

      {view === "in_progress" && (
        <div className="max-w-6xl mx-auto p-8">
          <h1 className="mb-6 text-2xl font-semibold">In Progress Cases</h1>
          <div className="space-y-4">
            {inProgressCases.length === 0 ? (
              <div className="py-20 text-center text-gray-500">No in-progress cases available.</div>
            ) : (
              inProgressCases.map((caseItem, index) => {
                const patientName = Array.isArray(caseItem.patient)
                  ? caseItem.patient[0]?.name ?? "Unknown Patient"
                  : caseItem.patient?.name ?? "Unknown Patient";
                const status = caseItem.status;
                const statusBadgeClass =
                  status === "pending"
                    ? "bg-amber-100 text-amber-700"
                    : status === "accepted"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-green-100 text-green-700";
                return (
                  <div
                    key={caseItem.id}
                    className="flex items-center justify-between rounded-xl border border-white/30 bg-white/40 p-6 shadow-md backdrop-blur-lg"
                  >
                    <div>
                      <p className="text-sm text-gray-500">Case #{index + 1}</p>
                      <h2 className="text-lg font-semibold">{patientName}</h2>
                      <p className="text-sm text-gray-600">
                        Created {caseItem.created_at ? new Date(caseItem.created_at).toLocaleDateString() : "-"}
                      </p>
                    </div>
                    <div>
                      <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${statusBadgeClass}`}>
                        {status}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setWaitingCaseId(caseItem.id);
                        setView("waiting");
                      }}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Continue
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {view === "waiting" && (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-200 via-blue-300 to-blue-400 opacity-60"></div>
          <div className="relative z-10">
            <div className="w-[650px] rounded-2xl border border-white/30 bg-white/40 p-10 text-center shadow-2xl backdrop-blur-xl">
            {waitingStatus === null && (
              <>
                <h2 className="text-xl font-semibold">Loading case status...</h2>
                <div className="mt-6 flex justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-b-4 border-blue-600"></div>
                </div>
              </>
            )}
            {waitingStatus === "pending" ? (
              <>
                <p className="text-sm font-medium text-gray-600">Waiting for the specialist</p>
                  <h2 className="mt-3 text-2xl font-semibold">Dr. {waitingRequest?.specialist_name ?? waitingCaseClinicalDetail?.specialist_name ?? "Specialist"}</h2>
                  <p className="mt-1 text-gray-700">to accept your request doctor</p>
                  <div className="mt-6 flex justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-b-4 border-blue-600"></div>
                  </div>
                </>
              ) : null}

              {waitingStatus === "accepted" ? (
                <>
                  <h2 className="text-2xl font-semibold">Dr. {waitingRequest?.specialist_name ?? waitingCaseClinicalDetail?.specialist_name ?? "Specialist"} accepted your request</h2>
                  <p className="mt-4 text-gray-700">{waitingRequest?.specialist_message ?? "Specialist is reviewing the case."}</p>
                  <div className="mt-6 flex justify-center gap-3">
                    <div className="animate-bounce text-xl">🔍</div>
                    <div className="text-xl">🧠</div>
                    <div className="animate-bounce text-xl">✍️</div>
                  </div>
                  <p className="mt-5 text-sm text-gray-600">
                    The specialist is reviewing the requested case and preparing the medical report.
                    You will receive the detailed report shortly.
                  </p>
                </>
              ) : null}

            {waitingStatus === "completed" ? (
              <>
                <h2 className="text-2xl font-semibold">Specialist Report from Dr. {waitingRequest?.specialist_name ?? waitingCaseClinicalDetail?.specialist_name ?? "Specialist"}</h2>
                <div className="mt-5 space-y-4 rounded-xl bg-white/60 p-5 text-left shadow-inner">
                  <div>
                    <h3 className="font-semibold text-slate-800">Diagnosis</h3>
                    <p className="text-sm text-slate-700">Name: {(waitingReport?.diagnosis as { diagnosis_name?: string } | null)?.diagnosis_name ?? "-"}</p>
                    <p className="text-sm text-slate-700">Severity: {(waitingReport?.diagnosis as { severity?: string } | null)?.severity ?? "-"}</p>
                    <p className="text-sm text-slate-700">Notes: {(waitingReport?.diagnosis as { specialist_notes?: string } | null)?.specialist_notes ?? "-"}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Treatment Plan</h3>
                    <p className="text-sm text-slate-700">Title: {(waitingReport?.treatment as { treatment_title?: string } | null)?.treatment_title ?? "-"}</p>
                    <p className="text-sm text-slate-700">Medications: {(waitingReport?.treatment as { medications?: string } | null)?.medications ?? "-"}</p>
                    <p className="text-sm text-slate-700">Inhaler: {(waitingReport?.treatment as { inhaler_therapy?: string } | null)?.inhaler_therapy ?? "-"}</p>
                    <p className="text-sm text-slate-700">Oxygen: {(waitingReport?.treatment as { oxygen_therapy?: string | boolean } | null)?.oxygen_therapy ? "Yes" : "No"}</p>
                    <p className="text-sm text-slate-700">Rehab: {(waitingReport?.treatment as { pulmonary_rehabilitation?: string } | null)?.pulmonary_rehabilitation ?? "-"}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Prescriptions</h3>
                    {(waitingReport?.prescriptions ?? []).length === 0 ? (
                      <p className="text-sm text-slate-700">-</p>
                    ) : (
                      (waitingReport?.prescriptions ?? []).map((rx, idx) => (
                        <p key={`rx-${idx}`} className="text-sm text-slate-700">
                          {(rx as { medication_name?: string; dosage?: string; frequency?: string; instructions?: string }).medication_name ?? "-"}{" "}
                          {(rx as { dosage?: string }).dosage ?? ""} {(rx as { frequency?: string; instructions?: string }).frequency ?? (rx as { instructions?: string }).instructions ?? ""}
                        </p>
                      ))
                    )}
                  </div>
                  <div className="mt-3">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Recommended Further Investigations
                    </h4>
                    {(waitingReport?.furtherDiagnostics?.length ?? 0) === 0 ? (
                      <p className="text-xs text-gray-500">Not Provided</p>
                    ) : (
                      <ol className="list-decimal ml-4 text-xs text-gray-700">
                        {(waitingReport?.furtherDiagnostics ?? []).map((test, idx) => (
                          <li key={idx}>{test}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Follow-up</h3>
                    <p className="text-sm text-slate-700">Date: {(waitingReport?.followup as { scheduled_date?: string } | null)?.scheduled_date ?? "-"}</p>
                    <p className="text-sm text-slate-700">Notes: {(waitingReport?.followup as { notes?: string } | null)?.notes ?? "-"}</p>
                  </div>
                </div>
                  <button
                    onClick={handleFinalizeCase}
                    disabled={finalizing}
                    className="mt-6 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {finalizing ? "Finalizing..." : "Finalize Case"}
                  </button>
              </>
            ) : null}
            </div>
          </div>
        </div>
      )}

            {view === "past_cases" && (
        <div className="max-w-6xl mx-auto p-8">
          <h1 className="mb-6 text-2xl font-semibold">Past Cases</h1>

          <div className="mb-6 flex items-center justify-between gap-4">
            <input
              placeholder="Search Patient ID..."
              value={pastCasesSearch}
              onChange={(e) => setPastCasesSearch(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-gray-200 bg-white/60 px-4 py-2 backdrop-blur"
            />

            <select
              value={pastCasesFilter}
              onChange={(e) => setPastCasesFilter(e.target.value as "All Cases" | "Emergency" | "Normal" | "Completed")}
              className="rounded-lg border bg-white/60 px-4 py-2"
            >
              <option>All Cases</option>
              <option>Emergency</option>
              <option>Normal</option>
              <option>Completed</option>
            </select>
          </div>

          <div className="space-y-4">
            {filteredPastCases.length === 0 ? (
              <div className="py-20 text-center text-gray-500">No past cases available.</div>
            ) : (
              filteredPastCases.map((caseItem, index) => {
                const patientCode = Array.isArray(caseItem.patient)
                  ? caseItem.patient[0]?.generated_patient_id ?? "-"
                  : caseItem.patient?.generated_patient_id ?? "-";
                const isEmergency = emergencyCaseMap[caseItem.id] || caseItem.priority === "emergency";
                return (
                  <div
                    key={caseItem.id}
                    className={`flex items-center justify-between rounded-xl border bg-white/40 p-6 shadow-md backdrop-blur-lg transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] ${
                      isEmergency
                        ? "border-red-300 shadow-[0_0_24px_rgba(220,38,38,0.3)]"
                        : "border-white/30"
                    }`}
                  >
                    <div>
                      <p className="text-sm text-gray-500">Case #{index + 1}</p>
                      <h2 className="text-lg font-semibold">{patientCode}</h2>
                      <p className="text-sm text-gray-600">
                        Created{" "}
                        {(caseItem as { created_at?: string }).created_at
                          ? new Date((caseItem as { created_at?: string }).created_at as string).toLocaleDateString()
                          : "-"}
                      </p>
                    </div>

                    <div>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          isEmergency
                            ? "bg-red-100 text-red-600"
                            : "bg-green-100 text-green-600"
                        }`}
                      >
                        {isEmergency ? "Emergency" : "Normal"}
                      </span>
                      {isEmergency ? (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-xs font-semibold text-white">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Critical
                        </span>
                      ) : null}
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => {
                          setViewingCaseId(caseItem.id);
                          setView("case_detail");
                        }}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}{view === "case_detail" ? (
        caseDetail ? (
          <div className="space-y-6">
          <button
            type="button"
            onClick={() => {
              setViewingCaseId(null);
              setView("past_cases");
            }}
            className="text-sm text-slate-600 hover:text-slate-800"
          >
            Back to Past Cases
          </button>
          <div className={`mb-6 rounded-xl border bg-white/40 p-6 shadow-md backdrop-blur-xl ${
            isEmergencyViewingCase ? "border-red-300 shadow-[0_0_24px_rgba(220,38,38,0.3)]" : "border-white/30"
          }`}>
            <h1 className="text-2xl font-semibold">{caseDetail.patient?.name ?? "Patient"}</h1>
            <p className="mt-1 text-gray-600">Patient ID: {caseDetail.patient?.generated_patient_id ?? "Not Provided"}</p>
            <div className="mt-3">
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  caseDetail.case_status === "finalized" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                }`}
              >
                {caseDetail.case_status === "finalized" ? "Completed Case" : "In Progress Case"}
              </span>
              {isEmergencyViewingCase ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Emergency Case
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border bg-white/40 p-6 shadow-sm backdrop-blur-xl">
              <h2 className="mb-4 text-lg font-semibold">Patient Information</h2>
              <p><strong>Name:</strong> {caseDetail.patient?.name ?? "Not Provided"}</p>
              <p><strong>Patient ID:</strong> {caseDetail.patient?.generated_patient_id ?? "Not Provided"}</p>
              <p><strong>Age:</strong> {caseDetail.patient?.age ?? "Not Provided"}</p>
              <p><strong>Gender:</strong> {caseDetail.patient?.gender ?? "Not Provided"}</p>
              <p><strong>Height:</strong> {caseDetail.patient?.height_cm ?? "Not Provided"} cm</p>
              <p><strong>Weight:</strong> {caseDetail.patient?.weight_kg ?? "Not Provided"} kg</p>
            </div>

            <div className="rounded-xl border bg-white/40 p-6 shadow-sm backdrop-blur-xl">
              <h2 className="mb-4 text-lg font-semibold">Clinical History</h2>
              <p className="leading-relaxed text-gray-700">{caseDetail.patient?.smoking_history ?? "Not Provided"}</p>
            </div>

            <div className="col-span-1 rounded-xl border bg-white/40 p-6 shadow-sm backdrop-blur-xl md:col-span-2">
              <h2 className="mb-4 text-lg font-semibold">Vitals & Spirometry</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <p className="text-xs text-gray-500">BP</p>
                  <p className="text-lg font-semibold">
                    {caseDetail.vitals?.systolic_bp ?? "-"} / {caseDetail.vitals?.diastolic_bp ?? "-"} mmHg
                  </p>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <p className="text-xs text-gray-500">Temperature</p>
                  <p className="text-lg font-semibold">{caseDetail.vitals?.temperature_f ?? "-"} °F</p>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <p className="text-xs text-gray-500">SpO2</p>
                  <p className="text-lg font-semibold">{caseDetail.vitals?.spo2 == null ? "—" : `${caseDetail.vitals.spo2}%`}</p>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <p className="text-xs text-gray-500">Resp Rate</p>
                  <p className="text-lg font-semibold">{caseDetail.vitals?.respiratory_rate == null ? "—" : caseDetail.vitals.respiratory_rate}</p>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <p className="text-xs text-gray-500">FVC</p>
                  <p className="text-lg font-semibold">{caseDetail.spirometry?.fvc == null ? "—" : `${caseDetail.spirometry.fvc} L`}</p>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <p className="text-xs text-gray-500">FEV1</p>
                  <p className="text-lg font-semibold">{caseDetail.spirometry?.fev1 == null ? "—" : `${caseDetail.spirometry.fev1} L`}</p>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <p className="text-xs text-gray-500">FEV1/FVC</p>
                  <p className="text-lg font-semibold">{caseDetail.spirometry?.fev1_fvc == null ? "—" : `${caseDetail.spirometry.fev1_fvc}%`}</p>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <p className="text-xs text-gray-500">FEV1/FEV6</p>
                  <p className="text-lg font-semibold">{caseDetail.spirometry?.fev1_fev6 == null ? "—" : `${caseDetail.spirometry.fev1_fev6}%`}</p>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <p className="text-xs text-gray-500">PEF</p>
                  <p className="text-lg font-semibold">{caseDetail.spirometry?.pef == null ? "—" : `${caseDetail.spirometry.pef} L/min`}</p>
                </div>
              </div>
            </div>

            <div className="col-span-1 rounded-xl border border-blue-200 bg-blue-50 p-6 md:col-span-2">
              <h2 className="mb-3 text-lg font-semibold">Rural Doctor Diagnosis</h2>
              <p className="leading-relaxed text-gray-700">{caseDetail.rural_diagnosis ?? "Not Provided"}</p>
            </div>

            <div className="col-span-1 rounded-xl border bg-white/40 p-6 shadow-sm backdrop-blur-xl md:col-span-2">
              <h3 className="text-lg font-semibold">X-ray Image</h3>
              {caseDetail.xrays && caseDetail.xrays.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setXrayUrl(null);
                    setXrayPath(caseDetail.xrays?.[0]?.path ?? null);
                    setShowXrayModal(true);
                  }}
                  className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  View X-ray
                </button>
              ) : (
                <p className="mt-2 text-gray-500">Not Provided</p>
              )}
            </div>

            <div className="col-span-1 rounded-xl border border-green-200 bg-green-50 p-6 md:col-span-2">
              <h2 className="mb-3 text-lg font-semibold">Specialist Diagnosis</h2>
              <div className="space-y-2 text-gray-700">
                <p><strong>Primary Diagnosis:</strong> {caseDetail.diagnosis?.diagnosis_name ?? "Not Provided"}</p>
                <p><strong>Severity:</strong> {caseDetail.diagnosis?.severity ?? "Not Provided"}</p>
                <p><strong>Specialist:</strong> {caseDetail.specialist_name ?? "Not Provided"}</p>
                <p><strong>Diagnosis Timestamp:</strong> {caseDetail.diagnosis?.created_at ?? "Not Provided"}</p>
                <p><strong>Clinical Notes:</strong> {caseDetail.diagnosis?.specialist_notes ?? "Not Provided"}</p>
              </div>
            </div>

            {(caseDetail.case_status === "completed" || caseDetail.case_status === "finalized") && (
              <>
                <div className="col-span-1 md:col-span-2">
                  <TreatmentViewer
                    medications={caseDetail.treatment?.medications ?? null}
                    inhalerTherapy={caseDetail.treatment?.inhaler_therapy ?? null}
                    oxygenTherapy={caseDetail.treatment?.oxygen_therapy ?? null}
            pulmonaryRehab={caseDetail.treatment?.pulmonary_rehabilitation ?? null}
            lifestyleAdvice={caseDetail.treatment?.lifestyle_recommendations ?? null}
            referralNotes={caseDetail.treatment?.referral_recommendation ?? null}
          />
        </div>
                <div className="col-span-1 md:col-span-2">
                  <PrescriptionViewer rows={caseDetail.prescriptions ?? []} />
                </div>
                <div className="rounded-xl border bg-white/40 p-6 shadow-sm backdrop-blur-xl">
                  <h3 className="text-lg font-semibold">Recommended Further Investigations</h3>
                  {(caseDetail.followup?.diagnostic_procedures?.length ?? 0) === 0 ? (
                    <p className="text-sm text-gray-500">Not Provided</p>
                  ) : (
                    <ol className="list-decimal ml-5 text-sm text-gray-700 space-y-1">
                      {(caseDetail.followup?.diagnostic_procedures ?? []).map((test, idx) => (
                        <li key={idx}>{test}</li>
                      ))}
                    </ol>
                  )}
                </div>
                <div className="rounded-xl border bg-white/40 p-6 shadow-sm backdrop-blur-xl">
                  <h3 className="text-lg font-semibold">Follow-up Notes</h3>
                  <p className="mt-2 whitespace-pre-wrap text-gray-700">{caseDetail.followup?.notes ?? "Not Provided"}</p>
                </div>
                <div className="col-span-1">
                  <FollowupTracker nextFollowupDate={caseDetail.followup?.scheduled_date ?? null} />
                </div>
                <div className="col-span-1">
                  <CaseTimeline
                    caseId={viewingCaseId}
                    timestamps={{
                      caseCreated: caseDetail.case_created_at ?? null,
                      specialistAssigned: caseDetail.specialist_accepted_at ?? null,
                      diagnosisCompleted: caseDetail.diagnosis?.created_at ?? null,
                      treatmentGenerated: caseDetail.treatment?.created_at ?? null,
                      followupScheduled: caseDetail.followup?.created_at ?? null,
                      caseFinalized: caseDetail.case_status === "finalized" ? caseDetail.specialist_completed_at ?? null : null,
                    }}
                  />
                </div>
              </>
            )}
          </div>
          </div>
        ) : viewingCaseId ? (
          <div className="p-6 text-slate-400">
            {pastCaseLoading ? "Loading case details..." : "No details available."}
          </div>
        ) : null
      ) : null}

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

      {view === "new_case" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
      <div className="new-case-glass bg-white/60 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/40 md:col-span-2">
      <div className="mb-8 flex items-center justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <div key={stepNumber} className="flex items-center flex-1">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-300 text-gray-500"
                }`}
              >
                {isCompleted ? "✓" : stepNumber}
              </div>
              <div className="ml-2 text-sm font-medium">{step.title}</div>
              {stepNumber !== 5 && <div className="mx-3 h-[2px] flex-1 bg-gray-300"></div>}
            </div>
          );
        })}
      </div>
      {consentWarning && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-2 text-sm text-amber-400">
          Patient consent is required. Please check the consent checkbox before saving.
        </div>
      )}

      <div>
        {currentStep === 1 && (
        <form
          onSubmit={handleCreatePatient}
          className="space-y-4 rounded-2xl border border-white/40 bg-white/30 p-4"
        >
          <h2 className="text-sm font-semibold text-slate-100">Step 1: Patient intake</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2 space-y-1">
              <label className="text-slate-200">Name</label>
              <input
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
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
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
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
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
                value={patientForm.age}
                onChange={(e) => setPatientForm((p) => ({ ...p, age: e.target.value }))}
                required
                readOnly={patientSaved}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">Gender</label>
              <select
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
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
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
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
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
                value={patientForm.weight_kg}
                onChange={(e) => setPatientForm((p) => ({ ...p, weight_kg: e.target.value }))}
                readOnly={patientSaved}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-slate-200">Patient History</label>
              <textarea
                rows={2}
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
                value={patientForm.smoking_history}
                onChange={(e) => setPatientForm((p) => ({ ...p, smoking_history: e.target.value }))}
                readOnly={patientSaved}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-slate-200">Diagnosis date</label>
              <input
                type="date"
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
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
            className="mt-4 px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingPatient ? "Saving..." : patientSaved ? "Saved" : "Save patient"}
          </button>
        </form>
        )}

        {currentStep === 2 && (
        <form
          onSubmit={handleSaveVitalsAndSpirometry}
          className={`space-y-4 rounded-2xl border border-white/40 p-4 ${step2Enabled ? "bg-white/30" : "bg-white/20 opacity-60"}`}
        >
          <h2 className="text-sm font-semibold text-slate-100">Step 2: Vitals & spirometry</h2>
          <p className="text-xs text-slate-400">Save patient first to enable this section.</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2 space-y-1">
              <label className="text-slate-200">Blood Pressure (mmHg)</label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="Systolic BP (mmHg)"
                  className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  value={vitalsForm.systolic_bp}
                  onChange={(e) => setVitalsForm((p) => ({ ...p, systolic_bp: e.target.value }))}
                  disabled={!step2Enabled}
                />
                <input
                  type="number"
                  placeholder="Diastolic BP (mmHg)"
                  className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  value={vitalsForm.diastolic_bp}
                  onChange={(e) => setVitalsForm((p) => ({ ...p, diastolic_bp: e.target.value }))}
                  disabled={!step2Enabled}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">Temperature (°F)</label>
              <input
                type="number"
                step="0.1"
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Temperature (°F)"
                value={vitalsForm.temperature}
                onChange={(e) => setVitalsForm((p) => ({ ...p, temperature: e.target.value }))}
                disabled={!step2Enabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">SpO2 (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
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
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
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
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
                value={spirometryForm.fvc}
                onChange={(e) => setSpirometryForm((p) => ({ ...p, fvc: e.target.value }))}
                required
                disabled={!step2Enabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">FEV1 (L)</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
                value={spirometryForm.fev1}
                onChange={(e) => setSpirometryForm((p) => ({ ...p, fev1: e.target.value }))}
                required
                disabled={!step2Enabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">FEV1 / FVC (%)</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
                value={spirometryForm.fev1_fvc}
                onChange={(e) => setSpirometryForm((p) => ({ ...p, fev1_fvc: e.target.value }))}
                disabled={!step2Enabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-200">FEV1 / FEV6 (%)</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
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
                className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
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
            className="mt-4 px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingVitals ? "Saving..." : vitalsSaved ? "Saved" : "Save vitals & spirometry"}
          </button>
        </form>
        )}
      </div>

      {currentStep === 3 && (
      <section
        className={`space-y-4 rounded-2xl border border-white/40 p-4 ${step3Enabled ? "bg-white/30" : "bg-white/20 opacity-60"}`}
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
            className="mt-4 px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploadingXray ? "Uploading..." : xrayUploaded ? "Uploaded" : "Upload X-ray"}
          </button>
        </form>
      </section>
      )}

      {currentStep === 4 && (
      <section className="space-y-4 rounded-2xl border border-white/40 bg-white/30 p-4">
        <h2 className="text-sm font-semibold text-slate-100">Diagnosis & Request</h2>
        <textarea
          rows={4}
          className="w-full px-4 py-3 rounded-lg bg-white/40 backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
          value={ruralDiagnosisReport}
          onChange={(e) => setRuralDiagnosisReport(e.target.value)}
          placeholder="Clinical diagnosis, findings, notes..."
          readOnly={caseSubmitted}
        />
        <button
          type="button"
          onClick={async () => {
            await openSpecialistModal();
            setCurrentStep(5);
          }}
          disabled={!canSubmitCase || submittingCase}
          className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Submit Patient Case
        </button>
      </section>
      )}

      {currentStep === 5 && (
      <section className="space-y-4 rounded-2xl border border-white/40 bg-white/30 p-4">
        <h2 className="text-sm font-semibold text-slate-100">Select Specialist</h2>
        <select
          className="w-full rounded-lg border border-white/30 bg-white/40 px-4 py-3 text-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-400"
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
        <div>
          <label className="mb-2 block text-sm text-slate-500">Priority</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingPriority("emergency")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                pendingPriority === "emergency"
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-white/50"
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
                  : "border-slate-300 text-slate-700 hover:bg-white/50"
              }`}
            >
              Normal
            </button>
          </div>
        </div>
        <label className="block text-sm text-slate-500">Notify message (optional)</label>
        <textarea
          rows={2}
          className="w-full rounded-lg border border-white/30 bg-white/40 px-4 py-3 text-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={ruralMessage}
          onChange={(e) => setRuralMessage(e.target.value)}
          placeholder="Add a note for the specialist"
        />
        <button
          type="button"
          onClick={handleConfirmSubmitWithSpecialist}
          disabled={!selectedSpecialistId || !pendingPriority || submittingCase}
          className="mt-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition disabled:opacity-50"
        >
          {submittingCase ? "Submitting..." : "Confirm"}
        </button>
      </section>
      )}

      <div className="mt-8 flex justify-between">
        {currentStep > 1 ? (
          <button
            className="px-5 py-2 rounded-lg bg-gray-200"
            onClick={() => setCurrentStep(currentStep - 1)}
          >
            Back
          </button>
        ) : (
          <div />
        )}

        {currentStep < 4 && (
          <button
            disabled={
              (currentStep === 1 && !patientSaved) ||
              (currentStep === 2 && !vitalsSaved) ||
              (currentStep === 3 && !xrayUploaded)
            }
            onClick={() => setCurrentStep(currentStep + 1)}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white disabled:bg-gray-300"
          >
            Next
          </button>
        )}
      </div>

      </div>
        </div>
      )}
      </main>

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
      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
    </div>
  );
}
