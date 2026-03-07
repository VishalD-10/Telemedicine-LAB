"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Activity, Cpu, HeartPulse, Hospital, Microscope, ScanLine, Stethoscope, Wind } from "lucide-react";

type Role = "rural_doctor" | "specialist";

type Step = 1 | 2 | 3;

const backgroundIcons = [
  { Icon: HeartPulse, position: "top-[8%] left-[10%]" },
  { Icon: Stethoscope, position: "top-[18%] right-[12%] hidden sm:block" },
  { Icon: Activity, position: "top-[40%] left-[8%] hidden md:block" },
  { Icon: Hospital, position: "top-[58%] right-[16%]" },
  { Icon: Cpu, position: "bottom-[12%] left-[22%]" },
  { Icon: ScanLine, position: "bottom-[10%] right-[24%] hidden md:block" },
  { Icon: Microscope, position: "top-[10%] left-1/2 -translate-x-1/2 hidden sm:block" },
  { Icon: Wind, position: "bottom-[6%] left-1/2 -translate-x-1/2" },
] as const;

export default function DoctorRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [doctorName, setDoctorName] = useState("");
  const [doctorVerificationId, setDoctorVerificationId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [role, setRole] = useState<Role>("rural_doctor");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleNext = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setStep(2);
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "Registration failed");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      role,
      full_name: doctorName,
      doctor_verification_id: doctorVerificationId,
      phone_number: phoneNumber,
      hospital_name: hospitalName,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep(3);
  };

  const roleLabel = role === "rural_doctor" ? "Rural Doctor" : "Specialist";
  const title =
    step === 1
      ? `Register as ${roleLabel}`
      : step === 2
        ? "Complete Your Registration"
        : `${roleLabel} Registration Successful`;

  const baseInputClass =
    "w-full rounded-full px-5 py-3 border outline-none bg-white border-gray-300 text-slate-900 placeholder:text-slate-500 dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder:text-slate-300";

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-slate-100 to-blue-100 p-6 text-slate-900 dark:from-black dark:via-slate-900 dark:to-blue-900 dark:text-slate-100">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {backgroundIcons.map(({ Icon, position }, index) => (
          <div key={`register-bg-icon-${index}`} className={`absolute ${position} animate-float`} style={{ animationDelay: `${index * 0.3}s` }}>
            <Icon className="h-16 w-16 text-slate-500/20 dark:text-slate-300/10" />
          </div>
        ))}
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white/70 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <header className="mb-8 text-center">
            <h1 className="text-3xl font-semibold">{title}</h1>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Create your Tele-Pulmonology account to start assisting patients remotely.
            </p>
          </header>

          {step === 1 && (
            <form onSubmit={handleNext} className="space-y-4">
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="Name"
                className={baseInputClass}
                required
              />
              <input
                type="text"
                value={doctorVerificationId}
                onChange={(e) => setDoctorVerificationId(e.target.value)}
                placeholder="Doctor Verification ID"
                className={baseInputClass}
                required
              />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Phone Number"
                className={baseInputClass}
                required
              />
              <input
                type="text"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="Hospital Location"
                className={baseInputClass}
                required
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={baseInputClass}
              >
                <option value="rural_doctor">Rural Doctor</option>
                <option value="specialist">Specialist</option>
              </select>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="submit"
                className="w-full rounded-full py-3 text-white font-medium bg-gradient-to-r from-blue-500 to-indigo-600 transition hover:from-blue-600 hover:to-indigo-700"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full py-2 text-sm text-slate-500 transition-colors hover:text-blue-500"
              >
                &larr; Back
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className={baseInputClass}
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={baseInputClass}
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className={baseInputClass}
                required
              />
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full py-3 text-white font-medium bg-gradient-to-r from-blue-500 to-indigo-600 transition hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50"
              >
                {loading ? "Registering..." : "Next"}
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-2 text-sm text-slate-500 transition-colors hover:text-blue-500"
              >
                &larr; Back
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              <div className="rounded-2xl border border-green-200 bg-green-100/80 px-4 py-3 text-sm font-medium text-green-800 dark:border-green-500/30 dark:bg-green-900/30 dark:text-green-200">
                Doctor Registration Successful
              </div>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full py-2 text-sm text-slate-500 transition-colors hover:text-blue-500"
              >
                &larr; Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
