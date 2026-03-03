"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Role = "patient" | "rural_doctor" | "specialist" | null;
type View = "initial" | "role-selection" | "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("initial");
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientPhone, setPatientPhone] = useState("");

  const [regName, setRegName] = useState("");
  const [regDoctorId, setRegDoctorId] = useState("");
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

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("*")
      .eq("generated_patient_id", patientId)
      .eq("phone_number", patientPhone)
      .maybeSingle();

    if (patientError || !patient) {
      setError("Invalid Patient ID or Phone");
      setLoading(false);
      return;
    }

    setLoading(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("patient_id", patient.id);
      localStorage.setItem("patient_generated_id", patient.generated_patient_id ?? "");
    }
    router.push("/dashboard/patient");
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

    const roleValue = role === "rural_doctor" ? "rural_doctor" : "specialist";
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      role: roleValue,
      full_name: regName,
      hospital_name: regHospitalLocation || null,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setSuccess("Successfully Registered");
    setRegName("");
    setRegDoctorId("");
    setRegEmail("");
    setRegPassword("");
    setRegConfirmPassword("");
    setRegHospitalLocation("");

    setTimeout(() => {
      setSuccess(null);
      setView("login");
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-md rounded-2xl border-2 border-neutral-700 bg-white p-8 shadow-xl font-sans">
          <header className="text-center mb-8">
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
              WELCOME TO TELE-PULMONOLOGY
            </h1>
            <p className="text-sm font-bold text-neutral-700">
              Bringing the Expertise of the Sky to the People of the Ground
            </p>
          </header>

          {view === "initial" && (
            <div
              className="transition-all duration-300 ease-out opacity-100 scale-100"
              key="initial"
            >
              <button
                type="button"
                onClick={handleInitialLogin}
                className="w-full py-3 px-4 bg-pneuma-red text-white rounded-xl font-medium transition-all duration-300 hover:bg-pneuma-red-hover"
              >
                Login
              </button>
            </div>
          )}

          {view === "role-selection" && (
            <div
              className="space-y-3 transition-all duration-300 ease-out opacity-100 scale-100"
              key="roles"
            >
              <button
                type="button"
                onClick={() => handleRoleSelect("patient")}
                className="w-full py-3 px-4 bg-pneuma-red text-white rounded-xl font-medium transition-all duration-300 hover:bg-pneuma-red-hover"
              >
                PATIENT
              </button>
              <button
                type="button"
                onClick={() => handleRoleSelect("rural_doctor")}
                className="w-full py-3 px-4 bg-pneuma-red text-white rounded-xl font-medium transition-all duration-300 hover:bg-pneuma-red-hover"
              >
                RURAL DOCTOR
              </button>
              <button
                type="button"
                onClick={() => handleRoleSelect("specialist")}
                className="w-full py-3 px-4 bg-pneuma-red text-white rounded-xl font-medium transition-all duration-300 hover:bg-pneuma-red-hover"
              >
                SPECIALIST
              </button>
              <button
                type="button"
                onClick={() => setView("initial")}
                className="w-full py-2 text-neutral-600 text-sm hover:text-neutral-900 transition-colors"
              >
                ← Back
              </button>
            </div>
          )}

          {view === "login" && role === "patient" && (
            <form
              onSubmit={handlePatientLogin}
              className="space-y-4 transition-all duration-300 ease-out opacity-100"
              key="patient-login"
            >
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Patient ID
                </label>
                <input
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-xl text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-xl text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:border-transparent"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-pneuma-red text-white rounded-xl font-medium transition-all duration-300 disabled:opacity-50 hover:bg-pneuma-red-hover"
              >
                {loading ? "Signing in..." : "Login"}
              </button>
              <button
                type="button"
                onClick={() => setView("role-selection")}
                className="w-full py-2 text-neutral-600 text-sm hover:text-neutral-900 transition-colors"
              >
                ← Back
              </button>
            </form>
          )}

          {view === "login" && (role === "rural_doctor" || role === "specialist") && (
            <form
              onSubmit={handleDoctorSpecialistLogin}
              className="space-y-4 transition-all duration-300 ease-out opacity-100"
              key="doctor-login"
            >
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-xl text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-xl text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:border-transparent"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-pneuma-red text-white rounded-xl font-medium transition-all duration-300 disabled:opacity-50 hover:bg-pneuma-red-hover"
              >
                {loading ? "Signing in..." : "Login"}
              </button>
              <button
                type="button"
                onClick={() => setView("register")}
                className="w-full text-sm font-medium text-pneuma-red hover:text-pneuma-red-hover transition-colors"
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => setView("role-selection")}
                className="w-full py-2 text-neutral-600 text-sm hover:text-neutral-900 transition-colors"
              >
                ← Back
              </button>
            </form>
          )}

          {view === "register" && (role === "rural_doctor" || role === "specialist") && (
            <form
              onSubmit={handleRegister}
              className="space-y-4 transition-all duration-300 ease-out opacity-100"
              key="register"
            >
              <input
                type="text"
                placeholder="Name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-500 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Doctor Verification ID"
                value={regDoctorId}
                onChange={(e) => setRegDoctorId(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-500 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:border-transparent"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-500 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:border-transparent"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-500 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:border-transparent"
                required
              />
              <input
                type="password"
                placeholder="Confirm Password"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-500 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Hospital Location"
                value={regHospitalLocation}
                onChange={(e) => setRegHospitalLocation(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-500 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:border-transparent"
                required
              />
              {success && (
                <div className="py-3 px-4 rounded-xl bg-green-100 text-green-800 text-sm font-medium">
                  {success}
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-pneuma-red text-white rounded-xl font-medium transition-all duration-300 disabled:opacity-50 hover:bg-pneuma-red-hover"
              >
                {loading ? "Registering..." : "Submit"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("login");
                  setError(null);
                }}
                className="w-full py-2 text-neutral-600 text-sm hover:text-neutral-900 transition-colors"
              >
                ← Back to Login
              </button>
            </form>
          )}
      </div>
    </div>
  );
}
