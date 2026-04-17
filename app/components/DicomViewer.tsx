"use client";

import { createPortal } from "react-dom";
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
    // Normalize coordinates by zoom factor to keep brush aligned with image pixels
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    const ctx = getCtx();
    if (!ctx) return;

    const rgbaColor = color.startsWith("#")
      ? hexToRgba(color, 0.6)
      : color;

    if (annotationMode === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      // Scale brush radius by zoom if needed? 
      // Actually brushSize is usually absolute image pixels, so we keep it.
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

      // Alpha threshold > 128 to prevent residual erased pixels from accumulating in mask
      if (alpha > 128) {
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

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-[1000]"
      onClick={onClose}
    >
      <div
        className="glass-panel relative w-[1000px] max-w-[95%] max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50 bg-white/20 backdrop-blur-md">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-6 bg-blue-600 rounded-full" />
              Diagnostic Imaging Viewer
            </h2>
            {xrayPath && <span className="text-xs text-slate-500 font-mono mt-0.5">{xrayPath}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-xl border border-slate-200/50">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    mode === opt.value
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {allowAnnotation && (
            <div className="flex gap-2 mb-6 p-1 bg-slate-100/50 rounded-xl border border-slate-200/50 w-fit">
              <button
                type="button"
                onClick={() => setActiveTab("view")}
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === "view"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Inspection View
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("annotation")}
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === "annotation"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Annotation Tool
              </button>
            </div>
          )}

          {(!allowAnnotation || activeTab === "view") && (
            <div className="flex flex-col gap-6">
              <div className="relative group aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-300 ease-out cursor-move"
                  style={{
                    transform: `scale(${zoom})`,
                  }}
                >
                  {image ? (
                    <img
                      ref={imageRef}
                      src={image}
                      alt="DICOM X-ray"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                      <span className="text-slate-500 text-sm">Processing DICOM data...</span>
                    </div>
                  )}
                </div>

                {/* Floating Controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button
                    type="button"
                    onClick={() => imageRef.current?.requestFullscreen?.()}
                    className="p-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl hover:bg-white/20 transition-all shadow-lg"
                    title="Fullscreen"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                </div>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl text-white shadow-2xl">
                  <div className="flex items-center gap-3">
                    <button 
                      type="button" 
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="text-xs font-bold tabular-nums w-12 text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setZoom((z) => Math.min(4, z + 0.2))}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  <div className="w-px h-4 bg-white/20" />
                  <button 
                    type="button" 
                    onClick={() => setZoom(1)}
                    className="text-[10px] font-bold uppercase tracking-widest hover:text-blue-400 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Metadata area */}
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/60">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">DICOM Metadata Attributes</h4>
                {metadata ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {[
                      ["Patient ID", metadata?.PatientID ?? null],
                      ["Modality", metadata?.Modality ?? null],
                      ["Study Date", metadata?.StudyDate ?? null],
                      [
                        "Resolution",
                        metadata?.Rows != null || metadata?.Columns != null
                          ? `${metadata?.Rows ?? "—"} × ${metadata?.Columns ?? "—"}`
                          : null,
                      ],
                      ["Pixel Spacing", metadata?.PixelSpacing ?? null],
                      ["Manufacturer", metadata?.Manufacturer ?? null],
                    ].map(([label, value]) => (
                      <div key={label} className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
                        <p className="text-sm font-medium text-slate-700 truncate">{value ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-slate-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm">Extended DICOM metadata attributes are unavailable for this image.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {allowAnnotation && activeTab === "annotation" && (
            <div className="flex flex-col gap-6">
              <div className="glass-panel p-4 flex items-center justify-between bg-white/40">
                <div className="flex items-center gap-3">
                  <div className="flex p-1 bg-slate-200/50 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setAnnotationMode("brush")}
                      className={`p-2 rounded-lg transition-all ${
                        annotationMode === "brush" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                      title="Brush Tool"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAnnotationMode("eraser")}
                      className={`p-2 rounded-lg transition-all ${
                        annotationMode === "eraser" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                      title="Eraser Tool"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-4 ml-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Brush Size</span>
                      <input
                        type="range"
                        min={5}
                        max={80}
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-32 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                    <div className="w-px h-8 bg-slate-200" />
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Color</span>
                      <input
                        type="color"
                        value={color.startsWith("#") ? color : "#ef4444"}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-8 h-8 rounded-lg overflow-hidden border-0 p-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
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
                    className={`glass-btn-secondary py-2 !rounded-lg !px-4 ${isMaskGenerated ? "!text-blue-600 !border-blue-200 !bg-blue-50" : ""}`}
                  >
                    {isMaskGenerated ? "Adjust Regions" : "Process Mask"}
                  </button>

                  <button onClick={uploadMask} className="glass-btn-primary py-2 !rounded-lg !px-6">
                    Save Analysis
                  </button>

                  <button 
                    onClick={loadMask} 
                    className={`glass-btn-secondary py-2 !rounded-lg !px-4 ${isMaskLoaded ? "!text-emerald-600 !border-emerald-200 !bg-emerald-50" : ""}`}
                  >
                    {isMaskLoaded ? "Hide Mask" : "Load Existing"}
                  </button>
                </div>
              </div>

              <div className="relative group aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-300 ease-out"
                  style={{
                    transform: `scale(${zoom})`,
                  }}
                >
                  <div className="relative inline-block">
                    {image ? (
                      <img
                        ref={imageRef}
                        src={image}
                        alt="DICOM X-ray"
                        className="max-w-full max-h-full object-contain select-none"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-900">
                        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                      </div>
                    )}

                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 cursor-crosshair touch-none"
                      onMouseDown={startDraw}
                      onMouseUp={endDraw}
                      onMouseMove={draw}
                      onMouseLeave={endDraw}
                    />
                  </div>
                </div>
                
                {/* Floatings for Annotation */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl text-white shadow-2xl">
                  <div className="flex items-center gap-3">
                    <button 
                      type="button" 
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="text-xs font-bold tabular-nums w-12 text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setZoom((z) => Math.min(4, z + 0.2))}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {dicomError && <p className="mt-2 text-sm text-amber-400">{dicomError}</p>}
        </div>
      </div>
    </div>
    ,
    document.body
  );
}
