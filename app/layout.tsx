import "./globals.css";
import type { ReactNode } from "react";
import PageTransition from "@/components/ui/PageTransition";

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="font-sans">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen relative overflow-x-hidden selection:bg-blue-500/30">
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
