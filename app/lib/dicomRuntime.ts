"use client";

type DicomRenderResponse = {
  imageBase64: string;
  metadata: Record<string, string | number | null>;
};

export async function fetchRenderedDicom(dicomPath: string): Promise<DicomRenderResponse> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/render-dicom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket: "x_rays", path: dicomPath }),
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
