"use client";
export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useRef, useState } from "react";
import dynamicImport from "next/dynamic";
import { useRouter } from "next/navigation";
import { Activity, History, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import DiagnosisPanel from "@/components/specialist/DiagnosisPanel";
import TreatmentPanel from "@/components/specialist/TreatmentPanel";
import PrescriptionPanel, { PrescriptionRow } from "@/components/specialist/PrescriptionPanel";
import FurtherDiagnosticsChecklistPanel from "@/components/specialist/DiagnosticTestsPanel";
import FollowupPanel from "@/components/specialist/FollowupPanel";
import TreatmentViewer from "@/components/rural/TreatmentViewer";
import PrescriptionViewer from "@/components/rural/PrescriptionViewer";
import FollowupTracker from "@/components/rural/FollowupTracker";
import CaseTimeline from "@/components/shared/CaseTimeline";

const DicomViewer = dynamicImport(() => import("@/app/components/DicomViewer"), { ssr: false });

const RequestSkeleton = () => (
  <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm animate-pulse">
    <div className="h-4 w-32 rounded bg-gray-200" />
    <div className="mt-3 space-y-2">
      <div className="h-3 w-full rounded bg-gray-200" />
      <div className="h-3 w-5/6 rounded bg-gray-200" />
      <div className="h-3 w-2/3 rounded bg-gray-200" />
    </div>
  </div>
);

const DiagnosisSkeleton = () => (
  <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm animate-pulse">
    <div className="h-4 w-40 rounded bg-gray-200" />
    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="h-20 rounded bg-gray-200" />
      <div className="h-20 rounded bg-gray-200" />
      <div className="h-20 rounded bg-gray-200" />
      <div className="h-20 rounded bg-gray-200" />
    </div>
  </div>
);

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
  vitals: {
    spo2?: number | null;
    respiratory_rate?: number | null;
    systolic_bp?: number | null;
    diastolic_bp?: number | null;
    temperature_f?: number | null;
    created_at?: string | null;
  }[];
  spirometry: { fvc?: number | null; fev1?: number | null; fev1_fvc?: number | null; fev1_fev6?: number | null; pef?: number | null; created_at?: string | null }[];
  ruralDiagnosis: string | null;
  xrayPaths: string[];
}

type DiagnosisTemplate = {
  id: string;
  diagnosis_name: string;
  details?: string | null;
  defaultSeverity?: string | null;
};

type DiagnosisFormState = {
  diagnosisTemplateId: string;
  diagnosisTemplateName: string;
  manualDiagnosis: string;
  severity: "mild" | "moderate" | "severe" | "critical";
  clinicalNotes: string;
};

