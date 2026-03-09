"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import PatientDashboardUI from "./PatientDashboardUI";

export default function PatientPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading dashboard...</div>}>
      <PatientDashboardUI />
    </Suspense>
  );
}
