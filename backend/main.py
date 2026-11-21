import base64
import json
import mimetypes
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

DEMO_MODE_DEFAULT = os.getenv("DEMO_MODE", "true").lower() == "true"

app = FastAPI(
    title="OmniDoc Intelligent Document & Invoice Auditor API",
    version="1.1.0",
)

raw_frontend_urls = os.getenv("FRONTEND_URL", "")
extra_origins = [u.strip().rstrip("/") for u in raw_frontend_urls.split(",") if u.strip()]
allowed_origins = list(set(["http://localhost:3000", "http://127.0.0.1:3000", *extra_origins]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp",
    ".tiff", ".tif", ".txt", ".csv", ".json", ".xml", ".html", ".htm", ".md",
}
TEXT_EXTENSIONS = {".txt", ".csv", ".json", ".xml", ".html", ".htm", ".md"}


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    document_context: str
    question: str
    chat_history: List[ChatTurn] = []
    demo_mode: Optional[bool] = None


def _is_azure_configured() -> bool:
    return bool(os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT") and os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY"))


def _is_azure_language_configured() -> bool:
    return bool(os.getenv("AZURE_LANGUAGE_ENDPOINT") and os.getenv("AZURE_LANGUAGE_KEY"))


def _is_azure_openai_configured() -> bool:
    return bool(os.getenv("AZURE_OPENAI_ENDPOINT") and os.getenv("AZURE_OPENAI_API_KEY"))


def _is_gemini_configured() -> bool:
    key = (os.getenv("GEMINI_API_KEY") or "").strip()
    return bool(key and key != "MY_GEMINI_API_KEY")


def _infer_mime_type(file_name: str, provided_mime: Optional[str]) -> str:
    ext = os.path.splitext((file_name or "").lower())[1]
    ext_map = {
        ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
        ".bmp": "image/bmp", ".tiff": "image/tiff", ".tif": "image/tiff",
        ".txt": "text/plain", ".csv": "text/csv", ".json": "application/json",
        ".xml": "application/xml", ".html": "text/html", ".htm": "text/html", ".md": "text/markdown",
    }
    if ext in ext_map:
        return ext_map[ext]
    if provided_mime and provided_mime != "application/octet-stream":
        return "image/jpeg" if provided_mime == "image/jpg" else provided_mime
    guessed, _ = mimetypes.guess_type(file_name or "")
    return guessed or "application/octet-stream"


def _build_redacted_text(raw_text: str, pii_entities: List[Dict[str, Any]]) -> str:
    if not raw_text or not pii_entities:
        return raw_text
    redacted = raw_text
    for ent in sorted(pii_entities, key=lambda x: len(str(x.get("text", ""))), reverse=True):
        val = str(ent.get("text", ""))
        mask = str(ent.get("redactedValue", "[REDACTED]"))
        if len(val.strip()) >= 2:
            redacted = redacted.replace(val, mask)
    return redacted


def _normalize_category(raw: str) -> str:
    v = (raw or "").lower()
    if "org" in v or "company" in v or "vendor" in v:
        return "Organization"
    if "date" in v or "time" in v:
        return "DateTime"
    if "loc" in v or "city" in v or "addr" in v or "country" in v:
        return "Location"
    if "curr" in v or "money" in v or "amount" in v:
        return "Currency"
    if "person" in v or "name" in v:
        return "Person"
    return "Identifier"


def _parse_float(val: Any) -> float:
    if isinstance(val, (int, float)):
        return float(val)
    if val is None:
        return 0.0
    cleaned = re.sub(r"[^0-9.-]+", "", str(val))
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0


