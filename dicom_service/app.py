from __future__ import annotations

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import base64
import os
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict

from supabase.client import create_client
import numpy as np
import pydicom
from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel
from pydicom.pixel_data_handlers.util import apply_voi_lut
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
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


def _normalize_to_uint8(pixel_array: np.ndarray, ds: pydicom.Dataset) -> np.ndarray:
    data = pixel_array.astype(np.float32)
    try:
        data = apply_voi_lut(data, ds)
    except Exception:
        pass
    if getattr(ds, "PhotometricInterpretation", "") == "MONOCHROME1":
        data = np.max(data) - data
    min_val = float(np.min(data))
    max_val = float(np.max(data))
    if max_val == min_val:
        return np.zeros_like(data, dtype=np.uint8)
    scaled = (data - min_val) / (max_val - min_val)
    scaled = (scaled * 255.0).clip(0, 255).astype(np.uint8)
    return scaled


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
    normalized = _normalize_to_uint8(pixel_array, ds)
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


def _build_report_pdf(case_row: Dict[str, Any], patient_row: Dict[str, Any] | None, xray_png: bytes | None) -> bytes:
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

    story.append(Paragraph("Clinical Findings", section_style))
    story.append(Paragraph(f"Rural Diagnosis: {case_row.get('rural_diagnosis_report') or '-'}", body))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"Specialist Diagnosis: {case_row.get('specialist_diagnosis_report') or '-'}", body))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"Follow-up Notes: {case_row.get('follow_up_notes') or '-'}", body))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Procedures Required", section_style))
    procedures = []
    if case_row.get("ct_scan_required"):
        procedures.append("CT Scan Required")
    if case_row.get("bronchoscopy_required"):
        procedures.append("Bronchoscopy Required")
    if procedures:
        for item in procedures:
            story.append(Paragraph(item, body))
    else:
        story.append(Paragraph("None", body))
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
def render_dicom(payload: RenderDicomRequest) -> Dict[str, Any]:
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
        normalized = _normalize_to_uint8(pixel_array, ds)
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

        return {"image_base64": image_base64, "metadata": metadata}
    except Exception as exc:
        print("DICOM RENDER FAILED:", repr(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/generate-report-pdf")
def generate_report_pdf(payload: GenerateReportRequest) -> Dict[str, str]:
    case_id = (payload.case_id or "").strip()
    if not case_id:
        raise HTTPException(status_code=400, detail="case_id is required")

    reviewed_at = datetime.now(timezone.utc).isoformat()
    supabase.from_("cases").update({"status": "finalized", "reviewed_at": reviewed_at}).eq("id", case_id).execute()

    case_row = _fetch_single(
        "cases",
        "id, patient_id, rural_doctor_id, specialist_id, rural_diagnosis_report, specialist_diagnosis_report, follow_up_notes, ct_scan_required, bronchoscopy_required, created_at, status",
        "id",
        case_id,
    )
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    if case_row.get("status") != "finalized":
        raise HTTPException(status_code=400, detail="Case is not finalized")

    patient_id = case_row.get("patient_id")
    patient_row = _fetch_single(
        "patients",
        "name, generated_patient_id, age, gender, height_cm, weight_kg, smoking_history, phone_number",
        "id",
        patient_id,
    )
    rural_doctor = _fetch_single(
        "profiles",
        "full_name",
        "id",
        case_row.get("rural_doctor_id"),
    )
    specialist = _fetch_single(
        "profiles",
        "full_name",
        "id",
        case_row.get("specialist_id"),
    )
    vitals_row = (
        supabase.from_("vitals")
        .select("spo2, respiratory_rate, created_at")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data
    vitals = (vitals_row or [None])[0] if vitals_row is not None else None

    xray_row = (
        supabase.from_("xrays")
        .select("file_path, created_at")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data
    xray_path = (xray_row or [None])[0].get("file_path") if xray_row else None
    xray_png = _dicom_to_png_bytes("x_rays", xray_path) if xray_path else None

    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    heading = styles["Heading2"]
    body = styles["BodyText"]
    body.leading = 14

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    story = []
    story.append(Paragraph("TELE-PULMONOLOGY REPORT", title_style))
    story.append(Spacer(1, 12))

    patient_info = [
        ["Patient Name", patient_row.get("name") if patient_row else "-"],
        ["Patient ID", patient_row.get("generated_patient_id") if patient_row else "-"],
        ["Phone Number", patient_row.get("phone_number") if patient_row else "-"],
        ["Age / Gender", f'{patient_row.get("age", "-")} / {patient_row.get("gender", "-")}' if patient_row else "-"],
        [
            "Height / Weight",
            f'{patient_row.get("height_cm", "-")} / {patient_row.get("weight_kg", "-")}' if patient_row else "-",
        ],
        ["Visit Date", case_row.get("created_at") or "-"],
        ["Rural Doctor", (rural_doctor or {}).get("full_name") or "-"],
        ["Specialist", (specialist or {}).get("full_name") or "-"],
    ]
    story.append(Paragraph("Patient Details", heading))
    table = Table(patient_info, colWidths=[1.6 * inch, 4.8 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.black),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Clinical History", heading))
    story.append(Paragraph(patient_row.get("smoking_history") if patient_row else "-", body))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Vitals & Measurements", heading))
    vitals_text = (
        f"SpO2: {vitals.get('spo2', '—')}% | Respiratory Rate: {vitals.get('respiratory_rate', '—')} breaths/min"
        if vitals
        else "—"
    )
    story.append(Paragraph(vitals_text, body))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Radiology Findings", heading))
    if xray_png:
        image_buffer = BytesIO(xray_png)
        image_buffer.seek(0)
        img = RLImage(image_buffer, width=400, height=300)
        story.append(img)
    else:
        story.append(Paragraph("-", body))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Rural Diagnosis", heading))
    story.append(Paragraph(case_row.get("rural_diagnosis_report") or "-", body))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Specialist Diagnosis", heading))
    story.append(Paragraph(case_row.get("specialist_diagnosis_report") or "-", body))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Recommended Further Investigations", heading))
    ct_required = "✓ CT Scan" if case_row.get("ct_scan_required") else "CT Scan"
    bronchoscopy_required = "✓ Bronchoscopy" if case_row.get("bronchoscopy_required") else "Bronchoscopy"
    story.append(Paragraph(ct_required, body))
    story.append(Paragraph(bronchoscopy_required, body))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Follow-up Plan", heading))
    story.append(Paragraph(case_row.get("follow_up_notes") or "-", body))
    story.append(Spacer(1, 12))

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    def _footer(canvas, _doc):
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.grey)
        canvas.drawRightString(A4[0] - 0.75 * inch, 0.5 * inch, f"Generated {timestamp}")
        canvas.drawString(0.75 * inch, 0.5 * inch, "System Signature: ____________________")

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    filename = f"{case_id}.pdf"
    storage_path = f"{case_id}.pdf"
    supabase.storage.from_("reports").upload(storage_path, pdf_bytes, {"content-type": "application/pdf"})
    supabase.from_("cases").update({"report_pdf_path": storage_path}).eq("id", case_id).execute()

    return {"status": "ok", "file": filename}


@app.post("/finalize-case/{case_id}")
def finalize_case(case_id: str) -> Dict[str, Any]:
    case_id = (case_id or "").strip()
    if not case_id:
        raise HTTPException(status_code=400, detail="case_id is required")

    reviewed_at = datetime.now(timezone.utc).isoformat()
    supabase.from_("cases").update({"status": "finalized", "reviewed_at": reviewed_at}).eq("id", case_id).execute()

    case_row = (
        supabase.from_("cases")
        .select(
            "id, patient_id, rural_diagnosis_report, specialist_diagnosis_report, follow_up_notes, ct_scan_required, bronchoscopy_required, reviewed_at, created_at, patients (name, age, gender, smoking_history, height_cm, weight_kg)"
        )
        .eq("id", case_id)
        .maybe_single()
        .execute()
    ).data
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")

    patient_id = case_row.get("patient_id")
    patient_row = case_row.get("patients")
    if isinstance(patient_row, list):
        patient_row = patient_row[0] if patient_row else None
    if not patient_id or not patient_row:
        raise HTTPException(status_code=404, detail="Patient not found")

    try:
        xray_row = (
            supabase.from_("xrays")
            .select("file_path, created_at")
            .eq("patient_id", patient_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        xray_path = (xray_row or [None])[0].get("file_path") if xray_row else None
        xray_png = _dicom_to_png_bytes("x_rays", xray_path) if xray_path else None

        pdf_bytes = _build_report_pdf(case_row, patient_row, xray_png)

        _ensure_reports_bucket()
        if isinstance(pdf_bytes, bool):
            raise HTTPException(status_code=500, detail="Invalid PDF bytes type")
        file_path = f"{case_id}.pdf"
        upload_result = supabase.storage.from_("reports").upload(
            path=file_path,
            file=pdf_bytes,
            file_options={
                "content-type": "application/pdf",
                "x-upsert": "true",
            },
        )
        if isinstance(upload_result, dict) and upload_result.get("error"):
            raise HTTPException(status_code=500, detail="Report upload failed")

        update_result = supabase.from_("cases").update({"report_pdf_path": file_path}).eq("id", case_id).execute()
        if not (update_result.data or []):
            raise HTTPException(status_code=500, detail="Failed to update report path")
    except Exception as e:
        print("PDF GENERATION ERROR:", str(e))
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

    print("Finalize completed for case:", case_id)
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
    if not case_row.get("report_pdf_path"):
        raise HTTPException(status_code=403, detail="Access denied")
    if case_row.get("patient_id") != patient_id:
        raise HTTPException(status_code=403, detail="Access denied")

    report_path = case_row.get("report_pdf_path")
    signed = supabase.storage.from_("reports").create_signed_url(report_path, 60)
    signed_url = None
    if isinstance(signed, dict):
        signed_url = signed.get("signedURL") or signed.get("signed_url")
    if not signed_url:
        raise HTTPException(status_code=500, detail="Unable to generate signed URL")
    return {"signed_url": signed_url}