type TreatmentFormState = {
  treatmentTitle: string;
  medications: string;
  inhalerTherapy: string;
  oxygenTherapy: string;
  pulmonaryRehab: string;
  lifestyleAdvice: string;
  referralRecommendation: string;
};


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

  const [baseDataReady, setBaseDataReady] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SpecialistRequestRow | null>(null);
  const [acceptMessage, setAcceptMessage] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [reviewData, setReviewData] = useState<CaseReviewData | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showXrayModal, setShowXrayModal] = useState(false);
  const [xrayUrl, setXrayUrl] = useState<string | null>(null);
  const [xrayPath, setXrayPath] = useState<string | null>(null);
  const viewingPastCaseIdRef = useRef<string | null>(null);
  const [viewingPastCaseData, setViewingPastCaseData] = useState<{
    patient?: {
      name?: string;
      generated_patient_id?: string | null;
      age?: number | null;
      gender?: string | null;
      height_cm?: number | null;
      weight_kg?: number | null;
      smoking_history?: string | null;
    };
    vitals?: {
      spo2?: number | null;
      respiratory_rate?: number | null;
      systolic_bp?: number | null;
      diastolic_bp?: number | null;
      temperature_f?: number | null;
      created_at?: string | null;
    } | null;
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
            pulmonary_rehab: string | null;
            lifestyle_advice: string | null;
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
  const [diagnosisTemplates, setDiagnosisTemplates] = useState<DiagnosisTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateDependentLoading, setTemplateDependentLoading] = useState(false);
  const [diagnosisSaving, setDiagnosisSaving] = useState(false);
  const [treatmentSaving, setTreatmentSaving] = useState(false);
  const [prescriptionSaving, setPrescriptionSaving] = useState(false);
  const [followupSaving, setFollowupSaving] = useState(false);
  const [diagnosisForm, setDiagnosisForm] = useState<DiagnosisFormState>({
    diagnosisTemplateId: "",
    diagnosisTemplateName: "",
    manualDiagnosis: "",
    severity: "moderate",
    clinicalNotes: "",
  });
  const [treatmentForm, setTreatmentForm] = useState<TreatmentFormState>({
    treatmentTitle: "",
    medications: "",
    inhalerTherapy: "",
    oxygenTherapy: "",
    pulmonaryRehab: "",
    lifestyleAdvice: "",
    referralRecommendation: "",
  });
  const [prescriptionRows, setPrescriptionRows] = useState<PrescriptionRow[]>([
    { id: "rx-default", medication: "", dosage: "", frequency: "", duration: "", notes: "" },
  ]);
  const [furtherDiagnosticsTests, setFurtherDiagnosticsTests] = useState<string[]>([]);
  const [furtherDiagnosticsCustomInput, setFurtherDiagnosticsCustomInput] = useState("");
  const [followupInterval, setFollowupInterval] = useState("2 weeks");
  const [followupDate, setFollowupDate] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");
  const [timelineLocalTimestamps, setTimelineLocalTimestamps] = useState<{
    diagnosisCompleted?: string | null;
    treatmentGenerated?: string | null;
    followupScheduled?: string | null;
  }>({});

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
    const timer = setTimeout(() => setError(null), 5500);
    return () => clearTimeout(timer);
  }, [error]);

  const deriveSeverity = (row: Record<string, unknown>) => {
    const severityRaw =
      (row.default_severity as string | undefined) ??
      (row.severity as string | undefined) ??
      (row.level as string | undefined);
    if (!severityRaw) return "moderate";
    const normalized = severityRaw.toLowerCase();
    if (normalized === "mild" || normalized === "moderate" || normalized === "severe" || normalized === "critical") {
      return normalized;
    }
    return "moderate";
  };

  const resetExtendedReviewState = () => {
    setDiagnosisTemplates([]);
    setDiagnosisForm({
      diagnosisTemplateId: "",
      diagnosisTemplateName: "",
      manualDiagnosis: "",
      severity: "moderate",
      clinicalNotes: "",
    });
    setTreatmentForm({
      treatmentTitle: "",
      medications: "",
      inhalerTherapy: "",
      oxygenTherapy: "",
      pulmonaryRehab: "",
      lifestyleAdvice: "",
      referralRecommendation: "",
    });
    setPrescriptionRows([{ id: `rx-${Date.now()}`, medication: "", dosage: "", frequency: "", duration: "", notes: "" }]);
    setFurtherDiagnosticsTests([]);
    setFurtherDiagnosticsCustomInput("");
    setFollowupInterval("2 weeks");
    setFollowupDate("");
    setFollowupNotes("");
    setTimelineLocalTimestamps({});
  };

  const loadDiagnosisTemplates = async () => {
    setTemplatesLoading(true);
    const { data, error: templateErr } = await supabase.from("pulmonology_diagnoses").select("id, diagnosis_name");
    setTemplatesLoading(false);
    if (templateErr) {
      setError(templateErr.message);
      return;
    }
    const mapped = ((data ?? []) as Record<string, unknown>[]).map((row, index) => ({
      id: String((row.id as string | number | undefined) ?? `diag-${index}`),
      diagnosis_name: String((row.diagnosis_name as string | undefined) ?? ""),
      details: null,
      defaultSeverity: "moderate",
    }));
    setDiagnosisTemplates(mapped);
  };

  const inferIntervalFromSeverity = (severity: DiagnosisFormState["severity"]) => {
    if (severity === "critical" || severity === "severe") return "1 week";
    if (severity === "moderate") return "2 weeks";
    return "4 weeks";
  };


  const syncPrescriptionFromTreatment = (medicationString: string) => {
    const meds = medicationString
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    return meds.map((m, i) => ({
      id: `rx-auto-${i}`,
      medication: m,
      dosage: "",
      frequency: "",
      duration: "",
      notes: "",
    }));
  };

  const applyTemplateDrivenForms = async (diagnosisTemplateId: string) => {
    if (!diagnosisTemplateId) return;
    setTemplateDependentLoading(true);

    const selectedTemplate = diagnosisTemplates.find((t) => t.id === diagnosisTemplateId);

    setDiagnosisForm((prev) => ({
      ...prev,
      diagnosisTemplateId,
      diagnosisTemplateName: selectedTemplate?.diagnosis_name ?? "",
      manualDiagnosis: "",
      severity: (selectedTemplate?.defaultSeverity as DiagnosisFormState["severity"]) ?? "moderate",
    }));

    setTreatmentForm({
      treatmentTitle: "",
      medications: "",
      inhalerTherapy: "",
      oxygenTherapy: "",
      pulmonaryRehab: "",
      lifestyleAdvice: "",
      referralRecommendation: "",
    });
    setPrescriptionRows([]);
    setFollowupInterval("2 weeks");

    const [treatmentRes, prescriptionRes] = await Promise.all([
      supabase
        .from("treatment_plan_templates")
        .select("*")
        .eq("diagnosis_id", diagnosisTemplateId)
        .single(),

      supabase
        .from("prescription_templates")
        .select("*")
        .eq("diagnosis_id", diagnosisTemplateId),
    ]);

    setTemplateDependentLoading(false);

    if (treatmentRes.error && treatmentRes.error.code !== "PGRST116") {
      setError(treatmentRes.error.message);
    }

    if (treatmentRes.data) {
      const t = treatmentRes.data as Record<string, unknown>;

      setTreatmentForm({
        treatmentTitle: String((t.treatment_title as string | undefined) ?? ""),
        medications: String((t.medications as string | undefined) ?? ""),
        inhalerTherapy: String((t.inhaler_therapy as string | undefined) ?? ""),
        oxygenTherapy: (t.oxygen_therapy as boolean | undefined) ? "Yes" : "No",
        pulmonaryRehab: String((t.pulmonary_rehabilitation as string | undefined) ?? ""),
        lifestyleAdvice: String((t.lifestyle_recommendations as string | undefined) ?? ""),
        referralRecommendation: String((t.referral_recommendation as string | undefined) ?? ""),
      });

      if (!prescriptionRes.data || prescriptionRes.data.length === 0) {
        const meds = String((t.medications as string | undefined) ?? "");
        if (meds.trim()) {
          setPrescriptionRows(syncPrescriptionFromTreatment(meds));
        }
      }
    }

    if (prescriptionRes.error) {
      setError(prescriptionRes.error.message);
      return;
    }

    if (prescriptionRes.data) {
      const rows = prescriptionRes.data.map((rx: Record<string, unknown>, i: number) => ({
        id: String((rx.id as string | number | undefined) ?? `rx-${i}`),
        medication: String((rx.medication_name as string | undefined) ?? ""),
        dosage: String((rx.dosage as string | undefined) ?? ""),
        frequency: String((rx.frequency as string | undefined) ?? ""),
        duration: String((rx.duration_days as string | number | undefined) ?? ""),
        notes: String((rx.instructions as string | undefined) ?? ""),
      }));

      setPrescriptionRows(
        rows.length
          ? rows
          : [{
              id: `rx-empty-${Date.now()}`,
              medication: "",
              dosage: "",
              frequency: "",
              duration: "",
              notes: "",
            }]
      );
    }

    setFurtherDiagnosticsTests([]);
    setFollowupInterval(
      inferIntervalFromSeverity((selectedTemplate?.defaultSeverity as DiagnosisFormState["severity"]) ?? "moderate")
    );
  };

  const saveCaseDiagnosis = async (): Promise<{ success?: boolean; error?: string }> => {
    if (!reviewData || !userId) return { error: "Not ready" };
    setDiagnosisSaving(true);
    const hasTemplate = Boolean(diagnosisForm.diagnosisTemplateId);
    const selectedDiagnosisId = hasTemplate ? diagnosisForm.diagnosisTemplateId : null;
    const diagnosisNameToSave = diagnosisForm.diagnosisTemplateName || diagnosisForm.manualDiagnosis;
    const payload = {
      case_id: reviewData.caseId,
      specialist_id: userId,
      diagnosis_id: selectedDiagnosisId,
      diagnosis_name: diagnosisNameToSave || null,
      is_manual: !hasTemplate,
      severity: diagnosisForm.severity,
      specialist_notes: diagnosisForm.clinicalNotes || null,
      updated_at: new Date().toISOString(),
    };
    const { error: saveErr } = await supabase.from("case_diagnoses").upsert(payload, { onConflict: "case_id" });
    setDiagnosisSaving(false);
    if (saveErr) {
      setError(saveErr.message);
      return { error: saveErr.message };
    }
    setTimelineLocalTimestamps((prev) => ({ ...prev, diagnosisCompleted: new Date().toISOString() }));
    return { success: true };
  };

  const saveTreatmentPlan = async (): Promise<{ success?: boolean; error?: string }> => {
    if (!reviewData || !userId) return { error: "Not ready" };
    setTreatmentSaving(true);
    const payload = {
      case_id: reviewData.caseId,
      specialist_id: userId,
      treatment_title: treatmentForm.treatmentTitle || null,
      medications: treatmentForm.medications || null,
      inhaler_therapy: treatmentForm.inhalerTherapy || null,
      oxygen_therapy: treatmentForm.oxygenTherapy === "Yes",
      pulmonary_rehabilitation: treatmentForm.pulmonaryRehab || null,
      lifestyle_recommendations: treatmentForm.lifestyleAdvice || null,
      referral_recommendation: treatmentForm.referralRecommendation || null,
      updated_at: new Date().toISOString(),
    };
    const { error: saveErr } = await supabase.from("case_treatment_plans").upsert(payload, { onConflict: "case_id" });
    setTreatmentSaving(false);
    if (saveErr) {
      setError(saveErr.message);
      return { error: saveErr.message };
    }
    setTimelineLocalTimestamps((prev) => ({ ...prev, treatmentGenerated: new Date().toISOString() }));
    return { success: true };
  };

  const savePrescription = async (): Promise<{ success?: boolean; error?: string }> => {
    if (!reviewData || !userId) return { error: "Not ready" };
    setPrescriptionSaving(true);
    const { error: deleteErr } = await supabase.from("prescriptions").delete().eq("case_id", reviewData.caseId);
    if (deleteErr) {
      setPrescriptionSaving(false);
      setError(deleteErr.message);
      return { error: deleteErr.message };
    }
    const cleanRows = prescriptionRows.filter((row) => row.medication.trim());
    if (cleanRows.length === 0) {
      setPrescriptionSaving(false);
      return { success: true };
    }
    const payload = cleanRows.map((row) => ({
      case_id: reviewData.caseId,
      specialist_id: userId,
      medication_name: row.medication || null,
      dosage: row.dosage || null,
      frequency: row.frequency || null,
      duration_days: row.duration || null,
      instructions: row.notes || null,
      created_at: new Date().toISOString(),
    }));
    const { error: saveErr } = await supabase.from("prescriptions").insert(payload);
    setPrescriptionSaving(false);
    if (saveErr) {
      setError(saveErr.message);
      return { error: saveErr.message };
    }
    return { success: true };
  };

  const saveFollowup = async (): Promise<{ success?: boolean; error?: string }> => {
    if (!reviewData || !userId) return { error: "Not ready" };
    setFollowupSaving(true);
    const diagnosticsToSave =
      furtherDiagnosticsTests?.length ? furtherDiagnosticsTests : [];
    const payload = {
      case_id: reviewData.caseId,
      specialist_id: userId,
      followup_type: followupInterval,
      scheduled_date: followupDate || null,
      notes: followupNotes || null,
      diagnostic_procedures: diagnosticsToSave,
      updated_at: new Date().toISOString(),
    };
    const { error: saveErr } = await supabase.from("followups").upsert(payload, { onConflict: "case_id" });
    setFollowupSaving(false);
    if (saveErr) {
      setError(saveErr.message);
      return { error: saveErr.message };
    }
    setTimelineLocalTimestamps((prev) => ({ ...prev, followupScheduled: new Date().toISOString() }));
    return { success: true };
  };

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

  const refetchRequests = () => {
    if (!userId) return;
    loadRequests(userId);
  };

  const refetchCases = () => {
    if (!userId) return;
    loadRequests(userId);
    loadPastCasesForSpecialist();
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
    
    const interval = setInterval(() => {
      if (active) {
        loadRequests(userId);
        // Only load past cases on real-time event to save heavy queries,
        // but load requests frequently.
      }
    }, 5000);
    
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    // Capture userId in the closure directly so the event handlers
    // always call loadRequests with the correct id, even after re-renders.
    const uid = userId;
    const channel = supabase
      .channel(`specialist-realtime-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "specialist_requests" },
        () => {
          loadRequests(uid);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases" },
        () => {
          loadRequests(uid);
          loadPastCasesForSpecialist();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!reviewData?.caseId) return;
    loadDiagnosisTemplates();
  }, [reviewData?.caseId]);

  useEffect(() => {
    if (!diagnosisForm.diagnosisTemplateId) return;
    applyTemplateDrivenForms(diagnosisForm.diagnosisTemplateId);
  }, [diagnosisForm.diagnosisTemplateId, diagnosisTemplates]);


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
    resetExtendedReviewState();
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
    resetExtendedReviewState();
    const { data: caseRows } = await supabase
      .from("cases")
      .select("id, patient_id, rural_diagnosis_report, status")
      .eq("id", caseId)
      .limit(1);
    const caseRow = caseRows?.[0] as
      | {
          id?: string;
          patient_id?: string;
          rural_diagnosis_report?: string | null;
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
      .select("spo2, respiratory_rate, systolic_bp, diastolic_bp, temperature_f, created_at")
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
      vitals: (vitalsRows ?? []) as {
        spo2?: number | null;
        respiratory_rate?: number | null;
        systolic_bp?: number | null;
        diastolic_bp?: number | null;
        temperature_f?: number | null;
        created_at?: string | null;
      }[],
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
    setDiagnosisForm({
      diagnosisTemplateId: "",
      diagnosisTemplateName: "",
      manualDiagnosis: "",
      severity: "moderate",
      clinicalNotes: "",
    });
    setFurtherDiagnosticsTests([]);
    onDone?.();
  };

  const handleFinishCase = async () => {
    if (!reviewData || !typeof window) return;
    if (!window.confirm("Submit your diagnosis and finish this case?")) return;
    setFinishing(true);

    const [{ data: diagnosisRows }, { data: treatmentRows }, { data: prescriptionRows }, { data: followupRows }] =
      await Promise.all([
        supabase.from("case_diagnoses").select("id").eq("case_id", reviewData.caseId).limit(1),
        supabase.from("case_treatment_plans").select("id").eq("case_id", reviewData.caseId).limit(1),
        supabase.from("prescriptions").select("id").eq("case_id", reviewData.caseId).limit(1),
        supabase.from("followups").select("id").eq("case_id", reviewData.caseId).limit(1),
      ]);

    if (!diagnosisRows?.length || !treatmentRows?.length || !prescriptionRows?.length || !followupRows?.length) {
      setError("Complete diagnosis, treatment, prescriptions, and follow-up before finishing.");
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
      await loadPastCasesForSpecialist();
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
    resetExtendedReviewState();
    setViewState("past");
    if (userId) {
      loadRequests(userId);
    }
  };

  const openXrayModal = async (path: string) => {
    setXrayUrl(null);
    setXrayPath(path);
    setShowXrayModal(true);
  };

  const loadFullCaseSummary = async (caseId: string, patientId: string) => {
    if (!caseId || !patientId) return;
    setPastCaseLoading(true);
    setViewingPastCaseData(null);
    viewingPastCaseIdRef.current = caseId;
    try {
      const { data: caseRows } = await supabase
        .from("cases")
        .select("id, patient_id, specialist_id, created_at, status, rural_diagnosis_report")
        .eq("id", caseId)
        .limit(1);
      const c = caseRows?.[0] as {
        id?: string;
        patient_id: string;
        specialist_id?: string | null;
        created_at?: string | null;
        status?: string | null;
        rural_diagnosis_report?: string | null;
      } | undefined;
      if (!c) {
        setViewingPastCaseData(null);
        viewingPastCaseIdRef.current = null;
        return;
      }
      const caseIdFromRow = c.id ?? caseId;
      const patientIdFromCase = c.patient_id ?? patientId;

      const { data: diagnosisRows } = await supabase
        .from("case_diagnoses")
        .select("diagnosis_name, severity, specialist_notes, created_at")
        .eq("case_id", caseIdFromRow)
        .order("created_at", { ascending: false })
        .limit(1);
      const diagnosis = diagnosisRows?.[0] ?? null;

      const { data: treatmentRows } = await supabase
        .from("case_treatment_plans")
        .select("medications, inhaler_therapy, oxygen_therapy, pulmonary_rehabilitation, lifestyle_recommendations, referral_recommendation, created_at")
        .eq("case_id", caseIdFromRow)
        .order("created_at", { ascending: false })
        .limit(1);
      const treatment = treatmentRows?.[0] ?? null;

      const { data: prescriptions } = await supabase
        .from("prescriptions")
        .select("medication_name, dosage, frequency, duration_days, instructions")
        .eq("case_id", caseIdFromRow)
        .order("created_at", { ascending: true });

      const { data: followupRows } = await supabase
        .from("followups")
        .select("scheduled_date, notes, diagnostic_procedures, created_at")
        .eq("case_id", caseIdFromRow);
      const followup = followupRows?.[0] ?? null;

      // Fetch specialist_requests to get accepted_at / completed_at for the timeline
      const { data: reqRows } = await supabase
        .from("specialist_requests")
        .select("accepted_at, completed_at")
        .eq("case_id", caseIdFromRow)
        .limit(1);
      const reqRow = (reqRows?.[0] ?? null) as { accepted_at?: string | null; completed_at?: string | null } | null;
      const diagnosticsValue = (followup as { diagnostic_procedures?: unknown } | null)?.diagnostic_procedures;
      const furtherDiagnostics = Array.isArray(diagnosticsValue)
        ? diagnosticsValue.map((item) => String(item)).filter(Boolean)
        : typeof diagnosticsValue === "string"
          ? diagnosticsValue.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)
          : [];

      const [patientRes, vitalsRes, spirometryRes, xrayRes] = await Promise.all([
        supabase
          .from("patients")
          .select("name, generated_patient_id, age, gender, height_cm, weight_kg, smoking_history")
          .eq("id", patientIdFromCase)
          .single(),
        supabase
          .from("vitals")
          .select("spo2, respiratory_rate, systolic_bp, diastolic_bp, temperature_f, created_at")
          .eq("patient_id", patientIdFromCase)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("spirometry")
          .select("*")
          .eq("patient_id", patientIdFromCase)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("xrays")
          .select("file_path, created_at")
          .eq("patient_id", patientIdFromCase)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      const p = patientRes.data as {
        name?: string;
        generated_patient_id?: string | null;
        age?: number | null;
        gender?: string | null;
        height_cm?: number | null;
        weight_kg?: number | null;
        smoking_history?: string | null;
      } | null;
      const v = vitalsRes.data;
      const s = spirometryRes.data;
      const x = xrayRes.data;
      const specialistNameFromCase = profile?.full_name ?? null;
      const isCompleted = c.status === "completed" || c.status === "finalized";
      setViewingPastCaseData({
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
        vitals: (v?.[0] as {
          spo2?: number | null;
          respiratory_rate?: number | null;
          systolic_bp?: number | null;
          diastolic_bp?: number | null;
          temperature_f?: number | null;
          created_at?: string | null;
        }) ?? null,
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
        follow_up_notes: null,
        case_status: c.status ?? null,
        specialist_name: specialistNameFromCase,
        specialist_accepted_at: reqRow?.accepted_at ?? null,
        specialist_completed_at: reqRow?.completed_at ?? null,
        case_created_at: c.created_at ?? null,
        diagnosis: (diagnosis as { diagnosis_name?: string | null; severity?: string | null; specialist_notes?: string | null; created_at?: string | null } | null)
          ? {
              diagnosis_name: (diagnosis as { diagnosis_name?: string | null }).diagnosis_name ?? null,
              severity: (diagnosis as { severity?: string | null }).severity ?? null,
              specialist_notes: (diagnosis as { specialist_notes?: string | null }).specialist_notes ?? null,
              created_at: (diagnosis as { created_at?: string | null }).created_at ?? null,
            }
          : null,
        treatment: (treatment as {
          medications?: string | null;
          inhaler_therapy?: string | null;
          oxygen_therapy?: boolean | null;
          pulmonary_rehabilitation?: string | null;
          lifestyle_recommendations?: string | null;
          referral_recommendation?: string | null;
          created_at?: string | null;
        } | null)
          ? {
              treatment_title: null,
              medications: (treatment as { medications?: string | null }).medications ?? null,
              inhaler_therapy: (treatment as { inhaler_therapy?: string | null }).inhaler_therapy ?? null,
              oxygen_therapy: (treatment as { oxygen_therapy?: boolean | null }).oxygen_therapy ?? null,
              pulmonary_rehabilitation: (treatment as { pulmonary_rehabilitation?: string | null }).pulmonary_rehabilitation ?? null,
              lifestyle_recommendations: (treatment as { lifestyle_recommendations?: string | null }).lifestyle_recommendations ?? null,
              referral_recommendation: (treatment as { referral_recommendation?: string | null }).referral_recommendation ?? null,
              created_at: (treatment as { created_at?: string | null }).created_at ?? null,
            }
          : null,
        prescriptions:
          (prescriptions as {
            medication_name?: string | null;
            dosage?: string | null;
            frequency?: string | null;
            duration_days?: string | number | null;
            instructions?: string | null;
          }[] | null)?.map((row, idx) => ({
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
        specialist_report: isCompleted
          ? {
              specialist_name: specialistNameFromCase,
              diagnosis: diagnosis
                ? {
                    primary_diagnosis: (diagnosis as { diagnosis_name?: string | null }).diagnosis_name ?? null,
                    severity: (diagnosis as { severity?: string | null }).severity ?? null,
                    clinical_notes: (diagnosis as { specialist_notes?: string | null }).specialist_notes ?? null,
                    created_at: (diagnosis as { created_at?: string | null }).created_at ?? null,
                  }
                : null,
              treatment: treatment
                ? {
                    medications: (treatment as { medications?: string | null }).medications ?? null,
                    inhaler_therapy: (treatment as { inhaler_therapy?: string | null }).inhaler_therapy ?? null,
                    oxygen_therapy: (treatment as { oxygen_therapy?: boolean | null }).oxygen_therapy ?? null,
                    pulmonary_rehab: (treatment as { pulmonary_rehabilitation?: string | null }).pulmonary_rehabilitation ?? null,
                    lifestyle_advice: (treatment as { lifestyle_recommendations?: string | null }).lifestyle_recommendations ?? null,
                    referral_recommendation: (treatment as { referral_recommendation?: string | null }).referral_recommendation ?? null,
                    created_at: (treatment as { created_at?: string | null }).created_at ?? null,
                  }
                : null,
              prescriptions:
                (prescriptions as {
                  medication_name?: string | null;
                  dosage?: string | null;
                  frequency?: string | null;
                  duration_days?: string | number | null;
                  instructions?: string | null;
                }[] | null)?.map((row, idx) => ({
                  id: `rx-${idx}`,
                  medication: row.medication_name ?? null,
                  dosage: row.dosage ?? null,
                  frequency: row.frequency ?? row.instructions ?? null,
                  duration: row.duration_days != null ? String(row.duration_days) : null,
                  instructions: row.instructions ?? null,
                })) ?? [],
              followup: followup
                ? {
                    followup_date: (followup as { scheduled_date?: string | null }).scheduled_date ?? null,
                    created_at: (followup as { created_at?: string | null }).created_at ?? null,
                    diagnostic_procedures: furtherDiagnostics,
                  }
                : null,
              timeline: {
                case_created_at: c.created_at ?? null,
                specialist_accepted_at: reqRow?.accepted_at ?? null,
                diagnosis_submitted_at: (diagnosis as { created_at?: string | null })?.created_at ?? null,
                treatment_generated_at: (treatment as { created_at?: string | null })?.created_at ?? null,
                followup_scheduled_at: (followup as { created_at?: string | null })?.created_at ?? null,
                case_finalized_at: reqRow?.completed_at ?? null,
              },
              specialist_accepted_at: reqRow?.accepted_at ?? null,
              specialist_completed_at: reqRow?.completed_at ?? null,
              case_created_at: c.created_at ?? null,
            }
          : null,
      });
    } finally {
      setPastCaseLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden theme-specialist page-transition-shell text-slate-900">
      <aside className="glass-panel hidden w-64 flex-col justify-between p-6 md:fixed md:left-6 md:top-6 md:flex md:h-[calc(100vh-3rem)] z-50">
        <div>
          <h1 className="text-xl font-semibold tracking-wide">Tele-Pulmonology</h1>
          <p className="px-2 mt-4 mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Specialist Dashboard</p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setViewState("list");
                setViewingPastCaseData(null);
                viewingPastCaseIdRef.current = null;
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition duration-300 ${
                viewState === "list" || viewState === "accept" || viewState === "review"
                  ? "bg-blue-600/80 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-400/50"
                  : "bg-white/5 text-slate-300 hover:bg-white/10 border border-transparent hover:border-white/10"
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Active Requests</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewState("past");
                setViewingPastCaseData(null);
                viewingPastCaseIdRef.current = null;
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition duration-300 ${
                viewState === "past" || Boolean(viewingPastCaseData)
                  ? "bg-blue-600/80 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-400/50"
                  : "bg-white/5 text-slate-300 hover:bg-white/10 border border-transparent hover:border-white/10"
              }`}
            >
              <History className="h-4 w-4" />
              <span>Past Cases</span>
            </button>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="glass-btn-danger w-full justify-center"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </aside>

      <main className="flex-1 p-6 md:ml-[300px] md:p-8 xl:p-12 relative z-10 page-transition-content h-screen overflow-y-auto space-y-6 scroll-smooth">
      <div className="glass-panel p-8 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
        <h1 className="medical-h1">
          Welcome back Dr. {profile?.full_name ?? "Specialist"}
        </h1>
        <p className="medical-body">
          Active requests and case review. Review patient data and submit your diagnosis.
        </p>
        </div>
        {profile && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-white backdrop-blur-md flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/50 border border-blue-400/30 text-sm font-semibold text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]">
              {profile.full_name?.slice(0, 1).toUpperCase() ?? "S"}
            </div>
            <div>
              <p className="text-sm font-medium">Dr. {profile.full_name ?? "Specialist"}</p>
              <p className="text-xs text-blue-300">Specialist Profile</p>
            </div>
          </div>
        )}
      </div>
      {/* Global error popup toast - top-right, auto-dismisses after 5.5s */}
      {error && (
        <div className="fixed top-6 right-6 z-[100] max-w-sm px-5 py-3 rounded-xl bg-red-600 text-white text-sm font-medium shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-2 fade-in-0 duration-300">
          <span>❌</span>
          <span>{error}</span>
        </div>
      )}

      {viewState === "list" && (
        <>
          <section className="glass-panel p-6 animate-in fade-in zoom-in-95 duration-500">
            <h2 className="medical-caption text-blue-400 mb-2">ACTIVE REQUESTS</h2>
            <div className="mt-2 flex gap-4">
              <button
                type="button"
                onClick={() => setActiveTab("emergency")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "emergency"
                    ? "bg-red-600 text-white"
                    : "border border-gray-300 bg-white/70 text-gray-800 hover:bg-blue-50 border border-blue-200"
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
                    : "border border-gray-300 bg-white/70 text-gray-800 hover:bg-blue-50 border border-blue-200"
                }`}
              >
                Normal {normalPending.length > 0 && `(${normalPending.length})`}
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {activeList.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-slate-400 backdrop-blur-md">
                  No {activeTab === "emergency" ? "emergency" : "normal"} requests currently queued.
                </div>
              ) : (
                activeList.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-xl border p-5 transition hover:bg-white/5 ${
                      r.case_priority === "emergency"
                        ? "border-red-500/30 bg-red-500/5 shadow-[0_0_10px_rgba(220,38,38,0.1)]"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-3 text-sm text-slate-300">
                        <div className="font-semibold text-lg text-white">Patient ID: <span className="text-blue-300">{r.generated_patient_id ?? r.patient_name ?? "-"}</span></div>
                        <div className="flex gap-2">
                          <span className={r.case_priority === "emergency"
                            ? "px-3 py-1 text-xs rounded-full bg-red-600 border border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)] font-bold tracking-wider"
                            : "px-3 py-1 text-xs rounded-full bg-blue-600/30 border border-blue-400/30 text-blue-300"}>
                            {r.case_priority === "emergency" ? "EMERGENCY" : "NORMAL"}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-x-6 gap-y-1 mt-2">
                          <div><span className="text-slate-500">Submitted:</span> {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</div>
                          <div><span className="text-slate-500">Rural Partner:</span> {r.ruralDoctorName ?? "-"}</div>
                        </div>
                        <div className="rounded border border-white/5 bg-black/20 p-3 italic text-slate-400">"{r.rural_message ?? "No additional directives provided"}"</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewAccept(r)}
                        className={`glass-btn-primary self-start md:self-center px-8 py-3 ${
                          r.case_priority === "emergency" ? "bg-red-600/80 hover:bg-red-500 border border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]" : ""
                        }`}
                      >
                        Acknowledge & View Case
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {acceptedRequests.length > 0 && (
              <div className="mt-8 border-t border-white/10 pt-6">
                <h3 className="medical-caption text-emerald-400 mb-4">IN PROGRESS (ACCEPTED, PENDING FINALIZATION)</h3>
                <div className="space-y-3">
                  {acceptedRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-900/10 px-5 py-4 text-sm backdrop-blur-sm transition hover:bg-emerald-900/20"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-white font-medium">{r.patient_name ?? "-"}</span>
                        <span className="px-3 py-1 text-xs rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">Accepted</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenReview(r)}
                        className="glass-btn-secondary px-6"
                      >
                        Resume Review
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {viewState === "past" && !viewingPastCaseData && !pastCaseLoading && (
          <section className="glass-panel p-6 animate-in fade-in zoom-in-95 duration-500">
          <h2 className="medical-caption text-blue-400 mb-4">PAST CASES PROTOCOL</h2>
          <div className="mt-4">
            <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden overflow-y-auto" style={{ maxHeight: 600 }}>
              <table className="w-full text-sm text-left align-middle text-slate-300">
                <thead className="bg-white/5 border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider sticky top-0 backdrop-blur-xl">
                  <tr>
                    <th className="px-6 py-4 font-medium">Index</th>
                    <th className="px-6 py-4 font-medium">Patient ID</th>
                    <th className="px-6 py-4 font-medium">Priority</th>
                    <th className="px-6 py-4 font-medium">Rural Doctor Name</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pastRequests.map((r, i) => (
                    <tr key={r.id} className="transition-colors hover:bg-white/5">
                      <td className="px-6 py-4">{i + 1}</td>
                      <td className="px-6 py-4 font-medium text-slate-200">{r.generated_patient_id ?? "-"}</td>
                      <td className="px-6 py-4">
                        <span className={r.case_priority === "emergency" 
                          ? "px-3 py-1 text-xs rounded-full bg-red-500/20 border border-red-500/30 text-red-300 font-medium" 
                          : "px-3 py-1 text-xs rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 font-medium"}>
                          {r.case_priority === "emergency" ? "Emergency" : "Normal"}
                        </span>
                      </td>
                      <td className="px-6 py-4">{r.ruralDoctorName}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => loadFullCaseSummary(r.case_id, r.patient_id ?? "")}
                          className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 border border-blue-500/30 transition shadow-sm"
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
            <div className="glass-panel p-8 max-w-2xl mx-auto shadow-2xl animate-in flip-in-x-90 duration-500">
          <h2 className="medical-h2 text-blue-400 mb-2">Accept Request</h2>
          <p className="text-slate-300 text-sm mb-6 pb-6 border-b border-white/10">
            Patient: <span className="font-semibold text-white">{selectedRequest.patient_name ?? "-"}</span>
            <span className={`ml-3 px-3 py-1 text-xs rounded-full ${selectedRequest.case_priority === "emergency" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-blue-500/20 text-blue-300 border border-blue-500/30"}`}>
              {selectedRequest.case_priority === "emergency" ? "Emergency" : "Normal"}
            </span>
          </p>
          <form onSubmit={handleAcceptRequest} className="mt-4 space-y-6">
            <div>
              <label className="medical-caption text-slate-300 mb-2 block ml-1">Message for Originating Doctor (Optional)</label>
              <textarea
                rows={3}
                className="glass-input w-full"
                value={acceptMessage}
                onChange={(e) => setAcceptMessage(e.target.value)}
                placeholder="Acknowledge receipt or ask for supplementary protocol..."
              />
            </div>
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedRequest(null);
                  setViewState("list");
                }}
                className="glass-btn-secondary flex-1 justify-center"
              >
                Decline / Cancel
              </button>
              <button
                type="submit"
                disabled={accepting}
                className="glass-btn-primary flex-1 justify-center"
              >
                {accepting ? "Transmitting..." : "Accept Case"}
              </button>
            </div>
          </form>
          </div>
        ) : (
          <RequestSkeleton />
        )
      ) : null}

      {viewState === "review" ? (
        reviewData ? (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <button
              type="button"
              onClick={() => {
                setReviewData(null);
                resetExtendedReviewState();
                setViewState("list");
              }}
              className="glass-btn-secondary"
            >
              ← Return to Pending Queues
            </button>
            <div className="space-y-8 max-w-7xl mx-auto">
              <div className="glass-panel p-8">
                <h2 className="medical-h2 text-white">
                  Patient Package: <span className="text-blue-300">{reviewData.patientName ?? "Unknown"}</span> <span className="text-sm font-normal text-slate-400">({reviewData.generatedPatientId ?? "-"})</span>
                </h2>
                <div className="mt-4 flex items-center gap-3">
                  <span className="px-3 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">Review Stage</span>
                  {reviewRequest?.accepted_at ? <span className="px-3 py-1 text-xs rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300">Accepted Acknowledgment</span> : null}
                  {reviewRequest?.completed_at ? <span className="px-3 py-1 text-xs rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">Completed Response</span> : null}
                </div>
              </div>

            <CaseTimeline
              caseId={reviewData.caseId}
              timestamps={{
                caseCreated: reviewRequest?.created_at ?? null,
                specialistAssigned: reviewRequest?.accepted_at ?? null,
                diagnosisCompleted: timelineLocalTimestamps.diagnosisCompleted ?? null,
                treatmentGenerated: timelineLocalTimestamps.treatmentGenerated ?? null,
                followupScheduled: timelineLocalTimestamps.followupScheduled ?? null,
                caseFinalized: reviewRequest?.completed_at ?? null,
              }}
            />

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <div className="glass-panel p-6">
                  <h3 className="medical-caption text-blue-400 mb-4">Patient Parameters</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-slate-300">
                    <div className="rounded-lg bg-black/20 p-3 border border-white/5"><span className="text-slate-500 block text-xs">Name</span> {reviewData.patientName ?? "-"}</div>
                    <div className="rounded-lg bg-black/20 p-3 border border-white/5"><span className="text-slate-500 block text-xs">Age</span> {reviewData.patientMeta.age ?? "-"}</div>
                    <div className="rounded-lg bg-black/20 p-3 border border-white/5"><span className="text-slate-500 block text-xs">Gender</span> {reviewData.patientMeta.gender ?? "-"}</div>
                    <div className="rounded-lg bg-black/20 p-3 border border-white/5"><span className="text-slate-500 block text-xs">Height</span> {reviewData.patientMeta.height_cm ?? "-"} cm</div>
                    <div className="rounded-lg bg-black/20 p-3 border border-white/5"><span className="text-slate-500 block text-xs">Weight</span> {reviewData.patientMeta.weight_kg ?? "-"} kg</div>
                  </div>
                </div>

                <div className="glass-panel p-6">
                  <h3 className="medical-caption text-blue-400 mb-4">Clinical History</h3>
                  <div className="rounded-lg bg-black/20 p-4 border border-white/5">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{reviewData.patientHistory ?? "No history provided."}</p>
                  </div>
                </div>

                <div className="glass-panel p-6">
                  <h3 className="medical-caption text-blue-400 mb-4">Baseline Vitals & Spirometry</h3>
                  <div className="space-y-4 text-sm">
                    {reviewData.vitals.length === 0 && reviewData.spirometry.length === 0 && <div className="text-slate-500 italic">No readings logged</div>}
                    {reviewData.vitals.map((v, i) => (
                      <div key={`vital-${i}`} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="rounded bg-white/5 p-2 border border-white/5"><span className="block text-xs text-slate-500">BP</span><span className="text-white">{v.systolic_bp ?? "-"} / {v.diastolic_bp ?? "-"}</span></div>
                        <div className="rounded bg-white/5 p-2 border border-white/5"><span className="block text-xs text-slate-500">Temp</span><span className="text-white">{v.temperature_f ?? "-"} °F</span></div>
                        <div className="rounded bg-white/5 p-2 border border-white/5"><span className="block text-xs text-slate-500">SpO2</span><span className="text-emerald-400 font-medium">{v.spo2 == null ? "-" : `${v.spo2}%`}</span></div>
                        <div className="rounded bg-white/5 p-2 border border-white/5"><span className="block text-xs text-slate-500">Resp Rate</span><span className="text-blue-300">{v.respiratory_rate ?? "-"}</span></div>
                      </div>
                    ))}
                    {reviewData.spirometry.map((s, i) => (
                      <div key={`spiro-${i}`} className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 pt-2 border-t border-white/10">
                        <div className="rounded bg-white/5 p-2 border border-white/5"><span className="block text-[10px] text-slate-500">FVC</span><span className="text-white text-xs">{s.fvc == null ? "-" : `${s.fvc}L`}</span></div>
                        <div className="rounded bg-white/5 p-2 border border-white/5"><span className="block text-[10px] text-slate-500">FEV1</span><span className="text-white text-xs">{s.fev1 == null ? "-" : `${s.fev1}L`}</span></div>
                        <div className="rounded bg-white/5 p-2 border border-white/5"><span className="block text-[10px] text-slate-500">FEV1/FVC</span><span className="text-white text-xs">{s.fev1_fvc == null ? "-" : `${s.fev1_fvc}%`}</span></div>
                        <div className="rounded bg-white/5 p-2 border border-white/5"><span className="block text-[10px] text-slate-500">FEV1/FEV6</span><span className="text-white text-xs">{s.fev1_fev6 == null ? "-" : `${s.fev1_fev6}%`}</span></div>
                        <div className="rounded bg-white/5 p-2 border border-white/5"><span className="block text-[10px] text-slate-500">PEF</span><span className="text-white text-xs">{s.pef == null ? "-" : `${s.pef}L/m`}</span></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-panel p-6 border-l-4 border-indigo-500">
                  <h3 className="medical-caption text-indigo-400 mb-2">Originating Doctor Assessment</h3>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap italic bg-black/20 p-4 rounded-lg">"{reviewData.ruralDiagnosis ?? "No assessment provided"}"</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="glass-panel p-6 bg-gradient-to-br from-blue-900/30 to-black/30">
                  <h3 className="medical-caption text-blue-300 mb-4">Radiological Assets</h3>
                  <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-black/40 border border-white/10">
                    <p className="text-sm font-mono text-slate-400 truncate flex-1">
                      {reviewData.xrayPaths[0] ? `[DICOM] ${reviewData.xrayPaths[0].split("/").pop()}` : "No DICOM assigned"}
                    </p>
                    <button
                      type="button"
                      onClick={() => reviewData.xrayPaths[0] && openXrayModal(reviewData.xrayPaths[0])}
                      className="glass-btn-primary py-2 px-6 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                      disabled={!reviewData.xrayPaths[0]}
                    >
                      Initialize Viewer
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="col-span-2">
                <DiagnosisPanel
                  templates={diagnosisTemplates}
                  value={diagnosisForm}
                  loading={templatesLoading}
                  saving={diagnosisSaving}
                  onChange={setDiagnosisForm}
                  onSave={saveCaseDiagnosis}
                />
              </div>
              <div className="col-span-2">
                <TreatmentPanel
                  value={treatmentForm}
                  templateTitle={treatmentForm.treatmentTitle}
                  loading={templateDependentLoading}
                  saving={treatmentSaving}
                  onChange={setTreatmentForm}
                  onSave={saveTreatmentPlan}
                />
              </div>
            </div>

            <PrescriptionPanel
              rows={prescriptionRows}
              loading={templateDependentLoading}
              saving={prescriptionSaving}
              onChangeRow={(id, field, value) => {
                setPrescriptionRows((prev) =>
                  prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
                );
              }}
              onAddRow={() =>
                setPrescriptionRows((prev) => [
                  ...prev,
                  { id: `rx-${Date.now()}-${prev.length}`, medication: "", dosage: "", frequency: "", duration: "", notes: "" },
                ])
              }
              onRemoveRow={(id) =>
                setPrescriptionRows((prev) => {
                  if (prev.length === 1) return [{ id: prev[0].id, medication: "", dosage: "", frequency: "", duration: "", notes: "" }];
                  return prev.filter((row) => row.id !== id);
                })
              }
              onSave={savePrescription}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="col-span-2">
                <FurtherDiagnosticsChecklistPanel
                  furtherDiagnostics={furtherDiagnosticsTests}
                  customFurtherDiagnosticInput={furtherDiagnosticsCustomInput}
                  onCustomFurtherDiagnosticInputChange={setFurtherDiagnosticsCustomInput}
                  onAddCustomFurtherDiagnostic={() => {
                    const value = furtherDiagnosticsCustomInput.trim();
                    if (!value) return;
                    setFurtherDiagnosticsTests((prev) => (prev.includes(value) ? prev : [...prev, value]));
                    setFurtherDiagnosticsCustomInput("");
                  }}
                  onRemoveFurtherDiagnostic={(index) =>
                    setFurtherDiagnosticsTests((prev) => prev.filter((_, idx) => idx !== index))
                  }
                />
              </div>
              <div className="col-span-2">
                <FollowupPanel
                  interval={followupInterval}
                  date={followupDate}
                  notes={followupNotes}
                  saving={followupSaving}
                  onIntervalChange={setFollowupInterval}
                  onDateChange={setFollowupDate}
                  onNotesChange={setFollowupNotes}
                  onSave={saveFollowup}
                />
              </div>
            </div>

            <div className="mt-16 pt-8 border-t border-white/10 flex justify-center pb-12">
              <button
                type="button"
                onClick={handleFinishCase}
                disabled={finishing}
                className="glass-btn-primary w-full max-w-md py-4 text-lg font-bold shadow-[0_0_30px_rgba(37,99,235,0.5)] tracking-widest disabled:opacity-50"
              >
                {finishing ? "Finalizing Package..." : "FINALIZE PROTOCOL"}
              </button>
            </div>

          </div>
          </div>
        ) : (
          <DiagnosisSkeleton />
        )
      ) : null}

      {viewState === "past" && pastCaseLoading ? (
        <DiagnosisSkeleton />
      ) : null}

      {viewState === "past" && viewingPastCaseData ? (
        <div className="space-y-6 max-w-7xl mx-auto animate-in slide-in-from-bottom-4 duration-700 pb-12">
          <button
            type="button"
            onClick={() => {
              setViewingPastCaseData(null);
              viewingPastCaseIdRef.current = null;
              setViewState("past");
            }}
            className="glass-btn-secondary mb-4"
          >
            ← Back to Archive
          </button>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="glass-panel p-8 lg:col-span-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8">
                <span
                  className={`rounded-full px-5 py-2 text-sm font-bold tracking-widest uppercase shadow-xl ${
                    viewingPastCaseData.case_status === "finalized" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]" : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  }`}
                >
                  {viewingPastCaseData.case_status === "finalized" ? "Archived // Finalized" : "Active Assessment"}
                </span>
              </div>
              <h2 className="medical-caption text-blue-400 mb-2">Patient Overview</h2>
              <h1 className="medical-h1">{viewingPastCaseData.patient?.name ?? "Unknown Patient"}</h1>
              <p className="mt-1 text-slate-400 font-mono text-sm tracking-wider">ID: {viewingPastCaseData.patient?.generated_patient_id ?? "Not Provided"}</p>
              
              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/5 bg-black/20 p-5">
                  <span className="text-slate-500 block text-xs mb-1 uppercase tracking-wider font-bold">Age</span>
                  <span className="text-white text-lg">{viewingPastCaseData.patient?.age ?? "-"}</span>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-5">
                  <span className="text-slate-500 block text-xs mb-1 uppercase tracking-wider font-bold">Gender</span>
                  <span className="text-white text-lg capitalize">{viewingPastCaseData.patient?.gender ?? "-"}</span>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-5">
                  <span className="text-slate-500 block text-xs mb-1 uppercase tracking-wider font-bold">Height</span>
                  <span className="text-white text-lg">{viewingPastCaseData.patient?.height_cm ?? "-"} cm</span>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-5">
                  <span className="text-slate-500 block text-xs mb-1 uppercase tracking-wider font-bold">Weight</span>
                  <span className="text-white text-lg">{viewingPastCaseData.patient?.weight_kg ?? "-"} kg</span>
                </div>
              </div>
              
              <div className="mt-6 rounded-xl border border-white/5 bg-black/20 p-6">
                <h3 className="medical-caption text-blue-300 mb-3 block">Clinical Context</h3>
                <p className="leading-relaxed text-slate-300 opacity-90">{viewingPastCaseData.patient?.smoking_history ?? "No history recorded."}</p>
              </div>
            </div>

            <div className="glass-panel p-6 lg:col-span-2">
              <h2 className="medical-caption text-blue-400 mb-6">Physiological Telemetry</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-9">
                <div className="rounded-lg bg-black/30 border border-white/5 p-4 text-center flex flex-col justify-between">
                  <p className="text-xs text-slate-500 font-bold mb-2">BP</p>
                  <p className="text-sm lg:text-lg font-bold text-white tracking-wider">
                    {viewingPastCaseData.vitals?.systolic_bp ?? "-"} / {viewingPastCaseData.vitals?.diastolic_bp ?? "-"}
                  </p>
                </div>
                <div className="rounded-lg bg-black/30 border border-white/5 p-4 text-center flex flex-col justify-between">
                  <p className="text-xs text-slate-500 font-bold mb-2">Temp</p>
                  <p className="text-sm lg:text-lg font-bold text-white tracking-wider">{viewingPastCaseData.vitals?.temperature_f ?? "-"} °F</p>
                </div>
                <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/20 p-4 text-center flex flex-col justify-between">
                  <p className="text-xs text-emerald-500/70 font-bold mb-2">SpO2</p>
                  <p className="text-sm lg:text-lg font-bold text-emerald-400 tracking-wider shadow-emerald-500/20 drop-shadow-md">{viewingPastCaseData.vitals?.spo2 == null ? "—" : `${viewingPastCaseData.vitals.spo2}%`}</p>
                </div>
                <div className="rounded-lg bg-blue-950/20 border border-blue-500/20 p-4 text-center flex flex-col justify-between">
                  <p className="text-xs text-blue-500/70 font-bold mb-2">Resp</p>
                  <p className="text-sm lg:text-lg font-bold text-blue-400 tracking-wider">{viewingPastCaseData.vitals?.respiratory_rate == null ? "—" : viewingPastCaseData.vitals.respiratory_rate}</p>
                </div>
                <div className="rounded-lg bg-black/30 border border-white/5 p-4 text-center flex flex-col justify-between transition hover:bg-white/5">
                  <p className="text-[10px] text-slate-500 font-bold mb-2">FVC</p>
                  <p className="text-sm lg:text-base font-bold text-white tracking-wider">{viewingPastCaseData.spirometry?.fvc == null ? "—" : `${viewingPastCaseData.spirometry.fvc}L`}</p>
                </div>
                <div className="rounded-lg bg-black/30 border border-white/5 p-4 text-center flex flex-col justify-between transition hover:bg-white/5">
                  <p className="text-[10px] text-slate-500 font-bold mb-2">FEV1</p>
                  <p className="text-sm lg:text-base font-bold text-white tracking-wider">{viewingPastCaseData.spirometry?.fev1 == null ? "—" : `${viewingPastCaseData.spirometry.fev1}L`}</p>
                </div>
                <div className="rounded-lg bg-black/30 border border-white/5 p-4 text-center flex flex-col justify-between transition hover:bg-white/5">
                  <p className="text-[10px] text-slate-500 font-bold mb-2">FEV1/FVC</p>
                  <p className="text-sm lg:text-base font-bold text-white tracking-wider">{viewingPastCaseData.spirometry?.fev1_fvc == null ? "—" : `${viewingPastCaseData.spirometry.fev1_fvc}%`}</p>
                </div>
                <div className="rounded-lg bg-black/30 border border-white/5 p-4 text-center flex flex-col justify-between transition hover:bg-white/5">
                  <p className="text-[10px] text-slate-500 font-bold mb-2">FEV1/FEV6</p>
                  <p className="text-sm lg:text-base font-bold text-white tracking-wider">{viewingPastCaseData.spirometry?.fev1_fev6 == null ? "—" : `${viewingPastCaseData.spirometry.fev1_fev6}%`}</p>
                </div>
                <div className="rounded-lg bg-black/30 border border-white/5 p-4 text-center flex flex-col justify-between transition hover:bg-white/5">
                  <p className="text-[10px] text-slate-500 font-bold mb-2">PEF</p>
                  <p className="text-sm lg:text-base font-bold text-white tracking-wider">{viewingPastCaseData.spirometry?.pef == null ? "—" : `${viewingPastCaseData.spirometry.pef}L/m`}</p>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 border-l-4 border-indigo-500/50 bg-gradient-to-br from-indigo-900/10 to-transparent">
              <h2 className="medical-caption text-indigo-400 mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-400"></div> Originating Assessment</h2>
              <div className="rounded-xl bg-black/20 p-5 italic border border-white/5 relative">
                <span className="absolute top-2 left-2 text-4xl text-indigo-500/20 font-serif leading-none">"</span>
                <p className="leading-relaxed text-slate-300 relative z-10 pl-4">{viewingPastCaseData.rural_diagnosis ?? "Not Provided"}</p>
              </div>
            </div>

            <div className="glass-panel p-6 border-l-4 border-emerald-500/50 bg-gradient-to-br from-emerald-900/10 to-transparent">
              <h2 className="medical-caption text-emerald-400 mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Specialist Protocol</h2>
              <div className="space-y-4 text-sm text-slate-300 bg-black/20 p-5 rounded-xl border border-white/5">
                <div className="grid grid-cols-[140px_1fr] items-start border-b border-white/5 pb-2"><span className="text-slate-500 font-medium">Primary Condition:</span> <span className="font-bold text-white">{viewingPastCaseData.diagnosis?.diagnosis_name ?? "Not Provided"}</span></div>
                <div className="grid grid-cols-[140px_1fr] items-center border-b border-white/5 pb-2"><span className="text-slate-500 font-medium">Severity Logic:</span> <span className="text-amber-400 font-medium">{viewingPastCaseData.diagnosis?.severity ?? "Not Provided"}</span></div>
                <div className="grid grid-cols-[140px_1fr] items-center border-b border-white/5 pb-2"><span className="text-slate-500 font-medium">Evaluating Specialist:</span> <span>Dr. {viewingPastCaseData.specialist_name ?? "Not Provided"}</span></div>
                <div className="grid grid-cols-[140px_1fr] items-start"><span className="text-slate-500 font-medium">Clinical Thesis:</span> <span className="italic">"{viewingPastCaseData.diagnosis?.specialist_notes ?? "Not Provided"}"</span></div>
              </div>
            </div>

            {(viewingPastCaseData.case_status === "completed" || viewingPastCaseData.case_status === "finalized") && (
              <>
                <div className="lg:col-span-2 mt-4 space-y-6">
                  <TreatmentViewer
                    medications={viewingPastCaseData.treatment?.medications ?? null}
                    inhalerTherapy={viewingPastCaseData.treatment?.inhaler_therapy ?? null}
                    oxygenTherapy={
                      viewingPastCaseData.treatment?.oxygen_therapy === true
                        ? "Required"
                        : viewingPastCaseData.treatment?.oxygen_therapy === false
                          ? "Not Required"
                          : null
                    }
                    pulmonaryRehab={viewingPastCaseData.treatment?.pulmonary_rehabilitation ?? null}
                    lifestyleAdvice={viewingPastCaseData.treatment?.lifestyle_recommendations ?? null}
                    referralNotes={viewingPastCaseData.treatment?.referral_recommendation ?? null}
                  />
                  <PrescriptionViewer rows={viewingPastCaseData.prescriptions ?? []} />
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="glass-panel p-6">
                      <h3 className="medical-caption text-blue-400 mb-4 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> Pending Further Investigations</h3>
                      <div className="bg-black/20 border border-white/5 rounded-xl p-5">
                      {(viewingPastCaseData.followup?.diagnostic_procedures?.length ?? 0) === 0 ? (
                        <p className="text-sm text-slate-500 italic">No further diagnostic protocol attached.</p>
                      ) : (
                        <ol className="list-decimal ml-5 text-sm text-slate-300 space-y-2 marker:text-blue-500">
                          {(viewingPastCaseData.followup?.diagnostic_procedures ?? []).map((test, idx) => (
                            <li key={idx} className="pl-1">{test}</li>
                          ))}
                        </ol>
                      )}
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <FollowupTracker nextFollowupDate={viewingPastCaseData.followup?.scheduled_date ?? null} />
                      <div className="glass-panel p-6">
                        <h3 className="medical-caption text-blue-400 mb-4 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> Consultation Directives</h3>
                        <div className="bg-black/20 border border-white/5 rounded-xl p-5">
                          <p className="whitespace-pre-wrap text-sm text-slate-300">{viewingPastCaseData.followup?.notes ?? "Not Provided"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <CaseTimeline
                    caseId={viewingPastCaseIdRef.current}
                    timestamps={{
                      caseCreated: viewingPastCaseData.case_created_at ?? null,
                      specialistAssigned: viewingPastCaseData.specialist_accepted_at ?? null,
                      diagnosisCompleted: viewingPastCaseData.diagnosis?.created_at ?? null,
                      treatmentGenerated: viewingPastCaseData.treatment?.created_at ?? null,
                      followupScheduled: viewingPastCaseData.followup?.created_at ?? null,
                      caseFinalized: viewingPastCaseData.case_status === "finalized" ? viewingPastCaseData.specialist_completed_at ?? null : null,
                    }}
                  />
                </div>
              </>
            )}

            <div className="glass-panel p-6 lg:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-blue-500">
              <div>
                <h3 className="medical-caption text-blue-400 mb-1">Radiological Archive</h3>
                <p className="text-sm font-mono text-slate-400">
                  {viewingPastCaseData.xrays && viewingPastCaseData.xrays.length > 0 ? `[DICOM DATA STREAM] ${viewingPastCaseData.xrays[0].path.split("/").pop()}` : "[NO IMAGING ATTACHED]"}
                </p>
              </div>
              {viewingPastCaseData.xrays && viewingPastCaseData.xrays.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setXrayUrl(null);
                    setXrayPath(viewingPastCaseData.xrays?.[0]?.path ?? null);
                    setShowXrayModal(true);
                  }}
                  className="glass-btn-primary py-2 px-6 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                >
                  Initialize Viewer
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <DicomViewer
        isOpen={showXrayModal}
        xrayUrl={xrayUrl}
        xrayPath={xrayPath}
        allowAnnotation
        onClose={() => {
          setShowXrayModal(false);
          setXrayUrl(null);
          setXrayPath(null);
        }}
      />
      </main>
    </div>
  );
}
