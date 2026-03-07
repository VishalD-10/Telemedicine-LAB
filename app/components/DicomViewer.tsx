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
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingFull, setLoadingFull] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const isOpenRef = useRef(isOpen);
  const fullLoadTokenRef = useRef(0);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (!isOpen) {
      fullLoadTokenRef.current += 1;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !xrayPath) return;
    let cancelled = false;
    setDicomError(null);
    setImageBase64(null);
    setMetadata(null);
    setFullLoaded(false);
    setLoadingFull(false);
    setLoadingPreview(true);

    const loadPreview = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/render-dicom-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket: "x_rays", path: xrayPath }),
        });
        if (!response.ok) {
          throw new Error("DICOM preview failed.");
        }
        const result = (await response.json()) as {
          image_base64: string;
        };
        if (cancelled) return;
        setImageBase64(result.image_base64);
        setDicomError(null);
        setLoadingPreview(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          console.warn("Preview failed, loading full DICOM.");
          setLoadingPreview(false);
          loadFullDicom();
        }
      }
    };

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [isOpen, xrayPath]);

  const loadFullDicom = async () => {
    if (!isOpen) return;
    if (loadingFull || fullLoaded) return;
    if (!xrayPath) return;
    const token = ++fullLoadTokenRef.current;
    setLoadingFull(true);
    setDicomError(null);
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
      if (!isOpenRef.current || token !== fullLoadTokenRef.current) return;
      setImageBase64(result.image_base64);
      setMetadata(result.metadata);
      setFullLoaded(true);
    } catch (err) {
      console.error(err);
      if (!isOpenRef.current || token !== fullLoadTokenRef.current) return;
      setDicomError("Unable to load DICOM details.");
    } finally {
      if (!isOpenRef.current || token !== fullLoadTokenRef.current) return;
      setLoadingFull(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-50"
      onClick={onClose}
    >
      <div
        className="relative w-[900px] max-w-[95%] rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 px-3 py-1 text-sm bg-red-500 hover:bg-red-400 text-white rounded-md shadow"
        >
          Close
        </button>
        {xrayPath && (
          <div className="mb-2 pt-10 text-sm text-blue-100 opacity-80">
            File: {xrayPath}
          </div>
        )}
        <div>
          <div className="flex h-[70vh] w-[70vw] max-w-full flex-col">
            <div className="relative flex items-center justify-center w-full h-[60vh] bg-black rounded-xl overflow-hidden">
              {imageBase64 ? (
                <img
                  ref={imageRef}
                  src={`data:image/png;base64,${imageBase64}`}
                  alt="DICOM X-ray"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-black">
                  {loadingPreview ? (
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                  ) : (
                    <div className="h-full w-full bg-black" />
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => imageRef.current?.requestFullscreen?.()}
                className="absolute right-2 top-2 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md shadow"
              >
                Fullscreen
              </button>
            </div>
            <div className="h-[25%] overflow-y-auto mt-4 pt-3 border-t border-white/10">
              {!fullLoaded ? (
                <div className="flex items-center justify-between">
                  <p className="text-blue-200 text-sm">Load full DICOM details to view metadata.</p>
                  <button
                    type="button"
                    onClick={loadFullDicom}
                    disabled={loadingFull}
                    className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md shadow disabled:opacity-50"
                  >
                    {loadingFull ? "Loading..." : "Load Details"}
                  </button>
                </div>
              ) : (
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
              )}
            </div>
          </div>
          {dicomError && <p className="mt-2 text-sm text-amber-400">{dicomError}</p>}
        </div>
      </div>
    </div>
  );
}
