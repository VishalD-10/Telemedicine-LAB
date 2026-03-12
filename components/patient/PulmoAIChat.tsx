"use client";

import { useEffect } from "react";

export default function PulmoAIChat({ patientId }: { patientId: string }) {
  useEffect(() => {
    if (!patientId) return;

    // Destroy previous instance
    if ((window as any).Chatling) {
      (window as any).Chatling.destroy();
    }

    // Configure
    (window as any).chtlConfig = {
      chatbotId: "8113368681",
      userId: patientId,
    };

    // Inject script
    const script = document.createElement("script");
    script.src = "https://chatling.ai/js/embed.js";
    script.async = true;
    script.id = "chtl-script";
    document.body.appendChild(script);

    return () => {
      if ((window as any).Chatling) {
        (window as any).Chatling.destroy();
      }
      const existing = document.getElementById("chtl-script");
      if (existing) existing.remove();
    };
  }, [patientId]);

  return null;
}
