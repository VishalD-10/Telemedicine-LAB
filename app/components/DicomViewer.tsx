﻿"use client";

import { useEffect, useRef, useState } from "react";

interface DicomViewerProps {
  isOpen: boolean;
  xrayUrl: string | null;
  xrayPath: string | null;
  onClose: () => void;
}

export default function DicomViewer({ isOpen, xrayUrl, xrayPath, onClose }: DicomViewerProps) {
  const [dicomError, setDicomError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string | number | null> | null>(null);
  const [mode, setMode] = useState("original");
  const [loading, setLoading] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const options = [
    { label: "Original", value: "original" },
    { label: "CLAHE Enhancement", value: "clahe" },
    { label: "Edge Detection", value: "edge" },
    { label: "Lung Enhancement", value: "lung" },
    { label: "Noise Reduction", value: "smooth" },
    { label: "Invert", value: "invert" }
  ];

  const loadDicom = async (mode: string) => {
    if (!xrayPath) return;

    try {
      setLoading(true);
      setDicomError(null);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/render-dicom?mode=${mode}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket: "x_rays",
            path: xrayPath
          })
        }
      );

      const data = await res.json();
      setImage(`data:image/png;base64,${data.image_base64}`);
      setMetadata((data.metadata as Record<string, string | number | null>) ?? null);
    } catch (e) {
      console.error("DICOM LOAD ERROR", e);
      setDicomError("Unable to load DICOM image.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !xrayPath) return;
    loadDicom(mode);
  }, [mode, xrayPath]);

  useEffect(() => {
    if (!isOpen) return;
    if (xrayPath) loadDicom("original");
  }, [xrayPath]);

  useEffect(() => {
    if (!isOpen) {
      setMode("original");
      setImage(null);
      setMetadata(null);
      setDicomError(null);
    }
  }, [isOpen]);

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
          <div className="mb-2 pt-10 text-sm text-blue-100 opacity-80 space-y-3">
            <div>File: {xrayPath}</div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/70 px-2.5 py-2 shadow-sm backdrop-blur-md">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="rounded-xl border border-slate-200/80 px-3 py-2 bg-white shadow-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div>
          <div className="flex h-[70vh] w-[70vw] max-w-full flex-col">
            <div className="relative flex items-center justify-center w-full h-[60vh] bg-black rounded-xl overflow-hidden">
              {image ? (
                <img
                  ref={imageRef}
                  src={image}
                  alt="DICOM X-ray"
                  className="max-w-full max-h-full object-contain transition-all duration-200"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-black">
                  {loading ? <div className="animate-pulse bg-gray-200 rounded-xl h-full w-full" /> : <div className="h-full w-full bg-black" />}
                </div>
              )}
              {loading && image && (
                <div className="absolute inset-0 pointer-events-none p-3">
                  <div className="animate-pulse bg-gray-200/35 rounded-xl h-full w-full" />
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
              {metadata ? (
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
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-blue-200 text-sm">Metadata unavailable for this image.</p>
                </div>
              )}
            </div>
          </div>
          {dicomError && <p className="mt-2 text-sm text-amber-400">{dicomError}</p>}
        </div>
      </div>
    </div>
  );
}