def _compute_reconciliation(
    extracted_fields: List[Dict[str, Any]],
    line_items: List[Dict[str, Any]],
    doc_type: str,
    stated_tax_rate: Optional[float] = None,
) -> Dict[str, Any]:
    if doc_type == "document" and not line_items:
        return {
            "lineItemsSum": 0.0, "reportedSubtotal": 0.0, "reportedTax": 0.0,
            "reportedTotal": 0.0, "calculatedTotal": 0.0, "discrepancyAmount": 0.0,
            "hasDiscrepancy": False,
            "summary": "General document analyzed via prebuilt-read; no invoice totals require arithmetic reconciliation.",
        }

    def get_num(key: str) -> float:
        for f in extracted_fields:
            if f.get("key") == key:
                return _parse_float(f.get("numericValue") if f.get("numericValue") is not None else f.get("value"))
        return 0.0

    line_sum = round(sum(_parse_float(i.get("amount")) for i in line_items), 2)
    subtotal = get_num("subtotal") or line_sum
    tax = get_num("tax")
    total = get_num("total_amount")
    calc_total = round(subtotal + tax, 2)
    subtotal_diff = abs(round(line_sum - subtotal, 2)) if line_items else 0.0
    total_diff = abs(round(total - calc_total, 2)) if total > 0 else 0.0
    effective_rate = f"{(tax / subtotal) * 100:.2f}%" if subtotal > 0 and tax > 0 else None

    if stated_tax_rate and stated_tax_rate > 0 and subtotal > 0:
        expected_tax = round(subtotal * stated_tax_rate / 100.0, 2)
        tax_diff = round(tax - expected_tax, 2)
        if abs(tax_diff) > 0.05:
            return {
                "lineItemsSum": line_sum, "reportedSubtotal": subtotal, "reportedTax": tax,
                "reportedTotal": total, "calculatedTotal": round(subtotal + expected_tax, 2),
                "expectedTaxRate": f"{stated_tax_rate:.2f}%", "effectiveTaxRate": effective_rate,
                "discrepancyAmount": tax_diff, "hasDiscrepancy": True,
                "summary": f"Tax discrepancy: Stated {stated_tax_rate:.2f}% implies {expected_tax:.2f}, billed {tax:.2f} (variance {tax_diff:+.2f}).",
            }

    if subtotal_diff > 0.02 or total_diff > 0.02:
        diff = round(total - calc_total, 2) if total_diff > 0.02 else round(subtotal - line_sum, 2)
        return {
            "lineItemsSum": line_sum, "reportedSubtotal": subtotal, "reportedTax": tax,
            "reportedTotal": total, "calculatedTotal": calc_total, "effectiveTaxRate": effective_rate,
            "discrepancyAmount": diff, "hasDiscrepancy": True,
            "summary": f"Reported total ({total:.2f}) differs from Subtotal + Tax ({calc_total:.2f}) by {abs(diff):.2f}.",
        }

    return {
        "lineItemsSum": line_sum, "reportedSubtotal": subtotal, "reportedTax": tax,
        "reportedTotal": total, "calculatedTotal": calc_total, "effectiveTaxRate": effective_rate,
        "discrepancyAmount": 0.0, "hasDiscrepancy": False,
        "summary": (
            f"All line items ({line_sum:.2f}) and taxes ({tax:.2f}) reconcile cleanly with total ({total:.2f})."
            if total > 0 else "Document extracted cleanly with no arithmetic discrepancies."
        ),
    }


def _call_gemini_rest(parts: List[Dict[str, Any]], system_instruction: Optional[str] = None, json_mode: bool = False) -> str:
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    model = (os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    body: Dict[str, Any] = {"contents": [{"role": "user", "parts": parts}]}
    if system_instruction:
        body["systemInstruction"] = {"parts": [{"text": system_instruction}]}
    if json_mode:
        body["generationConfig"] = {"responseMimeType": "application/json"}

    req = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=50) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Gemini API HTTP {e.code}: {e.read().decode('utf-8', errors='ignore')[:300]}")
    except Exception as e:
        raise RuntimeError(f"Gemini API request failed: {str(e)}")

    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("Gemini API returned no candidates.")
    return "".join(str(p.get("text", "")) for p in candidates[0].get("content", {}).get("parts", [])).strip()


