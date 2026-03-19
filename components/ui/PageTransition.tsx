"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

type PageTransitionProps = {
  children: ReactNode;
};

function getThemeClass(pathname: string) {
  if (pathname.includes("/dashboard/specialist")) return "theme-specialist";
  if (pathname.includes("/dashboard/rural")) return "theme-rural";
  if (pathname.includes("/dashboard/patient")) return "theme-patient";
  return "theme-default";
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const themeClass = getThemeClass(pathname);

  return (
    <div key={pathname} className={`page-transition-shell ${themeClass}`}>
      <div className="page-transition-content">{children}</div>
    </div>
  );
}
