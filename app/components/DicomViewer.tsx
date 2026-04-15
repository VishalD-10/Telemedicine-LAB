"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

interface DicomViewerProps {
  isOpen: boolean;
  xrayUrl: string | null;
  xrayPath: string | null;
  onClose: () => void;
  allowAnnotation?: boolean;
}

export default function DicomViewer({ isOpen, xrayUrl, xrayPath, onClose, allowAnnotation = false }: DicomViewerProps) {
  const [dicomError, setDicomError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string | number | null> | null>(null);
  const [mode, setMode] = useState("original");
  const [loading, setLoading] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [activeTab, setActiveTab] = useState<"view" | "annotation">("view");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [annotationMode, setAnnotationMode] = useState<"brush" | "eraser">("brush");
  const [color, setColor] = useState("rgba(255,0,0,0.3)");
  const [zoom, setZoom] = useState(1);
  const [isMaskGenerated, setIsMaskGenerated] = useState(false);
  const [annotationSnapshot, setAnnotationSnapshot] = useState<ImageData | null>(null);
  const [isMaskLoaded, setIsMaskLoaded] = useState(false);
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);
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

      const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendBase) {
        throw new Error("Backend URL is not configured.");
      }

      const payload = {
        bucket: "x_rays",
        path: xrayPath,
      };

      const renderResponse = await fetch(`${backendBase}/render-dicom?mode=${encodeURIComponent(mode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const renderText = await renderResponse.text();
      let data: { image_base64?: string; metadata?: Record<string, string | number | null>; detail?: string } | null = null;

      try {
        data = renderText ? JSON.parse(renderText) : null;
      } catch {
        data = null;
      }

      const imageBase64 = data?.image_base64 ?? null;
      const metadataPayload = data?.metadata ?? null;

      if (!renderResponse.ok || !imageBase64) {
        if (mode !== "original") {
          const previewResponse = await fetch(`${backendBase}/render-dicom-preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const previewText = await previewResponse.text();
          let previewData: { image_base64?: string; detail?: string } | null = null;
          try {
            previewData = previewText ? JSON.parse(previewText) : null;
          } catch {
            previewData = null;
          }

          if (previewResponse.ok && previewData?.image_base64) {
            setImage(`data:image/png;base64,${previewData.image_base64}`);
            setMetadata(metadataPayload);
            return;
          }

          throw new Error(previewData?.detail ?? data?.detail ?? previewText ?? "Unable to render DICOM preview.");
        }

        throw new Error(data?.detail ?? renderText ?? "Unable to render DICOM.");
      }

      setImage(`data:image/png;base64,${imageBase64}`);
      setMetadata(metadataPayload);
    } catch (e) {
      console.error("DICOM LOAD ERROR", e);
      setDicomError(e instanceof Error ? e.message : "Unable to load DICOM image.");
    } finally {
      setLoading(false);
    }
  };

  const getCtx = () => canvasRef.current?.getContext("2d");

  const hexToRgba = (hex: string, alpha: number) => {
    const bigint = parseInt(hex.replace("#", ""), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return `rgba(${r},${g},${b},${alpha})`;
  };

  const startDraw = () => setIsDrawing(true);
  const endDraw = () => {
    setIsDrawing(false);
    const ctx = getCtx();
    if (ctx) {
      ctx.globalCompositeOperation = "source-over";
    }
  };

  const draw = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = getCtx();
    if (!ctx) return;

    const rgbaColor = color.startsWith("#")
      ? hexToRgba(color, 0.6)
      : color;

    if (annotationMode === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = rgbaColor;
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const generateMask = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Always take a fresh snapshot of the CURRENT annotation state before
    // converting to black/white. This ensures "Edit Mask → re-annotate →
    // Generate" always restores to the correct pre-conversion pixels.
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setAnnotationSnapshot(snapshot);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];

      if (alpha > 0) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      } else {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setIsMaskGenerated(true);
  };

  const getMaskPath = (xrayPathValue: string) => {
    const parts = xrayPathValue.split("/");
    const filename = parts.pop();
    if (!filename) return xrayPathValue;

    const baseName = filename.replace(".dcm", "");
    return [...parts, `${baseName}_mask.png`].join("/");
  };

  const uploadMask = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !xrayPath) return;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;

    const maskPath = getMaskPath(xrayPath);
    await supabase.storage.from("xrays_masks").upload(maskPath, blob, { upsert: true });
    alert("Mask Successfully Saved!");
    setActiveTab("view");
    setIsMaskGenerated(false);
  };

  const loadMask = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // TOGGLE -> UNLOAD
    if (isMaskLoaded && originalImageData) {
      ctx.putImageData(originalImageData, 0, 0);
      setIsMaskLoaded(false);
      return;
    }

    try {
      if (!xrayPath) return;

      const maskPath = getMaskPath(xrayPath);

      const { data, error } = await supabase.storage
        .from("xrays_masks")
        .download(maskPath);

      if (error || !data) {
        console.warn("No mask found");
        return;
      }

      const url = URL.createObjectURL(data);

      const maskImg = new Image();
      maskImg.src = url;

      maskImg.onload = () => {
        // STEP A - DRAW ORIGINAL IMAGE INTO CANVAS
        const imageElement = document.querySelector("img");
        if (!imageElement) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

        // SAVE ORIGINAL IMAGE PIXELS
        const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setOriginalImageData(originalData);

        // STEP B - DRAW MASK TEMPORARILY
        ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);

        const maskData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        // RESTORE ORIGINAL FIRST
        ctx.putImageData(originalData, 0, 0);

        const finalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const finalPixels = finalImage.data;

        // STEP C - APPLY MASK
        for (let i = 0; i < finalPixels.length; i += 4) {
          const isWhite = maskData[i] > 200;

          if (!isWhite) {
            finalPixels[i] = 0;
            finalPixels[i + 1] = 0;
            finalPixels[i + 2] = 0;
          }
        }

        ctx.putImageData(finalImage, 0, 0);
        setIsMaskLoaded(true);
      };
    } catch (err) {
      console.error("Mask load error:", err);
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
      setActiveTab("view");
      setImage(null);
      setMetadata(null);
      setDicomError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab !== "annotation") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageElement = document.querySelector("img");

    if (imageElement) {
      canvas.width = imageElement.clientWidth;
      canvas.height = imageElement.clientHeight;
      canvas.style.width = `${imageElement.clientWidth}px`;
      canvas.style.height = `${imageElement.clientHeight}px`;
    }

    // Always clear the canvas when switching to annotation tab so that
    // previous session annotations / generated masks don't bleed into a
    // new annotation session for the same X-ray.
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setIsMaskGenerated(false);
    setAnnotationSnapshot(null);
    setIsMaskLoaded(false);
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-50"
      onClick={onClose}
    >
      <div
        className="relative w-[900px] max-w-[95%] rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl p-6 text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-md border border-red-200 shadow"
        >
          Close
        </button>
        {xrayPath && (
          <div className="mb-2 pt-10 text-sm text-slate-700 space-y-3">
            <div>File: {xrayPath}</div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm backdrop-blur-md">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 bg-white shadow-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 [&>option]:bg-white [&>option]:text-slate-900"
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value} className="bg-white text-slate-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div>
          {allowAnnotation && (
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setActiveTab("view")}
                className={`px-3 py-1 border rounded transition ${
                  activeTab === "view"
                    ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                View
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("annotation")}
                className={`px-3 py-1 border rounded transition ${
                  activeTab === "annotation"
                    ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Annotation
              </button>
            </div>
          )}

          {(!allowAnnotation || activeTab === "view") && (
          <div className="flex h-[70vh] w-[70vw] max-w-full flex-col">
            <div className="relative w-full h-[500px] bg-slate-100 rounded-lg overflow-auto border border-slate-200">
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                  width: "fit-content",
                  margin: "auto"
                }}
              >
                <div className="relative flex items-center justify-center w-full h-[60vh] bg-white rounded-xl overflow-hidden">
                  {image ? (
                    <img
                      ref={imageRef}
                      src={image}
                      alt="DICOM X-ray"
                      className="max-w-full max-h-full object-contain transition-all duration-200"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white">
                      {loading ? <div className="animate-pulse bg-slate-200 rounded-xl h-full w-full" /> : <div className="h-full w-full bg-white" />}
                    </div>
                  )}
                  {loading && image && (
                    <div className="absolute inset-0 pointer-events-none p-3">
                      <div className="animate-pulse bg-slate-200/35 rounded-xl h-full w-full" />
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
              </div>
              <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-white/90 text-slate-700 px-3 py-1 rounded-md border border-slate-200 shadow-sm">
                <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
                  −
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>
                  +
                </button>
                <button type="button" onClick={() => setZoom(1)}>
                  Reset
                </button>
              </div>
            </div>
            <div className="h-[25%] overflow-y-auto mt-4 pt-3 border-t border-slate-200">
              {metadata ? (
                <table className="w-full text-xs text-slate-700">
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
                      <tr key={label} className="border-b border-slate-200 last:border-b-0">
                        <td className="py-1 pr-3 font-medium text-slate-900">{label}</td>
                        <td className="py-1 text-slate-700">{value ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-slate-600 text-sm">Metadata unavailable for this image.</p>
                </div>
              )}
            </div>
          </div>
          )}

          {allowAnnotation && activeTab === "annotation" && (
            <div className="border rounded-lg bg-white p-2 border-slate-200">
              <div className="flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAnnotationMode("brush")}
                    className={`px-3 py-1.5 rounded-md text-sm border ${
                      annotationMode === "brush" ? "bg-blue-600 text-white border-blue-500" : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    Brush
                  </button>

                  <button
                    type="button"
                    onClick={() => setAnnotationMode("eraser")}
                    className={`px-3 py-1.5 rounded-md text-sm border ${
                      annotationMode === "eraser" ? "bg-blue-600 text-white border-blue-500" : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    Eraser
                  </button>

                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-xs text-slate-600">Size</span>
                    <input
                      type="range"
                      min={5}
                      max={60}
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>

                  <input
                    type="color"
                    onChange={(e) => setColor(e.target.value)}
                    className="ml-2 w-8 h-8 border rounded border-slate-200 bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const canvas = canvasRef.current;
                      const ctx = canvas?.getContext("2d");

                      if (!canvas || !ctx) return;

                      if (isMaskLoaded && originalImageData) {
                        ctx.putImageData(originalImageData, 0, 0);
                        setIsMaskLoaded(false);
                      }

                      if (isMaskGenerated && annotationSnapshot && canvas && ctx) {
                        ctx.putImageData(annotationSnapshot, 0, 0);
                        setIsMaskGenerated(false);
                      } else {
                        generateMask();
                      }
                    }}
                    className="px-3 py-1.5 text-sm rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100"
                  >
                    {isMaskGenerated ? "Edit Mask" : "Generate"}
                  </button>

                  <button onClick={uploadMask} className="px-3 py-1.5 text-sm rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100">
                    Save
                  </button>

                  <button onClick={loadMask} className="px-3 py-1.5 text-sm rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100">
                    {isMaskLoaded ? "Unload" : "Load"}
                  </button>
                </div>
              </div>

              <div className="relative w-full h-[500px] bg-slate-100 rounded-lg overflow-auto border border-slate-200">
                <div
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "center center",
                    width: "fit-content",
                    margin: "auto"
                  }}
                >
                  <div className="relative">
                    {image ? (
                      <img
                        ref={imageRef}
                        src={image}
                        alt="DICOM X-ray"
                        className="max-w-full max-h-full object-contain transition-all duration-200"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-white">
                        {loading ? <div className="animate-pulse bg-slate-200 rounded-xl h-full w-full" /> : <div className="h-full w-full bg-white" />}
                      </div>
                    )}

                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 pointer-events-auto"
                      onMouseDown={startDraw}
                      onMouseUp={endDraw}
                      onMouseMove={draw}
                      onMouseLeave={endDraw}
                    />
                  </div>
                </div>
                <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-white/90 text-slate-700 px-3 py-1 rounded-md border border-slate-200 shadow-sm">
                  <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
                    −
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>
                    +
                  </button>
                  <button type="button" onClick={() => setZoom(1)}>
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}
          {dicomError && <p className="mt-2 text-sm text-amber-400">{dicomError}</p>}
        </div>
      </div>
    </div>
  );
}
