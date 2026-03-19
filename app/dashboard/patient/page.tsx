"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import PatientDashboardUI from "./PatientDashboardUI";

export default function PatientPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-blue-50 p-10">
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/50 bg-white/80 p-8 text-center shadow-md backdrop-blur-xl">
            Loading dashboard...
          </div>
        </div>
      }
    >
      <PatientDashboardUI />
    </Suspense>
  );
}
