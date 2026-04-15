"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Activity, Cpu, HeartPulse, Hospital, Microscope, ScanLine, Stethoscope, Wind } from "lucide-react";

type Role = "patient" | "rural_doctor" | "specialist" | null;
type View = "initial" | "role-selection" | "login" | "register";

const medicalIcons = [
  { label: "Lungs", Icon: Activity },
  { label: "Stethoscope", Icon: Stethoscope },
  { label: "Hospital", Icon: Hospital },
  { label: "Heartbeat", Icon: HeartPulse },
  { label: "X-ray", Icon: ScanLine },
  { label: "AI Chip", Icon: Cpu },
  { label: "Spirometry", Icon: Microscope },
] as const;

const roleSelectionBackgroundIcons = [
  { Icon: HeartPulse, position: "top-[8%] left-[12%]" },
  { Icon: Activity, position: "top-[16%] right-[10%] hidden sm:block" },
  { Icon: Stethoscope, position: "top-[38%] left-[8%] hidden md:block" },
  { Icon: Hospital, position: "top-[56%] right-[14%]" },
  { Icon: Cpu, position: "bottom-[16%] left-[18%] hidden sm:block" },
  { Icon: ScanLine, position: "bottom-[10%] right-[22%] hidden md:block" },
  { Icon: Microscope, position: "top-[10%] left-1/2 -translate-x-1/2 hidden sm:block" },
  { Icon: Wind, position: "bottom-[8%] left-1/2 -translate-x-1/2" },
] as const;

