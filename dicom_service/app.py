from __future__ import annotations

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import base64
import os
import threading
from datetime import datetime, timezone
from functools import lru_cache
from io import BytesIO
from typing import Any, Dict

from supabase.client import create_client
import numpy as np
import cv2
import pydicom
from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel
from pydicom.multival import MultiValue
from pydicom.valuerep import DSfloat, IS
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image as RLImage
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def normalize_dicom_value(value):
    if value is None:
        return None
    if isinstance(value, MultiValue):
        return [normalize_dicom_value(v) for v in value]
    if isinstance(value, (DSfloat, IS)):
        return float(value)
    if isinstance(value, bytes):
        return value.decode(errors="ignore")
    return str(value)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.options("/{full_path:path}")
async def preflight_handler(full_path: str):
    return {"status": "ok"}

supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not supabase_url or not supabase_service_key:
    raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
supabase = create_client(supabase_url, supabase_service_key)


class RenderDicomRequest(BaseModel):
    bucket: str
    path: str


class GenerateReportRequest(BaseModel):
    case_id: str


class DownloadReportRequest(BaseModel):
    patient_id: str


def _normalize_to_uint8(pixel_array: np.ndarray) -> np.ndarray:
    data = pixel_array.astype(np.float32)

    min_val = np.min(data)
    max_val = np.max(data)

    if max_val == min_val:
        return np.zeros_like(data, dtype=np.uint8)

    data = (data - min_val) / (max_val - min_val)
    return (data * 255).astype(np.uint8)


def dicom_window(pixel_array, ds, mode):
    img = pixel_array.astype(np.float32)

    if getattr(ds, "PhotometricInterpretation", "") == "MONOCHROME1":
        img = np.max(img) - img

    if mode in ("lung", "lung_window"):
        wl, ww = -600, 1500
    elif mode in ("soft", "soft_window"):
        wl, ww = 50, 350
    else:
        return img

    img = (img - (wl - ww / 2)) / ww
    img = np.clip(img, 0, 1)
    return img * 255


CLAHE = cv2.createCLAHE(
    clipLimit=3.0,
    tileGridSize=(8,8)
)

def proc_clahe(img):
    return CLAHE.apply(img.astype(np.uint8))


def proc_edge(img):
    edges = cv2.Canny(img.astype(np.uint8), 35, 110)
    return cv2.bitwise_not(edges)


def proc_smooth(img):
    return cv2.bilateralFilter(img, 9, 75, 75)


def proc_lung(img):
    img = img.astype(np.float32)

    # Lung window simulation
    wl = -500
    ww = 1400

    img = (img - (wl - ww/2)) / ww
    img = np.clip(img, 0, 1)

    img = img * 255

    # subtle CLAHE for alveolar detail
    clahe = cv2.createCLAHE(clipLimit=2.8, tileGridSize=(8,8))
    img = clahe.apply(img.astype(np.uint8))

    return img


def proc_invert(img):
    img = cv2.bitwise_not(img)
    img = cv2.equalizeHist(img)
    return img


