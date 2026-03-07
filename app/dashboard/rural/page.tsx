"use client";

import { FormEvent, useEffect, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Activity, HeartPulse, History, Hospital, LogOut, Microscope, PlusCircle, Stethoscope, Wind } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Gender = "male" | "female" | "other";

type CaseOption = {
  id: string;
  priority: string | null;
  patient:
    | {
        generated_patient_id: string | null;
      }
    | {
        generated_patient_id: string | null;
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
    specialist_diagnosis_report?: string | null;
    case_status?: string | null;
    status?: string | null;
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
  const [view, setView] = useState<"main" | "new_case" | "past_cases" | "waiting" | "case_detail">("main");
  const [currentStep, setCurrentStep] = useState(1);
  const [pastCasesSearch, setPastCasesSearch] = useState("");
  const [pastCasesFilter, setPastCasesFilter] = useState<"All Cases" | "Emergency" | "Normal" | "Completed">("All Cases");
  const steps = [
    { title: "Patient Details" },
    { title: "Vitals & Spirometry" },
    { title: "X-ray Upload" },
    { title: "Diagnosis & Request" },
    { title: "Select Specialist" },
  ];

  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

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
    if (!userResult.user) return;

    const { data } = await supabase
      .from("cases")
      .select("id,status")
      .eq("rural_doctor_id", userResult.user.id)
      .in("status", ["pending", "accepted", "completed"])
      .order("created_at", { ascending: false })
      .limit(1);

    const activeCase = data?.[0];

    if (activeCase?.id) {
      setWaitingCaseId(activeCase.id);
      setView("waiting");
    }
  };

  useEffect(() => {
    if (view !== "past_cases") return;
    fetchPastCases();
  }, [view]);

  useEffect(() => {
    const loadBase = async () => {
      await fetchActiveCase();
      await fetchPastCases();
    };
    loadBase();
  }, []);

  useEffect(() => {
    if (!waitingCaseId) {
      setWaitingRequest(null);
      return;
    }
    let interval: NodeJS.Timeout;
    const fetchRequest = async () => {
      const { data: request } = await supabase
        .from("specialist_requests")
        .select("id, status, specialist_message, accepted_at, completed_at")
        .eq("case_id", waitingCaseId)
        .single();
      if (!request) {
        setWaitingRequest(null);
        return;
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
        specialist_name: null,
        rural_message: null,
        specialist_message: (request as { specialist_message?: string | null })?.specialist_message ?? null,
        specialist_diagnosis_report: caseRow?.specialist_diagnosis_report ?? null,
        case_status: caseRow?.status ?? null,
        status: (request as { status?: string | null })?.status ?? null,
        accepted_at: (request as { accepted_at?: string | null })?.accepted_at ?? null,
        completed_at: (request as { completed_at?: string | null })?.completed_at ?? null,
      });
    };
    fetchRequest();
    interval = setInterval(fetchRequest, 3000);
    const channel = supabase
      .channel(`case-updates-${waitingCaseId}`)
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
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [waitingCaseId]);

  useEffect(() => {
    if (view !== "case_detail" || !viewingCaseId) {
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
  }, [view, viewingCaseId]);

  const waitingStatus = waitingRequest
    ? waitingRequest.completed_at
      ? "completed"
      : waitingRequest.accepted_at
      ? "accepted"
      : "pending"
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
  const handleOpenNewCase = () => {
    resetCaseState();
    setCurrentStep(1);
    setView("new_case");
  };
  const handleOpenPastCases = () => setView("past_cases");
  const floatingIcons = [
    { Icon: HeartPulse, className: "top-[8%] left-[8%]", delay: "0s" },
    { Icon: Stethoscope, className: "top-[18%] right-[16%]", delay: "1.2s" },
    { Icon: Microscope, className: "bottom-[22%] left-[16%]", delay: "2.4s" },
    { Icon: Hospital, className: "bottom-[12%] right-[12%]", delay: "3.6s" },
    { Icon: Activity, className: "top-[42%] left-[28%]", delay: "4.8s" },
    { Icon: Wind, className: "top-[52%] right-[28%]", delay: "5.4s" },
  ] as const;

  if (!ready) {
    return (
      <div className="p-6 text-slate-400">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 text-slate-900">
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
            <div className="grid grid-cols-2 gap-2">
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

      {view === "waiting" && (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-200 via-blue-300 to-blue-400 animate-pulse opacity-60"></div>
          <div className="relative z-10">
            <div className="w-[650px] rounded-2xl border border-white/30 bg-white/40 p-10 text-center shadow-2xl backdrop-blur-xl">
              {!waitingRequest || waitingStatus === "pending" ? (
                <>
                  <p className="text-sm font-medium text-gray-600">Waiting for the specialist</p>
                  <h2 className="mt-3 text-2xl font-semibold">Dr. {waitingRequest?.specialist_name ?? "Specialist"}</h2>
                  <p className="mt-1 text-gray-700">to accept your request doctor</p>
                  <div className="mt-6 flex justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-b-4 border-blue-600"></div>
                  </div>
                </>
              ) : null}

              {waitingRequest && waitingStatus === "accepted" ? (
                <>
                  <h2 className="text-2xl font-semibold">Dr. {waitingRequest.specialist_name ?? "Specialist"} accepted your request</h2>
                  <p className="mt-4 text-gray-700">{waitingRequest.specialist_message ?? "Specialist is reviewing the case."}</p>
                  <div className="mt-6 flex justify-center gap-3">
                    <div className="animate-bounce text-xl">🔍</div>
                    <div className="animate-pulse text-xl">🧠</div>
                    <div className="animate-bounce text-xl">✍️</div>
                  </div>
                  <p className="mt-5 text-sm text-gray-600">
                    The specialist is reviewing the requested case and preparing the medical report.
                    You will receive the detailed report shortly.
                  </p>
                </>
              ) : null}

              {waitingRequest && waitingStatus === "completed" ? (
                <>
                  <h2 className="text-2xl font-semibold">Specialist Report from Dr. {waitingRequest.specialist_name ?? "Specialist"}</h2>
                  <div className="mt-5 rounded-xl bg-white/60 p-5 text-left shadow-inner">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{waitingRequest.specialist_diagnosis_report ?? "-"}</p>
                  </div>
                  {waitingRequest.specialist_message ? (
                    <p className="mt-4 text-sm text-gray-700">{waitingRequest.specialist_message}</p>
                  ) : null}
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
                return (
                  <div
                    key={caseItem.id}
                    className="flex items-center justify-between rounded-xl border border-white/30 bg-white/40 p-6 shadow-md backdrop-blur-lg"
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
                          caseItem.priority === "emergency"
                            ? "bg-red-100 text-red-600"
                            : "bg-green-100 text-green-600"
                        }`}
                      >
                        {caseItem.priority === "emergency" ? "Emergency" : "Normal"}
                      </span>
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
          <div className="mb-6 rounded-xl border border-white/30 bg-white/40 p-6 shadow-md backdrop-blur-xl">
            <h1 className="text-2xl font-semibold">{caseDetail.patient?.name ?? "Patient"}</h1>
            <p className="mt-1 text-gray-600">Patient ID: {caseDetail.patient?.generated_patient_id ?? "-"}</p>
            <div className="mt-3">
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  caseDetail.case_status === "finalized" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                }`}
              >
                {caseDetail.case_status === "finalized" ? "Completed Case" : "In Progress Case"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border bg-white/40 p-6 shadow-sm backdrop-blur-xl">
              <h2 className="mb-4 text-lg font-semibold">Patient Information</h2>
              <p><strong>Name:</strong> {caseDetail.patient?.name ?? "-"}</p>
              <p><strong>Patient ID:</strong> {caseDetail.patient?.generated_patient_id ?? "-"}</p>
              <p><strong>Age:</strong> {caseDetail.patient?.age ?? "-"}</p>
              <p><strong>Gender:</strong> {caseDetail.patient?.gender ?? "-"}</p>
              <p><strong>Height:</strong> {caseDetail.patient?.height_cm ?? "-"} cm</p>
              <p><strong>Weight:</strong> {caseDetail.patient?.weight_kg ?? "-"} kg</p>
            </div>

            <div className="rounded-xl border bg-white/40 p-6 shadow-sm backdrop-blur-xl">
              <h2 className="mb-4 text-lg font-semibold">Clinical History</h2>
              <p className="leading-relaxed text-gray-700">{caseDetail.patient?.smoking_history ?? "-"}</p>
            </div>

            <div className="col-span-1 rounded-xl border bg-white/40 p-6 shadow-sm backdrop-blur-xl md:col-span-2">
              <h2 className="mb-4 text-lg font-semibold">Vitals & Spirometry</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
              <p className="leading-relaxed text-gray-700">{caseDetail.rural_diagnosis ?? "-"}</p>
            </div>

            <div className="col-span-1 rounded-xl border border-green-200 bg-green-50 p-6 md:col-span-2">
              <h2 className="mb-3 text-lg font-semibold">Specialist Diagnosis</h2>
              <p className="leading-relaxed text-gray-700">{caseDetail.specialist_diagnosis || "Pending specialist response"}</p>
            </div>

            <div className="rounded-xl border bg-white/40 p-6 shadow-sm backdrop-blur-xl">
              <h3 className="text-lg font-semibold">Recommended Further Investigations</h3>
              <div className="mt-2 space-y-2 text-gray-700">
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

            <div className="rounded-xl border bg-white/40 p-6 shadow-sm backdrop-blur-xl">
              <h3 className="text-lg font-semibold">Follow-up Notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-gray-700">{caseDetail.follow_up_notes ?? "-"}</p>
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
                <p className="mt-2 text-gray-500">-</p>
              )}
            </div>
          </div>
          </div>
        ) : viewingCaseId ? (
          <div className="p-6 text-slate-400">
            Loading case details...
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
            setShowSpecialistModal(false);
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