def _analyze_with_gemini(file_bytes: bytes, content_type: str, file_name: str) -> Dict[str, Any]:
    ext = os.path.splitext((file_name or "").lower())[1]
    is_text = ext in TEXT_EXTENSIONS or content_type.startswith("text/") or content_type in {"application/json", "application/xml"}

    prompt = """You are OmniDoc, an enterprise Document Intelligence, Responsible AI Language, and Financial Audit engine aligned with Microsoft Azure AI-900.
Analyze the attached document (ANY type of invoice, GST/VAT bill, receipt, utility bill, contract, certificate, or badge) and extract ALL factual data accurately.
Return ONLY valid JSON:
{
  "document_type": "invoice" | "receipt" | "document",
  "model_used": "prebuilt-invoice" | "prebuilt-read",
  "currency": "USD",
  "extracted_fields": [{"key": "vendor_name", "label": "Vendor / Issuer", "value": "...", "confidence": 0.96, "numericValue": null}],
  "line_items": [{"description": "...", "quantity": 1, "unitPrice": 100.0, "amount": 100.0, "confidence": 0.95}],
  "raw_text": "Full accurate OCR text preserving lines",
  "pii_entities": [{"text": "exact substring from raw_text", "category": "Email|PhoneNumber|Address|Person|USSocialSecurityNumber|BankAccountNumber|ABARoutingNumber|NationalID|TaxID", "redactedValue": "[REDACTED: EMAIL]", "confidence": 0.98}],
  "named_entities": [{"text": "...", "category": "Organization|DateTime|Location|Currency|Person|Identifier", "confidence": 0.96}],
  "summary": "2-3 sentence executive summary.",
  "stated_tax_rate_percent": null,
  "audit_flags": [{"severity": "verified"|"warning"|"alert", "title": "...", "detail": "..."}]
}
For invoices/receipts use keys vendor_name, invoice_id, invoice_date, due_date, customer_name, subtotal, tax, total_amount.
For general documents (contracts, certificates, badges) set document_type="document", model_used="prebuilt-read", and extract 5-8 relevant fields (issuer, recipient_name, document_title, issue_date, etc.)."""

    parts: List[Dict[str, Any]] = []
    if is_text:
        parts.append({"text": f"UPLOADED DOCUMENT ({file_name}):\n\n{file_bytes.decode('utf-8', errors='replace')[:40000]}\n\n{prompt}"})
    else:
        parts.append({"inlineData": {"mimeType": content_type, "data": base64.b64encode(file_bytes).decode("ascii")}})
        parts.append({"text": prompt})

    raw_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", _call_gemini_rest(parts, json_mode=True)).strip()
    parsed = json.loads(raw_json)

    doc_type = parsed.get("document_type", "document")
    if doc_type not in {"invoice", "receipt", "document"}:
        doc_type = "document"
    model_used = "prebuilt-read" if (parsed.get("model_used") == "prebuilt-read" or doc_type == "document") else "prebuilt-invoice"

    extracted_fields = parsed.get("extracted_fields") or []
    line_items = parsed.get("line_items") or []
    pii_entities = parsed.get("pii_entities") or []
    raw_text = str(parsed.get("raw_text") or "")
    stated_tax = parsed.get("stated_tax_rate_percent")
    reconciliation = _compute_reconciliation(
        extracted_fields, line_items, doc_type, float(stated_tax) if isinstance(stated_tax, (int, float)) else None
    )

    confs = [float(f.get("confidence", 0.92)) for f in extracted_fields] + [float(i.get("confidence", 0.92)) for i in line_items]
    return {
        "document_type": doc_type,
        "model_used": model_used,
        "processing_mode": "live-ai",
        "file_name": file_name,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "average_confidence": round(sum(confs) / len(confs), 3) if confs else 0.94,
        "currency": str(parsed.get("currency") or "USD"),
        "extracted_fields": extracted_fields,
        "line_items": line_items,
        "reconciliation": reconciliation,
        "raw_text": raw_text,
        "redacted_text": _build_redacted_text(raw_text, pii_entities),
        "pii_entities": pii_entities,
        "named_entities": [
            {"text": str(e.get("text", "")), "category": _normalize_category(str(e.get("category", "Identifier"))), "confidence": round(float(e.get("confidence", 0.92)), 3)}
            for e in (parsed.get("named_entities") or []) if e.get("text")
        ],
        "summary": str(parsed.get("summary") or "Document analyzed and structured for audit review."),
        "audit_flags": [
            {"severity": f.get("severity") if f.get("severity") in {"verified", "warning", "alert"} else "verified", "title": str(f.get("title", "Audit Note")), "detail": str(f.get("detail", ""))}
            for f in (parsed.get("audit_flags") or [])
        ],
    }