const getRoleLabel = (role: Role) => {
  if (role === "patient") return "Patient";
  if (role === "rural_doctor") return "Rural Doctor";
  if (role === "specialist") return "Specialist";
  return "";
};

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("initial");
  const [role, setRole] = useState<Role>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientPhone, setPatientPhone] = useState("");

  const [regName, setRegName] = useState("");
  const [regDoctorId, setRegDoctorId] = useState("");
  const [regPhoneNumber, setRegPhoneNumber] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regHospitalLocation, setRegHospitalLocation] = useState("");

  const handleInitialLogin = () => {
    setView("role-selection");
    setError(null);
  };

  const handleRoleSelect = (selectedRole: Role) => {
    setRole(selectedRole);
    setView("login");
    setError(null);
    setShowRegister(false);
    setStep(1);
    setEmail("");
    setPassword("");
    setPatientId("");
    setPatientPhone("");
  };

  const handleDoctorSpecialistLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? "Login failed");
      setLoading(false);
      return;
    }

    const { data: profileRows } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .limit(1);
    const profile = profileRows?.[0] as { role?: string } | undefined;

    setLoading(false);

    if (!profile) {
      setError("Unable to fetch user profile");
      return;
    }

    const expectedRole = role === "rural_doctor" ? "rural_doctor" : "specialist";
    if (profile.role !== expectedRole) {
      setError("Invalid role for this account");
      return;
    }

    if (profile.role === "rural_doctor") {
      router.push("/dashboard/rural");
    } else {
      router.push("/dashboard/specialist");
    }
  };

  const handlePatientLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanPatientId = patientId.trim();
    const cleanPhone = patientPhone.trim();

    const { data: patientRow, error } = await supabase
      .from("patients")
      .select("id, name, generated_patient_id, phone_number")
      .eq("generated_patient_id", cleanPatientId)
      .eq("phone_number", cleanPhone)
      .maybeSingle();

    if (error) {
      console.error(error);
      setError("Login failed. Please try again.");
      setLoading(false);
      return;
    }

    if (!patientRow) {
      setError("Invalid Patient ID or Phone");
      setLoading(false);
      return;
    }

    setLoading(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("patient_id", patientRow.id);
      localStorage.setItem("patient_generated_id", patientRow.generated_patient_id ?? "");
    }
    router.push("/dashboard/patient");
  };

  const handleRegisterStep1 = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep(2);
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
    });

    if (signUpError || !authData.user) {
      setError(signUpError?.message ?? "Registration failed");
      setLoading(false);
      return;
    }

    const roleValue = role === "rural_doctor" ? "rural_doctor" : role === "specialist" ? "specialist" : null;
    if (!roleValue) {
      setError("Invalid role for registration");
      setLoading(false);
      return;
    }
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      role: roleValue,
      full_name: regName,
      doctor_verification_id: regDoctorId,
      phone_number: regPhoneNumber,
      hospital_name: regHospitalLocation || null,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setSuccess("Registration Successful");
    setStep(3);
  };

  const authTitle = (() => {
    if (view === "role-selection") return "Select Your Role";
    if (view === "login" && role === "patient") return "Patient Login";
    if (view === "login" && (role === "rural_doctor" || role === "specialist") && !showRegister) {
      return `${getRoleLabel(role)} Login`;
    }
    if (view === "login" && showRegister && step === 1) return `Register as ${getRoleLabel(role)}`;
    if (view === "login" && showRegister && step === 2) return "Complete Your Registration";
    if (view === "login" && showRegister && step === 3) return "Registration Successful";
    return "Tele-Pulmonology";
  })();

  const authSubtitle =
    view === "role-selection"
      ? "Access the Tele-Pulmonology network and collaborate with specialists for faster respiratory diagnosis."
      : view === "login" && showRegister
        ? "Create your Tele-Pulmonology account to start assisting patients remotely."
        : "Access the Tele-Pulmonology network and collaborate with specialists for faster respiratory diagnosis.";

  return (
    <div className="page-transition-shell relative min-h-screen">
      {view === "initial" && (
        <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 py-10 md:px-10 lg:grid-cols-2 z-10 relative">
          <div className="glass-panel p-8 md:p-12">
            <h1 className="text-4xl font-bold leading-tight md:text-5xl tracking-tight text-slate-800 dark:text-slate-100">
              Remote <span className="text-blue-600 dark:text-blue-400">Pulmonary Care</span>,
              <br />
              Anywhere.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300 md:text-lg">
              AI-assisted tele-pulmonology platform connecting rural doctors with specialists for rapid diagnosis using vitals, spirometry, and chest X-ray analysis.
            </p>
            <button
              type="button"
              onClick={handleInitialLogin}
              className="glass-btn-primary mt-8 py-3 px-8 text-base"
            >
              Let&apos;s Login
            </button>
          </div>
          <div className="glass-panel p-6 md:p-8">
              <div className="grid grid-cols-3 gap-4 md:gap-6">
                {medicalIcons.map(({ label, Icon }, index) => (
                  <div
                    key={label}
                    className="animate-float rounded-2xl bg-white/80 border border-slate-200/50 p-4 shadow-sm backdrop-blur-xl dark:border-white/5 dark:bg-black/20 md:p-6"
                    style={{ animationDelay: `${index * 0.2}s` }}
                  >
                    <Icon className="mx-auto h-8 w-8 text-blue-500 dark:text-blue-300 md:h-10 md:w-10" />
                    <p className="mt-3 text-center text-xs font-medium text-gray-600 dark:text-slate-300 md:text-sm">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
        </div>
      )}

      {view !== "initial" && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {roleSelectionBackgroundIcons.map(({ Icon, position }, index) => (
            <div key={`auth-bg-icon-${index}`} className={`absolute ${position} animate-float`} style={{ animationDelay: `${index * 0.3}s` }}>
              <Icon className="h-16 w-16 text-slate-500/20 dark:text-slate-300/10" />
            </div>
          ))}
        </div>
      )}

      {view !== "initial" && (
        <div className="relative z-10 flex min-h-screen w-full items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-8">
            <header className="mb-8 text-center">
              <h1 className="text-center text-3xl font-bold tracking-tight text-slate-800 dark:text-white">{authTitle}</h1>
              <p className="mt-3 text-center text-sm font-medium text-slate-500 dark:text-slate-400">{authSubtitle}</p>
            </header>

            {view === "role-selection" && (
              <div className="space-y-4 transition-all duration-300 ease-out opacity-100 scale-100" key="roles">
                <button
                  type="button"
                  onClick={() => handleRoleSelect("patient")}
                  className="w-full glass-btn-primary py-3"
                >
                  Patient
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSelect("rural_doctor")}
                  className="w-full glass-btn-primary py-3"
                >
                  Rural Doctor
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSelect("specialist")}
                  className="w-full glass-btn-primary py-3"
                >
                  Specialist
                </button>
                <button
                  type="button"
                  onClick={() => setView("initial")}
                  className="w-full py-2 text-sm text-slate-500 transition-colors hover:text-blue-500"
                >
                  &larr; Back
                </button>
              </div>
            )}

            {view === "login" && role === "patient" && (
              <form
                onSubmit={handlePatientLogin}
                className="space-y-4 transition-all duration-300 ease-out opacity-100"
                key="patient-login"
              >
                <input
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  placeholder="Patient ID"
                  className="glass-input"
                  required
                />
                <input
                  type="tel"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="glass-input"
                  required
                />
                {error && <p className="text-sm font-medium text-red-500 dark:text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full glass-btn-primary py-3 mt-4"
                >
                  {loading ? "Signing in..." : "Login"}
                </button>
                <button
                  type="button"
                  onClick={() => setView("role-selection")}
                  className="w-full py-2 text-sm text-slate-500 transition-colors hover:text-blue-500"
                >
                  &larr; Back
                </button>
              </form>
            )}

            {view === "login" && (role === "rural_doctor" || role === "specialist") && !showRegister && (
              <form
                onSubmit={handleDoctorSpecialistLogin}
                className="space-y-4 transition-all duration-300 ease-out opacity-100"
                key="doctor-login"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="glass-input"
                  required
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="glass-input"
                  required
                />
                {error && <p className="text-sm font-medium text-red-500 dark:text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full glass-btn-primary py-3 mt-4"
                >
                  {loading ? "Signing in..." : "Login"}
                </button>
                <p className="text-sm text-center text-slate-500 dark:text-slate-400">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegister(true);
                      setStep(1);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-blue-500 hover:underline"
                  >
                    Register
                  </button>
                </p>
                <button
                  type="button"
                  onClick={() => setView("role-selection")}
                  className="w-full py-2 text-sm text-slate-500 transition-colors hover:text-blue-500"
                >
                  &larr; Back
                </button>
              </form>
            )}

            {view === "login" && (role === "rural_doctor" || role === "specialist") && showRegister && step === 1 && (
              <form
                onSubmit={handleRegisterStep1}
                className="space-y-4 transition-all duration-300 ease-out opacity-100"
                key="register-step-1"
              >
                <input
                  type="text"
                  placeholder="Name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="glass-input"
                  required
                />
                <input
                  type="text"
                  placeholder="Doctor Verification ID"
                  value={regDoctorId}
                  onChange={(e) => setRegDoctorId(e.target.value)}
                  className="glass-input"
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={regPhoneNumber}
                  onChange={(e) => setRegPhoneNumber(e.target.value)}
                  className="glass-input"
                  required
                />
                <input
                  type="text"
                  placeholder="Hospital Location"
                  value={regHospitalLocation}
                  onChange={(e) => setRegHospitalLocation(e.target.value)}
                  className="glass-input"
                  required
                />
                {error && <p className="text-sm font-medium text-red-500 dark:text-red-400">{error}</p>}
                <button
                  type="submit"
                  className="w-full glass-btn-primary py-3"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRegister(false);
                    setError(null);
                  }}
                  className="w-full py-2 text-sm text-slate-500 transition-colors hover:text-blue-500"
                >
                  &larr; Back to Login
                </button>
              </form>
            )}

            {view === "login" && (role === "rural_doctor" || role === "specialist") && showRegister && step === 2 && (
              <form
                onSubmit={handleRegister}
                className="space-y-4 transition-all duration-300 ease-out opacity-100"
                key="register-step-2"
              >
                <input
                  type="email"
                  placeholder="Email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="glass-input"
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="glass-input"
                  required
                />
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className="glass-input"
                  required
                />
                {error && <p className="text-sm font-medium text-red-500 dark:text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full glass-btn-primary py-3"
                >
                  {loading ? "Registering..." : "Next"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError(null);
                  }}
                  className="w-full py-2 text-sm text-slate-500 transition-colors hover:text-blue-500"
                >
                  &larr; Back
                </button>
              </form>
            )}

            {view === "login" && (role === "rural_doctor" || role === "specialist") && showRegister && step === 3 && (
              <div className="space-y-4 transition-all duration-300 ease-out opacity-100" key="register-success">
                {success && (
                  <div className="rounded-2xl border border-green-200 bg-green-100/80 px-4 py-3 text-sm font-medium text-green-800 dark:border-green-500/30 dark:bg-green-900/30 dark:text-green-200">
                    {success}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowRegister(false);
                    setStep(1);
                    setError(null);
                  }}
                  className="w-full py-2 text-sm text-slate-500 transition-colors hover:text-blue-500"
                >
                  &larr; Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
