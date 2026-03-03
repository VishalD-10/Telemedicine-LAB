"use client";

import { useEffect, useRef, useState } from "react";

interface DicomViewerProps {
  isOpen: boolean;
  xrayUrl: string | null;
  xrayPath: string | null;
  onClose: () => void;
}

export default function DicomViewer({ isOpen, xrayUrl, xrayPath, onClose }: DicomViewerProps) {
  const [dicomError, setDicomError] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string | number | null> | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!isOpen || !xrayPath) return;
    let cancelled = false;
    setDicomError(null);
    setImageBase64(null);
    setMetadata(null);

    const loadDicom = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/render-dicom`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket: "x_rays", path: xrayPath }),
        });
        if (!response.ok) {
          throw new Error("DICOM render failed.");
        }
        const result = (await response.json()) as {
          image_base64: string;
          metadata: Record<string, string | number | null>;
        };
        if (cancelled) return;
        setImageBase64(result.image_base64);
        setMetadata(result.metadata);
        setDicomError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setDicomError("Unable to load DICOM image.");
        }
      }
    };

    loadDicom();
    return () => {
      cancelled = true;
    };
  }, [isOpen, xrayPath]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-4xl rounded-xl border border-slate-700 bg-slate-900 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 rounded bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
        >
          Close
        </button>
        {xrayPath && (
          <div className="px-3 pt-10 text-xs text-slate-400">
            File: {xrayPath}
          </div>
        )}
        <div className="p-3">
          <div className="flex h-[70vh] w-[70vw] max-w-full flex-col">
            <div className="relative flex h-[75%] items-center justify-center bg-black">
              {imageBase64 ? (
                <img
                  ref={imageRef}
                  src={`data:image/png;base64,${imageBase64}`}
                  alt="DICOM X-ray"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="h-full w-full bg-black" />
              )}
              <button
                type="button"
                onClick={() => imageRef.current?.requestFullscreen?.()}
                className="absolute right-2 top-2 rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                Fullscreen
              </button>
            </div>
            <div className="h-[25%] overflow-y-auto p-3">
              <table className="w-full text-xs text-slate-300">
                <tbody>
                  {[
                    ["PatientID", metadata?.PatientID ?? null],
                    ["Modality", metadata?.Modality ?? null],
                    ["StudyDate", metadata?.StudyDate ?? null],
                    [
                      "Rows × Columns",
                      metadata?.Rows != null || metadata?.Columns != null
                        ? `${metadata?.Rows ?? "—"} × ${metadata?.Columns ?? "—"}`
                        : null,
                    ],
                    ["PixelSpacing", metadata?.PixelSpacing ?? null],
                    ["BitsStored", metadata?.BitsStored ?? null],
                    ["Manufacturer", metadata?.Manufacturer ?? null],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b border-slate-800/60 last:border-b-0">
                      <td className="py-1 pr-3 font-medium text-slate-200">{label}</td>
                      <td className="py-1 text-slate-300">{value ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {dicomError && <p className="mt-2 text-sm text-amber-400">{dicomError}</p>}
        </div>
      </div>
    </div>
  );
}