def _build_demo_payload(file_name: str, sample_id: Optional[str] = None) -> Dict[str, Any]:
    raw_text = (
        "NORTHWIND CLOUD INFRASTRUCTURE LLC\n1420 Harborview Blvd, Suite 900, Seattle, WA 98101\n"
        "Tax ID / EIN: 91-4820194 | Billing Support: billing@northwindcloud.io | Tel: +1 (206) 555-0194\n\n"
        "COMMERCIAL INVOICE — Invoice Number: INV-2026-8841\nInvoice Date: 2026-10-15 | Payment Terms: Net 30 (Due 2026-11-14)\n\n"
        "BILL TO: Apex Meridian Financial Corp — Attn: Elena Rostova, VP Finance\n775 Market Street, Floor 14, San Francisco, CA 94103\n"
        "Email: e.rostova@apexmeridian.com | Direct: +1 (415) 555-0148\n\n"
        "LINE ITEMS:\n1. Azure Kubernetes Managed Cluster (Prod-US-West) — Qty 3 x $2,400.00 = $7,200.00\n"
        "2. Enterprise AI Document Processing Tier (250k pages) — Qty 1 x $3,850.00 = $3,850.00\n"
        "3. Dedicated Private Link & HSM Compliance Vault — Qty 2 x $975.00 = $1,950.00\n\n"
        "Subtotal: $13,000.00\nState & Local Sales Tax (Stated Rate 8.25%): $1,215.00\nTotal Amount Due: $14,215.00\n\n"
        "REMITTANCE: First Pacific Commercial Bank | Routing: 121000358 | Account: 8840-2910-4419\n"
        "Compliance Contact: Marcus Vance (SSN on W-9 Ref: 418-62-9031)"
    )
    pii_entities = [
        {"text": "1420 Harborview Blvd, Suite 900, Seattle, WA 98101", "category": "Address", "redactedValue": "[REDACTED: ADDRESS]", "confidence": 0.97},
        {"text": "billing@northwindcloud.io", "category": "Email", "redactedValue": "[REDACTED: EMAIL]", "confidence": 0.99},
        {"text": "+1 (206) 555-0194", "category": "PhoneNumber", "redactedValue": "[REDACTED: PHONE]", "confidence": 0.98},
        {"text": "Elena Rostova", "category": "Person", "redactedValue": "[REDACTED: PERSON]", "confidence": 0.96},
        {"text": "775 Market Street, Floor 14, San Francisco, CA 94103", "category": "Address", "redactedValue": "[REDACTED: ADDRESS]", "confidence": 0.98},
        {"text": "e.rostova@apexmeridian.com", "category": "Email", "redactedValue": "[REDACTED: EMAIL]", "confidence": 0.99},
        {"text": "+1 (415) 555-0148", "category": "PhoneNumber", "redactedValue": "[REDACTED: PHONE]", "confidence": 0.98},
        {"text": "121000358", "category": "ABARoutingNumber", "redactedValue": "[REDACTED: ROUTING]", "confidence": 0.95},
        {"text": "8840-2910-4419", "category": "BankAccountNumber", "redactedValue": "[REDACTED: BANK_ACCT]", "confidence": 0.97},
        {"text": "Marcus Vance", "category": "Person", "redactedValue": "[REDACTED: PERSON]", "confidence": 0.95},
        {"text": "418-62-9031", "category": "USSocialSecurityNumber", "redactedValue": "[REDACTED: SSN]", "confidence": 0.99},
    ]
    return {
        "document_type": "invoice", "model_used": "prebuilt-invoice", "processing_mode": "demo",
        "file_name": file_name or "Northwind_Cloud_Invoice_INV-2026-8841.pdf",
        "analyzed_at": datetime.now(timezone.utc).isoformat(), "average_confidence": 0.966, "currency": "USD",
        "extracted_fields": [
            {"key": "vendor_name", "label": "Vendor Name", "value": "Northwind Cloud Infrastructure LLC", "confidence": 0.99},
            {"key": "invoice_id", "label": "Invoice ID", "value": "INV-2026-8841", "confidence": 0.99},
            {"key": "invoice_date", "label": "Invoice Date", "value": "2026-10-15", "confidence": 0.98},
            {"key": "due_date", "label": "Due Date (Net 30)", "value": "2026-11-14", "confidence": 0.97},
            {"key": "customer_name", "label": "Bill To", "value": "Apex Meridian Financial Corp", "confidence": 0.98},
            {"key": "subtotal", "label": "Subtotal", "value": "$13,000.00", "confidence": 0.99, "numericValue": 13000.0},
            {"key": "tax", "label": "Tax Amount (Stated 8.25%)", "value": "$1,215.00", "confidence": 0.84, "numericValue": 1215.0},
            {"key": "total_amount", "label": "Total Amount Due", "value": "$14,215.00", "confidence": 0.99, "numericValue": 14215.0},
        ],
        "line_items": [
            {"description": "Azure Kubernetes Managed Cluster (Prod-US-West)", "quantity": 3, "unitPrice": 2400.0, "amount": 7200.0, "confidence": 0.99},
            {"description": "Enterprise AI Document Processing Tier (250k pages)", "quantity": 1, "unitPrice": 3850.0, "amount": 3850.0, "confidence": 0.98},
            {"description": "Dedicated Private Link & HSM Compliance Vault", "quantity": 2, "unitPrice": 975.0, "amount": 1950.0, "confidence": 0.97},
        ],
        "reconciliation": {
            "lineItemsSum": 13000.0, "reportedSubtotal": 13000.0, "reportedTax": 1215.0, "reportedTotal": 14215.0,
            "calculatedTotal": 14072.5, "expectedTaxRate": "8.25%", "effectiveTaxRate": "9.35%",
            "discrepancyAmount": 142.5, "hasDiscrepancy": True,
            "summary": "Tax discrepancy detected: 8.25% on $13,000.00 is $1,072.50, but $1,215.00 was billed (+$142.50 overcharge).",
        },
        "raw_text": raw_text, "redacted_text": _build_redacted_text(raw_text, pii_entities), "pii_entities": pii_entities,
        "named_entities": [
            {"text": "Northwind Cloud Infrastructure LLC", "category": "Organization", "confidence": 0.99},
            {"text": "Apex Meridian Financial Corp", "category": "Organization", "confidence": 0.99},
            {"text": "2026-10-15", "category": "DateTime", "confidence": 0.99},
            {"text": "Seattle, WA", "category": "Location", "confidence": 0.98},
            {"text": "$14,215.00", "category": "Currency", "confidence": 0.99},
        ],
        "summary": "Commercial cloud invoice (#INV-2026-8841) totaling $14,215.00 under Net 30 terms with a +$142.50 tax discrepancy and sensitive remittance PII.",
        "audit_flags": [
            {"severity": "alert", "title": "Tax Rate Overcharge (+$142.50)", "detail": "Stated 8.25% tax equals $1,072.50, while invoice charges $1,215.00."},
            {"severity": "alert", "title": "High-Sensitivity PII Redacted", "detail": "Detected US SSN and ACH bank credentials; safe redacted view generated."},
        ],
    }


