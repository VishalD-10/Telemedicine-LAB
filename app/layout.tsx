import "./globals.css";
import type { ReactNode } from "react";
import PageTransition from "@/components/ui/PageTransition";

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