@lru_cache(maxsize=100)
def _dicom_to_png_bytes(bucket: str, path: str) -> bytes | None:
    dicom_bytes = supabase.storage.from_(bucket).download(path)
    if not dicom_bytes or len(dicom_bytes) <= 1024:
        return None
    ds = pydicom.dcmread(BytesIO(dicom_bytes), force=True)
    if "PixelData" not in ds:
        return None
    pixel_array = ds.pixel_array
    if pixel_array.ndim > 2:
        pixel_array = pixel_array[0]
    raw = dicom_window(pixel_array, ds, "original")
    normalized = _normalize_to_uint8(raw)
    image = Image.fromarray(normalized)
    if image.mode != "RGB":
        image = image.convert("RGB")
    buf = BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def _fetch_single(table: str, columns: str, eq_field: str, eq_value: str):
    try:
        response = (
            supabase.from_(table)
            .select(columns)
            .eq(eq_field, eq_value)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return (response.data or [None])[0]


def _ensure_reports_bucket():
    try:
        buckets = supabase.storage.list_buckets()
    except Exception:
        return
    if not isinstance(buckets, list):
        return
    exists = any(isinstance(b, dict) and b.get("id") == "reports" for b in buckets)
    if exists:
        return
    try:
        supabase.storage.create_bucket("reports", {"public": False})
    except Exception:
        pass


def _format_date(value: Any) -> str:
    if not value:
        return "-"
    if isinstance(value, str):
        return value.replace("T", " ").replace("Z", " UTC")
    return str(value)


def _build_report_pdf(
    case_row: Dict[str, Any],
    patient_row: Dict[str, Any] | None,
    xray_png: bytes | None,
    diagnosis_row: Dict[str, Any] | None = None,
    treatment_row: Dict[str, Any] | None = None,
    prescription_rows: list[Dict[str, Any]] | None = None,
    followup_row: Dict[str, Any] | None = None,
) -> bytes:
    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    title_style.alignment = 1
    title_style.fontSize = 14
    section_style = styles["Heading2"]
    section_style.fontSize = 12
    body = styles["BodyText"]
    body.fontSize = 11
    body.leading = 14

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=inch,
        rightMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
    )

    story = []
    story.append(Paragraph("TELE-PULMONOLOGY MEDICAL REPORT", title_style))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Patient Information", section_style))
    patient_info = [
        ["Name", (patient_row or {}).get("name") or "-"],
        ["Age", (patient_row or {}).get("age") or "-"],
        ["Gender", (patient_row or {}).get("gender") or "-"],
        ["Smoking History", (patient_row or {}).get("smoking_history") or "-"],
        ["Height", (patient_row or {}).get("height_cm") or "-"],
        ["Weight", (patient_row or {}).get("weight_kg") or "-"],
        ["Date Visited", _format_date(case_row.get("created_at"))],
        ["Reviewed Date", _format_date(case_row.get("reviewed_at"))],
    ]
    patient_table = Table(patient_info, colWidths=[1.6 * inch, 4.4 * inch])
    patient_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(patient_table)
    story.append(Spacer(1, 12))

    specialist_diagnosis = (
        (diagnosis_row or {}).get("manual_diagnosis")
        or (diagnosis_row or {}).get("primary_diagnosis")
        or "-"
    )
    followup_notes = (followup_row or {}).get("notes") or "-"
    diagnostics_value = (followup_row or {}).get("diagnostic_procedures")
    procedures = (
        [str(item) for item in diagnostics_value if item]
        if isinstance(diagnostics_value, list)
        else [item.strip() for item in str(diagnostics_value).split(",") if item.strip()]
        if isinstance(diagnostics_value, str)
        else []
    )

    story.append(Paragraph("Clinical Findings", section_style))
    story.append(Paragraph(f"Rural Diagnosis: {case_row.get('rural_diagnosis_report') or '-'}", body))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"Specialist Diagnosis: {specialist_diagnosis}", body))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"Follow-up Notes: {followup_notes}", body))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Procedures Required", section_style))
    if procedures:
        for item in procedures:
            story.append(Paragraph(item, body))
    else:
        story.append(Paragraph("None", body))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Treatment Plan", section_style))
    story.append(Paragraph((treatment_row or {}).get("medications") or "-", body))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Prescriptions", section_style))
    if prescription_rows:
        for row in prescription_rows:
            medication = row.get("medication") or row.get("medicine") or "-"
            dosage = row.get("dosage") or "-"
            frequency = row.get("frequency") or row.get("instructions") or "-"
            duration = row.get("duration") or "-"
            story.append(Paragraph(f"{medication} | {dosage} | {frequency} | {duration}", body))
    else:
        story.append(Paragraph("-", body))
    story.append(Spacer(1, 12))

    story.append(Paragraph("X-ray Image", section_style))
    if xray_png:
        image_buffer = BytesIO(xray_png)
        image_buffer.seek(0)
        img = RLImage(image_buffer, width=400, height=300)
        story.append(img)
    else:
        story.append(Paragraph("-", body))
    story.append(Spacer(1, 12))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