def _analyze_with_azure(file_bytes: bytes, content_type: str, file_name: str) -> Dict[str, Any]:
    from azure.ai.documentintelligence import DocumentIntelligenceClient
    from azure.core.credentials import AzureKeyCredential

    doc_client = DocumentIntelligenceClient(
        endpoint=os.environ["AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT"],
        credential=AzureKeyCredential(os.environ["AZURE_DOCUMENT_INTELLIGENCE_KEY"]),
    )
    model_used = "prebuilt-invoice"
    result = doc_client.begin_analyze_document(model_id="prebuilt-invoice", body=file_bytes, content_type=content_type).result()
    if not result.documents:
        model_used = "prebuilt-read"
        result = doc_client.begin_analyze_document(model_id="prebuilt-read", body=file_bytes, content_type=content_type).result()

    raw_text = result.content or ""
    extracted_fields: List[Dict[str, Any]] = []
    line_items: List[Dict[str, Any]] = []

    if result.documents:
        fields = result.documents[0].fields or {}
        for azure_key, key, label in [
            ("VendorName", "vendor_name", "Vendor Name"), ("InvoiceId", "invoice_id", "Invoice ID"),
            ("InvoiceDate", "invoice_date", "Invoice Date"), ("DueDate", "due_date", "Due Date"),
            ("CustomerName", "customer_name", "Bill To"), ("SubTotal", "subtotal", "Subtotal"),
            ("TotalTax", "tax", "Tax Amount"), ("InvoiceTotal", "total_amount", "Total Amount"),
        ]:
            field = fields.get(azure_key)
            if field:
                nv = field.value_currency.amount if field.value_currency else None
                extracted_fields.append({"key": key, "label": label, "value": field.content or str(nv or ""), "confidence": round(float(field.confidence or 0.9), 3), "numericValue": nv})
        items_field = fields.get("Items")
        if items_field and items_field.value_array:
            for item in items_field.value_array:
                obj = item.value_object or {}
                line_items.append({
                    "description": obj["Description"].content if obj.get("Description") else "Line Item",
                    "quantity": float(obj["Quantity"].value_number) if obj.get("Quantity") and obj["Quantity"].value_number else 1.0,
                    "unitPrice": float(obj["UnitPrice"].value_currency.amount) if obj.get("UnitPrice") and obj["UnitPrice"].value_currency else 0.0,
                    "amount": float(obj["Amount"].value_currency.amount) if obj.get("Amount") and obj["Amount"].value_currency else 0.0,
                    "confidence": round(float(item.confidence or 0.9), 3),
                })

    pii_entities, named_entities, redacted_text = [], [], raw_text
    summary_text = "Document processed via Azure AI Document Intelligence."
    if _is_azure_language_configured():
        from azure.ai.textanalytics import TextAnalyticsClient
        lang_client = TextAnalyticsClient(endpoint=os.environ["AZURE_LANGUAGE_ENDPOINT"], credential=AzureKeyCredential(os.environ["AZURE_LANGUAGE_KEY"]))
        chunk = raw_text[:5000] if raw_text else "Empty document."
        pii_res = lang_client.recognize_pii_entities([chunk])[0]
        ner_res = lang_client.recognize_entities([chunk])[0]
        if not pii_res.is_error:
            redacted_text = pii_res.redacted_text
            pii_entities = [{"text": e.text, "category": e.category, "redactedValue": f"[REDACTED: {e.category.upper()}]", "confidence": round(float(e.confidence_score), 3)} for e in pii_res.entities]
        if not ner_res.is_error:
            named_entities = [{"text": e.text, "category": _normalize_category(e.category), "confidence": round(float(e.confidence_score), 3)} for e in ner_res.entities]

    doc_type = "invoice" if model_used == "prebuilt-invoice" else "document"
    return {
        "document_type": doc_type, "model_used": model_used, "processing_mode": "live-ai", "file_name": file_name,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "average_confidence": round(sum(f["confidence"] for f in extracted_fields) / max(len(extracted_fields), 1), 3),
        "currency": "USD", "extracted_fields": extracted_fields, "line_items": line_items,
        "reconciliation": _compute_reconciliation(extracted_fields, line_items, doc_type),
        "raw_text": raw_text, "redacted_text": redacted_text, "pii_entities": pii_entities,
        "named_entities": named_entities, "summary": summary_text, "audit_flags": [],
    }


