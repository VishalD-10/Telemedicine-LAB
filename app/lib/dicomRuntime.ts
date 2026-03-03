"use client";

type DicomRenderResponse = {
  imageBase64: string;
  metadata: Record<string, string | number | null>;
};

export async function fetchRenderedDicom(dicomPath: string): Promise<DicomRenderResponse> {
  const response = await fetch("http://localhost:8001/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: dicomPath }),
  });

  if (!response.ok) {
    throw new Error("Failed to render DICOM.");
  }

  const payload = (await response.json()) as {
    image_base64: string;
    metadata: Record<string, string | number | null>;
  };
  return { imageBase64: payload.image_base64, metadata: payload.metadata };
}
