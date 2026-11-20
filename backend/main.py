"""
OmniDoc: Intelligent Document & Invoice Auditor — FastAPI Backend
Aligned with Microsoft Azure AI-900 (Azure AI Fundamentals):
  - Azure AI Document Intelligence (prebuilt-invoice + prebuilt-read fallback)
  - Azure AI Language (PII Recognition, Named Entity Recognition, Summarization)
  - Azure OpenAI / Azure AI Foundry (Grounded Audit Q&A)
"""

import os
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
    version="1.0.0",
    description="Azure AI-900 aligned document extraction, PII redaction, and grounded Audit Q&A.",
)

# Configure CORS for Next.js / React frontend on localhost:3000
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(allowed_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    document_context: str
    question: str
    chat_history: List[ChatTurn] = []
    demo_mode: Optional[bool] = None


def _is_azure_configured() -> bool:
    return bool(
        os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
        and os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY")
        and os.getenv("AZURE_LANGUAGE_ENDPOINT")
        and os.getenv("AZURE_LANGUAGE_KEY")
    )


def _build_demo_payload(file_name: str, sample_id: Optional[str] = None) -> Dict[str, Any]:
    """Returns realistic offline Azure AI-900 mock analysis responses."""
    raw_text = (
        "NORTHWIND CLOUD INFRASTRUCTURE LLC\n"
        "1420 Harborview Blvd, Suite 900, Seattle, WA 98101\n"
        "Tax ID / EIN: 91-4820194 | Billing Support: billing@northwindcloud.io | Tel: +1 (206) 555-0194\n\n"
        "COMMERCIAL INVOICE — Invoice Number: INV-2026-8841\n"
        "Invoice Date: 2026-10-15 | Payment Terms: Net 30 (Due 2026-11-14) | PO: PO-440219\n\n"
        "BILL TO: Apex Meridian Financial Corp — Attn: Elena Rostova, VP Finance\n"
        "775 Market Street, Floor 14, San Francisco, CA 94103\n"
        "Email: e.rostova@apexmeridian.com | Direct: +1 (415) 555-0148\n\n"
        "LINE ITEMS:\n"
        "1. Azure Kubernetes Managed Cluster (Prod-US-West) — Qty 3 x $2,400.00 = $7,200.00\n"
        "2. Enterprise AI Document Processing Tier (250k pages) — Qty 1 x $3,850.00 = $3,850.00\n"
        "3. Dedicated Private Link & HSM Compliance Vault — Qty 2 x $975.00 = $1,950.00\n\n"
        "Subtotal: $13,000.00\n"
        "State & Local Sales Tax (Stated Rate 8.25%): $1,215.00\n"
        "Total Amount Due: $14,215.00\n\n"
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

    redacted_text = raw_text
    for ent in sorted(pii_entities, key=lambda x: len(x["text"]), reverse=True):
        redacted_text = redacted_text.replace(ent["text"], ent["redactedValue"])

    return {
        "document_type": "invoice",
        "model_used": "prebuilt-invoice",
        "processing_mode": "demo",
        "file_name": file_name or "Northwind_Cloud_Invoice_INV-2026-8841.pdf",
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "average_confidence": 0.966,
        "currency": "USD",
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
            "lineItemsSum": 13000.0,
            "reportedSubtotal": 13000.0,
            "reportedTax": 1215.0,
            "reportedTotal": 14215.0,
            "calculatedTotal": 14072.5,
            "expectedTaxRate": "8.25%",
            "effectiveTaxRate": "9.35%",
            "discrepancyAmount": 142.5,
            "hasDiscrepancy": True,
            "summary": "Tax discrepancy detected: 8.25% on $13,000.00 is $1,072.50, but $1,215.00 was billed (+$142.50 overcharge).",
        },
        "raw_text": raw_text,
        "redacted_text": redacted_text,
        "pii_entities": pii_entities,
        "named_entities": [
            {"text": "Northwind Cloud Infrastructure LLC", "category": "Organization", "confidence": 0.99},
            {"text": "Apex Meridian Financial Corp", "category": "Organization", "confidence": 0.99},
            {"text": "2026-10-15", "category": "DateTime", "confidence": 0.99},
            {"text": "Seattle, WA", "category": "Location", "confidence": 0.98},
            {"text": "San Francisco, CA", "category": "Location", "confidence": 0.98},
            {"text": "$14,215.00", "category": "Currency", "confidence": 0.99},
        ],
        "summary": (
            "Commercial cloud invoice (#INV-2026-8841) from Northwind Cloud Infrastructure LLC to Apex Meridian Financial Corp "
            "totaling $14,215.00 under Net 30 terms. Audit flagged a $142.50 tax rate overcharge (9.35% billed vs. 8.25% stated) "
            "and high-risk remittance PII including a US SSN and ACH bank details."
        ),
        "audit_flags": [
            {"severity": "alert", "title": "Tax Rate Overcharge (+$142.50)", "detail": "Stated 8.25% sales tax equals $1,072.50, while invoice charges $1,215.00."},
            {"severity": "alert", "title": "High-Sensitivity PII Redacted", "detail": "Detected US SSN and ACH bank credentials; safe redacted view generated."},
        ],
    }


def _analyze_with_azure(file_bytes: bytes, content_type: str, file_name: str) -> Dict[str, Any]:
    """Calls Azure Document Intelligence (prebuilt-invoice -> prebuilt-read) & Azure AI Language."""
    from azure.ai.documentintelligence import DocumentIntelligenceClient
    from azure.ai.textanalytics import TextAnalyticsClient
    from azure.core.credentials import AzureKeyCredential

    doc_client = DocumentIntelligenceClient(
        endpoint=os.environ["AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT"],
        credential=AzureKeyCredential(os.environ["AZURE_DOCUMENT_INTELLIGENCE_KEY"]),
    )

    model_used = "prebuilt-invoice"
    poller = doc_client.begin_analyze_document(
        model_id="prebuilt-invoice",
        body=file_bytes,
        content_type=content_type,
    )
    result = poller.result()

    # Fallback to prebuilt-read when no structured invoice documents are detected
    if not result.documents:
        model_used = "prebuilt-read"
        poller = doc_client.begin_analyze_document(
            model_id="prebuilt-read",
            body=file_bytes,
            content_type=content_type,
        )
        result = poller.result()

    raw_text = result.content or ""
    extracted_fields: List[Dict[str, Any]] = []
    line_items: List[Dict[str, Any]] = []

    if result.documents:
        doc = result.documents[0]
        fields = doc.fields or {}
        field_map = [
            ("VendorName", "vendor_name", "Vendor Name"),
            ("InvoiceId", "invoice_id", "Invoice ID"),
            ("InvoiceDate", "invoice_date", "Invoice Date"),
            ("DueDate", "due_date", "Due Date"),
            ("CustomerName", "customer_name", "Bill To"),
            ("SubTotal", "subtotal", "Subtotal"),
            ("TotalTax", "tax", "Tax Amount"),
            ("InvoiceTotal", "total_amount", "Total Amount"),
        ]
        for azure_key, key, label in field_map:
            field = fields.get(azure_key)
            if field:
                numeric_val = None
                if field.value_currency:
                    numeric_val = field.value_currency.amount
                extracted_fields.append(
                    {
                        "key": key,
                        "label": label,
                        "value": field.content or str(numeric_val or ""),
                        "confidence": round(float(field.confidence or 0.9), 3),
                        "numericValue": numeric_val,
                    }
                )

        items_field = fields.get("Items")
        if items_field and items_field.value_array:
            for item in items_field.value_array:
                obj = item.value_object or {}
                desc = obj.get("Description")
                qty = obj.get("Quantity")
                unit_price = obj.get("UnitPrice")
                amount = obj.get("Amount")
                line_items.append(
                    {
                        "description": desc.content if desc else "Line Item",
                        "quantity": float(qty.value_number) if qty and qty.value_number else 1.0,
                        "unitPrice": float(unit_price.value_currency.amount) if unit_price and unit_price.value_currency else 0.0,
                        "amount": float(amount.value_currency.amount) if amount and amount.value_currency else 0.0,
                        "confidence": round(float(item.confidence or 0.9), 3),
                    }
                )

    # Azure AI Language: PII Recognition, Named Entities, and Abstractive Summary
    lang_client = TextAnalyticsClient(
        endpoint=os.environ["AZURE_LANGUAGE_ENDPOINT"],
        credential=AzureKeyCredential(os.environ["AZURE_LANGUAGE_KEY"]),
    )

    text_chunk = raw_text[:5000] if raw_text else "Empty document."
    pii_result = lang_client.recognize_pii_entities([text_chunk])[0]
    ner_result = lang_client.recognize_entities([text_chunk])[0]

    pii_entities: List[Dict[str, Any]] = []
    redacted_text = raw_text
    if not pii_result.is_error:
        redacted_text = pii_result.redacted_text
        for ent in pii_result.entities:
            pii_entities.append(
                {
                    "text": ent.text,
                    "category": ent.category,
                    "redactedValue": f"[REDACTED: {ent.category.upper()}]",
                    "confidence": round(float(ent.confidence_score), 3),
                }
            )

    named_entities: List[Dict[str, Any]] = []
    if not ner_result.is_error:
        for ent in ner_result.entities:
            named_entities.append(
                {
                    "text": ent.text,
                    "category": ent.category,
                    "confidence": round(float(ent.confidence_score), 3),
                }
            )

    summary_text = "Document processed via Azure AI Document Intelligence and Azure AI Language."
    try:
        sum_poller = lang_client.begin_abstract_summary([text_chunk], sentence_count=3)
        sum_docs = list(sum_poller.result())
        if sum_docs and not sum_docs[0].is_error and sum_docs[0].summaries:
            summary_text = " ".join(s.text for s in sum_docs[0].summaries)
    except Exception:
        pass

    subtotal = next((f["numericValue"] for f in extracted_fields if f["key"] == "subtotal" and f.get("numericValue") is not None), 0.0)
    tax = next((f["numericValue"] for f in extracted_fields if f["key"] == "tax" and f.get("numericValue") is not None), 0.0)
    total = next((f["numericValue"] for f in extracted_fields if f["key"] == "total_amount" and f.get("numericValue") is not None), 0.0)
    line_sum = round(sum(i["amount"] for i in line_items), 2)
    calc_total = round((subtotal or line_sum) + tax, 2)
    diff = round(total - calc_total, 2)

    return {
        "document_type": "invoice" if model_used == "prebuilt-invoice" else "document",
        "model_used": model_used,
        "processing_mode": "live-ai",
        "file_name": file_name,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "average_confidence": round(
            sum(f["confidence"] for f in extracted_fields) / max(len(extracted_fields), 1), 3
        ),
        "currency": "USD",
        "extracted_fields": extracted_fields,
        "line_items": line_items,
        "reconciliation": {
            "lineItemsSum": line_sum,
            "reportedSubtotal": subtotal,
            "reportedTax": tax,
            "reportedTotal": total,
            "calculatedTotal": calc_total,
            "discrepancyAmount": diff,
            "hasDiscrepancy": abs(diff) > 0.02,
            "summary": "Arithmetic verified cleanly." if abs(diff) <= 0.02 else f"Variance of {diff:.2f} detected between Subtotal+Tax and Total.",
        },
        "raw_text": raw_text,
        "redacted_text": redacted_text,
        "pii_entities": pii_entities,
        "named_entities": named_entities,
        "summary": summary_text,
        "audit_flags": [],
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "default_demo_mode": DEMO_MODE_DEFAULT,
        "azure_configured": _is_azure_configured(),
    }


@app.post("/api/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    demo_mode: Optional[str] = Form(default=None),
    sample_id: Optional[str] = Form(default=None),
):
    allowed = {"application/pdf", "image/png", "image/jpeg", "image/jpg"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    use_demo = (
        demo_mode.lower() == "true"
        if demo_mode is not None
        else (DEMO_MODE_DEFAULT or not _is_azure_configured())
    )

    if use_demo:
        return _build_demo_payload(file.filename or "uploaded_document.pdf", sample_id)

    file_bytes = await file.read()
    try:
        return _analyze_with_azure(file_bytes, file.content_type or "application/pdf", file.filename or "document")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Azure AI analysis failed: {str(exc)}")


@app.post("/api/chat")
async def audit_chat(payload: ChatRequest):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    use_demo = (
        payload.demo_mode
        if payload.demo_mode is not None
        else (DEMO_MODE_DEFAULT or not bool(os.getenv("AZURE_OPENAI_API_KEY")))
    )

    if use_demo:
        if "tax" in payload.question.lower() or "discrepanc" in payload.question.lower():
            return {
                "answer": (
                    "Based strictly on the document context: Subtotal is $13,000.00 and stated tax rate is 8.25% "
                    "($1,072.50 expected), whereas $1,215.00 was billed (9.35% effective) — a +$142.50 overcharge."
                ),
                "mode": "demo",
                "grounded": True,
            }
        return {
            "answer": (
                "Grounded Demo Mode response: I analyzed the extracted document context. "
                "Ask about tax discrepancies, Net 30 payment terms, line items, or PII findings."
            ),
            "mode": "demo",
            "grounded": True,
        }

    from openai import AzureOpenAI

    client = AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21"),
    )

    system_prompt = (
        "You are OmniDoc Audit Copilot. Answer ONLY using facts explicitly present in the provided "
        "DOCUMENT CONTEXT and exact arithmetic derived from it. If the answer is not in the document, "
        "reply: 'That information is not present in the uploaded document.'\n\n"
        f"DOCUMENT CONTEXT:\n{payload.document_context[:24000]}"
    )

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for turn in payload.chat_history[-8:]:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": payload.question})

    completion = client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o"),
        messages=messages,
        temperature=0.1,
    )

    return {
        "answer": completion.choices[0].message.content or "",
        "mode": "azure-live",
        "grounded": True,
    }