@app.get("/")
def root():
    return {
        "service": "OmniDoc Intelligent Document & Invoice Auditor API",
        "status": "running",
        "demo_mode": DEMO_MODE_DEFAULT,
        "live_ai_available": _is_azure_configured() or _is_gemini_configured(),
        "docs_url": "/docs",
        "health_url": "/api/health",
    }


@app.get("/api/health")
def health_check():
    has_live = _is_azure_configured() or _is_gemini_configured()
    return {
        "status": "ok",
        "default_demo_mode": DEMO_MODE_DEFAULT or not has_live,
        "live_ai_available": has_live,
        "azure_configured": _is_azure_configured(),
        "gemini_configured": _is_gemini_configured(),
    }


@app.post("/api/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    demo_mode: Optional[str] = Form(default=None),
    sample_id: Optional[str] = Form(default=None),
):
    file_name = file.filename or "uploaded_document"
    ext = os.path.splitext(file_name.lower())[1]
    mime_type = _infer_mime_type(file_name, file.content_type)

    if ext and ext not in ALLOWED_EXTENSIONS and not (mime_type.startswith("image/") or mime_type == "application/pdf" or mime_type.startswith("text/")):
        raise HTTPException(status_code=400, detail=f"Unsupported file format ({ext or mime_type}).")

    has_live = _is_azure_configured() or _is_gemini_configured()
    use_demo = demo_mode.lower() == "true" if demo_mode is not None else (DEMO_MODE_DEFAULT or not has_live)
    if use_demo:
        return _build_demo_payload(file_name, sample_id)

    file_bytes = await file.read()
    if _is_azure_configured():
        try:
            return _analyze_with_azure(file_bytes, mime_type, file_name)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Azure AI analysis failed: {str(exc)}")
    if _is_gemini_configured():
        try:
            return _analyze_with_gemini(file_bytes, mime_type, file_name)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Live AI analysis failed: {str(exc)}")

    raise HTTPException(
        status_code=503,
        detail="Live AI requires GEMINI_API_KEY (or Azure AI keys) in your Vercel backend Environment Variables + Redeploy.",
    )