@app.post("/render-dicom")
def render_dicom(payload: RenderDicomRequest, request: Request) -> Dict[str, Any]:
    try:
        bucket = payload.bucket.strip()
        path = payload.path.strip().lstrip("/")
        if path.startswith("http"):
            raise HTTPException(status_code=400, detail="Invalid DICOM path")
        print(f"SUPABASE DOWNLOAD â†’ bucket='{bucket}' path='{path}'")
        dicom_bytes = supabase.storage.from_(bucket).download(path)
        if not dicom_bytes or len(dicom_bytes) <= 1024:
            raise ValueError("Invalid DICOM content")

        ds = pydicom.dcmread(BytesIO(dicom_bytes), force=True)
        if "PixelData" not in ds:
            raise ValueError("PixelData missing")
        pixel_array = ds.pixel_array
        raw_mode = request.query_params.get("mode", "original").lower().strip()
        if raw_mode in ("bone", "bone enhancement", "contrast", "contrast stretch"):
            raise HTTPException(status_code=400, detail="Unsupported mode")

        # UNIVERSAL MODE MAP (FRONTEND SAFE)
        mode_map = {
            "original": "original",

            # enhancement filters
            "clahe": "clahe",
            "edge": "edge",
            "smooth": "smooth",
            "noise": "smooth",
            "noise reduction": "smooth",

            # windowing (radiology correct)
            "lung": "lung",
            "soft": "soft_window",

            # misc
            "invert": "invert"
        }

        mode = mode_map.get(raw_mode, "original")

        # ---- WINDOW FIRST ----
        if mode in ("lung_window", "soft_window"):
            raw = dicom_window(pixel_array, ds, mode)
            normalized = _normalize_to_uint8(raw)

        else:
            raw = dicom_window(pixel_array, ds, "original")
            normalized = _normalize_to_uint8(raw)

        # ---- IMAGE PROCESSING ----
        if mode == "clahe":
            normalized = proc_clahe(normalized)

        elif mode == "edge":
            normalized = proc_edge(normalized)

        elif mode == "lung":
            normalized = proc_lung(normalized)

        elif mode == "smooth":
            normalized = proc_smooth(normalized)

        elif mode == "invert":
            normalized = proc_invert(normalized)
        if normalized.ndim > 2:
            normalized = normalized[..., 0]
        normalized = cv2.normalize(normalized, None, 0, 255, cv2.NORM_MINMAX)
        normalized = normalized.astype(np.uint8)
        image = Image.fromarray(normalized)
        buf = BytesIO()
        image.save(buf, format="PNG")
        image_base64 = base64.b64encode(buf.getvalue()).decode("ascii")

        metadata = {}
        for elem in ds:
            if elem.VR == "SQ":
                continue
            tag_name = elem.keyword or str(elem.tag)
            metadata[tag_name] = normalize_dicom_value(elem.value)

        return {
            "image_base64": image_base64,
            "metadata": metadata,
            "mode_applied": mode,
            "ts": datetime.now().timestamp()
        }
    except Exception as exc:
        print("DICOM RENDER FAILED:", repr(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/render-dicom-preview")
def render_dicom_preview(payload: RenderDicomRequest) -> Dict[str, Any]:
    try:
        bucket = payload.bucket.strip()
        path = payload.path.strip().lstrip("/")
        if path.startswith("http"):
            raise HTTPException(status_code=400, detail="Invalid DICOM path")
        png_bytes = _dicom_to_png_bytes(bucket, path)
        if not png_bytes:
            raise ValueError("Invalid DICOM content")
        image_base64 = base64.b64encode(png_bytes).decode("ascii")
        return {"image_base64": image_base64}
    except Exception as exc:
        print("DICOM PREVIEW FAILED:", repr(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/generate-report-pdf")
def generate_report_pdf(payload: GenerateReportRequest) -> Dict[str, str]:
    case_id = (payload.case_id or "").strip()
    if not case_id:
        raise HTTPException(status_code=400, detail="case_id is required")

    reviewed_at = datetime.now(timezone.utc).isoformat()
    supabase.from_("cases").update({"status": "finalized", "reviewed_at": reviewed_at}).eq("id", case_id).execute()

    threading.Thread(target=_generate_pdf_async, args=(case_id,), daemon=True).start()
    return {"status": "ok", "file": f"{case_id}.pdf"}


def _generate_pdf_async(target_case_id: str) -> None:
    try:
        import time

        case_row = None
        for _ in range(5):
            case_row = _fetch_single(
                "cases",
                "id, patient_id, rural_doctor_id, specialist_id, rural_diagnosis_report, created_at, reviewed_at, status",
                "id",
                target_case_id,
            )
            if case_row:
                break
            time.sleep(0.4)

        if not case_row:
            print("PDF GEN ABORT → case not found")
            return

        patient_id = case_row.get("patient_id")
        if not patient_id:
            return

        diagnosis_row = _fetch_single(
            "case_diagnoses",
            "diagnosis_name, severity, specialist_notes, created_at",
            "case_id",
            target_case_id,
        )

        treatment_template = _fetch_single(
            "case_treatment_plans",
            "treatment_title, medications, inhaler_therapy, oxygen_therapy, pulmonary_rehabilitation, lifestyle_recommendations, referral_recommendation",
            "case_id",
            target_case_id,
        )

        followup_row = _fetch_single(
            "followups",
            "scheduled_date, notes, diagnostic_procedures, created_at",
            "case_id",
            target_case_id,
        )

        prescription_rows = (
            supabase.from_("prescriptions")
            .select("medication_name, dosage, frequency, duration_days, instructions, created_at")
            .eq("case_id", target_case_id)
            .order("created_at", desc=False)
            .execute()
        ).data or []

        patient_row = _fetch_single(
            "patients",
            "name, generated_patient_id, age, gender, height_cm, weight_kg, smoking_history, phone_number",
            "id",
            patient_id,
        ) or {}
        rural_doctor = _fetch_single(
            "profiles",
            "full_name",
            "id",
            case_row.get("rural_doctor_id"),
        ) or {}
        specialist = _fetch_single(
            "profiles",
            "full_name",
            "id",
            case_row.get("specialist_id"),
        ) or {}

        vitals_row = (
            supabase.from_("vitals")
            .select("spo2, respiratory_rate, systolic_bp, diastolic_bp, temperature_f, created_at")
            .eq("patient_id", patient_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        vitals = (vitals_row or [None])[0]

        spirometry_row = (
            supabase.from_("spirometry")
            .select("*")
            .eq("patient_id", patient_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        spirometry = (spirometry_row or [None])[0]

        xray_row = (
            supabase.from_("xrays")
            .select("file_path, created_at")
            .eq("patient_id", patient_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        xray_entry = (xray_row or [None])[0]
        xray_path = xray_entry.get("file_path") if isinstance(xray_entry, dict) else None
        xray_png = _dicom_to_png_bytes("x_rays", xray_path) if xray_path else None

        styles = getSampleStyleSheet()
        title_style = styles["Title"]
        title_style.alignment = 1
        title_style.fontSize = 16
        title_style.leading = 20
        section_style = styles["Heading2"]
        section_style.fontSize = 11
        section_style.leading = 14
        section_style.textColor = colors.HexColor("#1f4e79")
        body = styles["BodyText"]
        body.leading = 13
        table_body = styles["BodyText"].clone("table_body")
        table_body.fontSize = 9
        table_body.leading = 11

        from html import escape as _escape

        def _safe(value: Any) -> str:
            if value is None or value == "":
                return "-"
            return _escape(str(value))

        def _paragraph(value: Any, style=body) -> Paragraph:
            return Paragraph(_safe(value), style)

        def highlight(value: Any, low: float, high: float) -> str:
            try:
                measured = float(value)
                if measured < low or measured > high:
                    return f"<b>{_safe(value)}</b>"
            except Exception:
                pass
            return _safe(value)

        def highlight_gt(value: Any, threshold: float) -> str:
            try:
                measured = float(value)
                if measured <= threshold:
                    return f"<b>{_safe(value)}</b>"
            except Exception:
                pass
            return _safe(value)

        def _as_list(value: Any) -> list[str]:
            if value is None or value == "":
                return []
            if isinstance(value, list):
                return [str(item) for item in value if item not in (None, "")]
            if isinstance(value, str):
                cleaned = value.replace("\r", "\n").replace(";", ",")
                parts: list[str] = []
                for chunk in cleaned.split(","):
                    for piece in chunk.split("\n"):
                        item = piece.strip()
                        if item:
                            parts.append(item)
                return parts
            return [str(value)]

        def _section_title(text: str) -> Paragraph:
            return Paragraph(f"<b>{_escape(text.upper())}</b>", section_style)

        def _blue_rule(width: float = 6.9 * inch) -> Table:
            rule = Table([[""]], colWidths=[width])
            rule.setStyle(
                TableStyle(
                    [
                        ("LINEBELOW", (0, 0), (-1, -1), 1, colors.HexColor("#1f4e79")),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                    ]
                )
            )
            return rule

        def _cell(value: Any, style=table_body) -> Paragraph:
            return Paragraph(_safe(value), style)

        def _build_key_value_table(rows: list[list[Any]], col_widths: list[float]) -> Table:
            tbl = Table(rows, colWidths=col_widths, repeatRows=1)
            tbl.setStyle(
                TableStyle(
                    [
                        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cfd6de")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf2f8")),
                        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("LEADING", (0, 0), (-1, -1), 11),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            return tbl

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=0.65 * inch,
            rightMargin=0.65 * inch,
            topMargin=0.7 * inch,
            bottomMargin=0.85 * inch,
        )

        patient_name = patient_row.get("name") or "-"
        patient_generated_id = patient_row.get("generated_patient_id") or "-"
        rural_doctor_name = rural_doctor.get("full_name") or "-"
        specialist_name = specialist.get("full_name") or "-"

        systolic_bp = vitals.get("systolic_bp") if isinstance(vitals, dict) else None
        diastolic_bp = vitals.get("diastolic_bp") if isinstance(vitals, dict) else None
        temperature_f = vitals.get("temperature_f") if isinstance(vitals, dict) else None
        spo2 = vitals.get("spo2") if isinstance(vitals, dict) else None
        respiratory_rate = vitals.get("respiratory_rate") if isinstance(vitals, dict) else None

        bp_value = "-"
        if systolic_bp is not None and diastolic_bp is not None:
            bp_value = f"{_safe(systolic_bp)} / {_safe(diastolic_bp)} mmHg"
            try:
                if float(systolic_bp) < 90 or float(systolic_bp) > 120 or float(diastolic_bp) < 60 or float(diastolic_bp) > 80:
                    bp_value = f"<b>{bp_value}</b>"
            except Exception:
                pass

        temperature_value = "-"
        if temperature_f is not None:
            temperature_value = f"{highlight(temperature_f, 97, 99)} F"

        spo2_value = "-"
        if spo2 is not None:
            spo2_value = f"{highlight_gt(spo2, 95)}%"

        respiratory_value = "-"
        if respiratory_rate is not None:
            respiratory_value = f"{highlight(respiratory_rate, 12, 20)} /min"

        spirometry = spirometry or {}
        table_data = [
            ["Parameter", "Measured", "Normal Range"],

            ["FVC", f"{spirometry.get('fvc', '-')}", "3.0 – 5.0 L"],
            ["FEV1", f"{spirometry.get('fev1', '-')}", "2.5 – 4.5 L"],
            ["FEV1/FVC", f"{spirometry.get('fev1_fvc', '-')}", "≥ 70%"],
            ["FEV1/FEV6", f"{spirometry.get('fev1_fev6', '-')}", "≥ 75%"],
            ["PEF", f"{spirometry.get('pef', '-')}", "400 – 700 L/min"],
        ]

        treatment_data = treatment_template or {}
        oxygen_therapy = treatment_data.get("oxygen_therapy")
        oxygen_text = "Required" if oxygen_therapy is True else "Not Required" if oxygen_therapy is False else "-"

        specialist_diagnosis = diagnosis_row or {}
        specialist_diagnosis_text = specialist_diagnosis.get("diagnosis_name") or "-"
        specialist_severity = specialist_diagnosis.get("severity") or "-"
        specialist_notes = specialist_diagnosis.get("specialist_notes") or "-"

        treatment_rows = [
            ["Treatment Name", treatment_data.get("treatment_title") or "-"],
            ["Medications", treatment_data.get("medications") or "-"],
            ["Inhaler Therapy", treatment_data.get("inhaler_therapy") or "-"],
            ["Oxygen Therapy", oxygen_text],
            ["Pulmonary Rehabilitation", treatment_data.get("pulmonary_rehabilitation") or "-"],
            ["Lifestyle Recommendations", treatment_data.get("lifestyle_recommendations") or "-"],
            ["Referral Recommendation", treatment_data.get("referral_recommendation") or "-"],
        ]

        followup_data = followup_row or {}
        diagnostic_procedures = _as_list(followup_data.get("diagnostic_procedures"))

        prescription_table_rows = [[_cell("Medicine"), _cell("Dosage"), _cell("Frequency"), _cell("Duration")]]
        for row in prescription_rows:
            prescription_table_rows.append([
                _cell(row.get("medication_name") or "-"),
                _cell(row.get("dosage") or "-"),
                _cell(row.get("frequency") or "-"),
                _cell(row.get("duration_days") or "-"),
            ])

        story = []
        story.append(_section_title("TELE-PULMONOLOGY MEDICAL REPORT"))
        story.append(_blue_rule())
        story.append(Spacer(1, 8))
        story.append(Paragraph("<b>REVIEWED BY:</b>", body))
        story.append(Paragraph(f"Visited Rural Doctor: {_safe(rural_doctor_name)}", body))
        story.append(Paragraph(f"Reviewed Specialist: {_safe(specialist_name)}", body))
        story.append(Spacer(1, 10))

        story.append(_section_title("PATIENT INFORMATION"))
        story.append(_blue_rule())
        story.append(Spacer(1, 6))
        patient_info_rows = [
            [_cell("Name"), _cell(patient_name)],
            [_cell("Patient ID"), _cell(patient_generated_id)],
            [_cell("Age"), _cell(patient_row.get("age") or "-")],
            [_cell("Gender"), _cell(patient_row.get("gender") or "-")],
            [_cell("Height"), _cell(patient_row.get("height_cm") or "-")],
            [_cell("Weight"), _cell(patient_row.get("weight_kg") or "-")],
            [_cell("Smoking History"), _cell(patient_row.get("smoking_history") or "-")],
            [_cell("Visit Date"), _cell(case_row.get("created_at") or "-")],
        ]
        story.append(_build_key_value_table(patient_info_rows, [1.8 * inch, 5.2 * inch]))
        story.append(Spacer(1, 10))

        story.append(_section_title("VITAL PARAMETERS"))
        story.append(_blue_rule())
        story.append(Spacer(1, 6))
        vitals_table = Table(
            [
                [_cell("Parameter"), _cell("Measured"), _cell("Normal Range")],
                [_cell("Blood Pressure"), Paragraph(bp_value, table_body), _cell("90 - 120 / 60 - 80 mmHg")],
                [_cell("Temperature"), Paragraph(temperature_value, table_body), _cell("97 - 99 F")],
                [_cell("SpO2"), Paragraph(spo2_value, table_body), _cell("> 95%")],
                [_cell("Respiratory Rate"), Paragraph(respiratory_value, table_body), _cell("12 - 20 /min")],
            ],
            colWidths=[1.85 * inch, 2.7 * inch, 2.45 * inch],
            repeatRows=1,
        )
        vitals_table_style = TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cfd6de")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf2f8")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1f4e79")),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
        vitals_table.setStyle(vitals_table_style)
        story.append(vitals_table)
        story.append(Spacer(1, 10))

        story.append(_section_title("SPIROMETRY"))
        story.append(_blue_rule())
        story.append(Spacer(1, 6))
        spirometry_table = Table(
            [[_cell(cell) for cell in row] for row in table_data],
            colWidths=[140, 140, 180],
            repeatRows=1,
        )
        spirometry_table.setStyle(vitals_table_style)
        story.append(spirometry_table)
        story.append(Spacer(1, 10))

        story.append(_section_title("X-RAY IMAGE"))
        story.append(_blue_rule())
        story.append(Spacer(1, 6))
        if xray_png:
            image_buffer = BytesIO(xray_png)
            image_buffer.seek(0)
            story.append(RLImage(image_buffer, width=4.8 * inch, height=3.4 * inch))
        else:
            story.append(Paragraph("-", body))
        story.append(Spacer(1, 10))

        story.append(_section_title("RURAL DOCTOR DIAGNOSIS"))
        story.append(_blue_rule())
        story.append(Spacer(1, 6))
        story.append(_paragraph(case_row.get("rural_diagnosis_report") or "-"))
        story.append(Spacer(1, 10))

        story.append(_section_title("SPECIALIST DIAGNOSIS"))
        story.append(_blue_rule())
        story.append(Spacer(1, 6))
        specialist_table = Table(
            [
                [_cell("Diagnosis"), _cell(specialist_diagnosis_text)],
                [_cell("Severity"), _cell(specialist_severity)],
                [_cell("Clinical Notes"), _cell(specialist_notes)],
            ],
            colWidths=[1.8 * inch, 5.0 * inch],
        )
        specialist_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cfd6de")),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(specialist_table)
        story.append(Spacer(1, 10))

        story.append(_section_title("TREATMENT PLAN"))
        story.append(_blue_rule())
        story.append(Spacer(1, 6))
        treatment_table = Table(
            [[_cell("Item"), _cell("Details")]] + [[_cell(row[0]), _cell(row[1])] for row in treatment_rows],
            colWidths=[2.3 * inch, 4.5 * inch],
            repeatRows=1,
        )
        treatment_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cfd6de")),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf2f8")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1f4e79")),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(treatment_table)
        story.append(Spacer(1, 10))

        story.append(_section_title("PRESCRIPTIONS"))
        story.append(_blue_rule())
        story.append(Spacer(1, 6))
        prescription_table = Table(
            prescription_table_rows,
            colWidths=[2.2 * inch, 1.3 * inch, 1.5 * inch, 1.3 * inch],
            repeatRows=1,
        )
        prescription_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cfd6de")),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf2f8")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1f4e79")),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(prescription_table)
        story.append(Spacer(1, 10))

        story.append(_section_title("FOLLOWUPS"))
        story.append(_blue_rule())
        story.append(Spacer(1, 6))
        followup_table = Table(
            [
                [_cell("Next Visit Date"), _cell(followup_data.get("scheduled_date") or "-")],
                [_cell("Followup Notes"), _cell(followup_data.get("notes") or "-")],
            ],
            colWidths=[2.2 * inch, 4.4 * inch],
        )
        followup_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cfd6de")),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(followup_table)
        story.append(Spacer(1, 6))
        story.append(Paragraph("<b>FURTHER DIAGNOSTIC PROCEDURES</b>", body))
        if diagnostic_procedures:
            for index, item in enumerate(diagnostic_procedures, start=1):
                story.append(Paragraph(f"{index}. {_safe(item)}", body))
        else:
            story.append(Paragraph("-", body))
        story.append(Spacer(1, 10))

        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        def _footer(canvas, _doc):
            canvas.saveState()
            canvas.setStrokeColor(colors.HexColor("#1f4e79"))
            canvas.setLineWidth(1)
            canvas.line(_doc.leftMargin, 0.86 * inch, A4[0] - _doc.rightMargin, 0.86 * inch)
            canvas.setStrokeColor(colors.black)
            canvas.setFont("Helvetica", 8)
            canvas.drawCentredString(A4[0] / 2, 0.68 * inch, "Generated by TELE-PULMONOLOGY AI System")
            canvas.line(_doc.leftMargin, 0.46 * inch, _doc.leftMargin + 2.2 * inch, 0.46 * inch)
            canvas.drawString(_doc.leftMargin, 0.34 * inch, "Doctor Signature")
            canvas.line(A4[0] - _doc.rightMargin - 2.2 * inch, 0.46 * inch, A4[0] - _doc.rightMargin, 0.46 * inch)
            canvas.drawRightString(A4[0] - _doc.rightMargin, 0.34 * inch, f"Reviewed at {timestamp}")
            canvas.restoreState()

        doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        storage_path = f"{target_case_id}.pdf"
        _ensure_reports_bucket()
        upload_res = supabase.storage.from_("reports").upload(
            path=storage_path,
            file=pdf_bytes,
            file_options={
                "content-type": "application/pdf",
                "x-upsert": "true"
            }
        )

        print("PDF UPLOAD RESULT:", upload_res)

        if upload_res is None:
            print("UPLOAD SUCCESS ASSUMED")

        print("PDF STORED:", storage_path)

        update_res = supabase.from_("cases").update({
            "report_pdf_path": storage_path
        }).eq("id", target_case_id).execute()

        print("REPORT PATH DB UPDATE:", update_res)
        print("DB PATH UPDATED:", target_case_id)
    except Exception as exc:
        print("REPORT PDF GENERATION FAILED:", repr(exc))


class FinalizeRequest(BaseModel):
    case_id: str


@app.post("/finalize-case")
async def finalize_case(req: FinalizeRequest) -> Dict[str, Any]:
    case_id = (req.case_id or "").strip()
    if not case_id:
        raise HTTPException(status_code=400, detail="case_id required")

    reviewed_at = datetime.now(timezone.utc).isoformat()

    supabase.from_("cases").update({
        "status": "finalized",
        "reviewed_at": reviewed_at
    }).eq("id", case_id).execute()

    threading.Thread(
        target=_generate_pdf_async,
        args=(case_id,),
        daemon=True
    ).start()

    return {"success": True}


@app.post("/finalize-case/{case_id}")
def finalize_case_compat(case_id: str):
    update = (
        supabase.from_("cases")
        .update({
            "status": "finalized",
            "reviewed_at": datetime.now(timezone.utc).isoformat()
        })
        .eq("id", case_id)
        .execute()
    )
    if not update.data:
        raise HTTPException(status_code=400, detail="Finalize failed")
    threading.Thread(
        target=_generate_pdf_async,
        args=(case_id,),
        daemon=True
    ).start()
    return {"success": True}


@app.get("/download-report/{case_id}")
def download_report(case_id: str, request: Request) -> Dict[str, str]:
    patient_id = (request.headers.get("x-patient-id") or "").strip()
    if not patient_id:
        raise HTTPException(status_code=403, detail="Access denied")

    case_rows = (
        supabase.from_("cases")
        .select("id, patient_id, report_pdf_path, status")
        .eq("id", case_id)
        .limit(1)
        .execute()
    ).data
    case_row = (case_rows or [None])[0]
    if not case_row:
        raise HTTPException(status_code=403, detail="Access denied")
    if case_row.get("status") != "finalized":
        raise HTTPException(status_code=403, detail="Access denied")
    report_path = case_row.get("report_pdf_path")

    if not report_path:
        raise HTTPException(status_code=500, detail="Report path missing — PDF thread failed")
    if case_row.get("patient_id") != patient_id:
        raise HTTPException(status_code=403, detail="Access denied")

    signed = supabase.storage.from_("reports").create_signed_url(report_path, 300)

    print("SIGNED URL RESPONSE:", signed)

    signed_url = signed.get("signedURL") or signed.get("signed_url")

    if not signed_url:
        raise HTTPException(status_code=500, detail="Signed URL generation failed")
    return {"signed_url": signed_url}