@app.post("/api/chat")
async def audit_chat(payload: ChatRequest):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    has_chat_live = _is_azure_openai_configured() or _is_gemini_configured()
    use_demo = payload.demo_mode if payload.demo_mode is not None else (DEMO_MODE_DEFAULT or not has_chat_live)
    if use_demo:
        if "tax" in payload.question.lower() or "discrepanc" in payload.question.lower():
            return {"answer": "Subtotal is $13,000.00 and stated tax rate is 8.25% ($1,072.50 expected), whereas $1,215.00 was billed (+$142.50 overcharge).", "mode": "demo", "grounded": True}
        return {"answer": "Grounded Demo Mode response: Ask about tax discrepancies, Net 30 payment terms, line items, or PII findings.", "mode": "demo", "grounded": True}

    system_prompt = (
        "You are OmniDoc Audit Copilot. Answer ONLY using facts explicitly present in the provided DOCUMENT CONTEXT "
        "and exact arithmetic derived from it. If the answer is not in the document, reply: "
        "'That information is not present in the uploaded document.'\n\n"
        f"DOCUMENT CONTEXT:\n{payload.document_context[:24000]}"
    )

    if _is_azure_openai_configured():
        from openai import AzureOpenAI
        client = AzureOpenAI(
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_key=os.environ["AZURE_OPENAI_API_KEY"],
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21"),
        )
        msgs = [{"role": "system", "content": system_prompt}] + [{"role": t.role, "content": t.content} for t in payload.chat_history[-8:]] + [{"role": "user", "content": payload.question}]
        comp = client.chat.completions.create(model=os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o"), messages=msgs, temperature=0.1)
        return {"answer": comp.choices[0].message.content or "", "mode": "azure-live", "grounded": True}

    if _is_gemini_configured():
        history_text = "\n".join(f"{'Auditor' if t.role == 'user' else 'OmniDoc'}: {t.content}" for t in payload.chat_history[-8:])
        user_msg = f"PRIOR CONVERSATION:\n{history_text}\n\nAUDITOR QUESTION:\n{payload.question}" if history_text else f"AUDITOR QUESTION:\n{payload.question}"
        try:
            return {"answer": _call_gemini_rest([{"text": user_msg}], system_instruction=system_prompt), "mode": "live-ai", "grounded": True}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Live AI Q&A failed: {str(exc)}")

    raise HTTPException(status_code=503, detail="Live Q&A requires GEMINI_API_KEY or AZURE_OPENAI_API_KEY in backend Environment Variables.")
