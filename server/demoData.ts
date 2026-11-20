import type {
  AnalysisResult,
  AuditFlag,
  ExtractedField,
  LineItem,
  PiiEntity,
  ReconciliationCheck,
} from '../src/types/audit.ts';

export function buildRedactedText(rawText: string, piiEntities: PiiEntity[]): string {
  if (!rawText || piiEntities.length === 0) return rawText;
  let redacted = rawText;
  // Sort longest text first to avoid partial overlapping replacements
  const sorted = [...piiEntities].sort((a, b) => b.text.length - a.text.length);
  for (const entity of sorted) {
    if (!entity.text || entity.text.trim().length < 2) continue;
    const escaped = entity.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    redacted = redacted.replace(regex, entity.redactedValue);
  }
  return redacted;
}

export function computeReconciliation(
  fields: ExtractedField[],
  lineItems: LineItem[],
  docType: 'invoice' | 'receipt' | 'document'
): ReconciliationCheck {
  if (docType === 'document' && lineItems.length === 0) {
    return {
      lineItemsSum: 0,
      reportedSubtotal: 0,
      reportedTax: 0,
      reportedTotal: 0,
      calculatedTotal: 0,
      discrepancyAmount: 0,
      hasDiscrepancy: false,
      summary: 'General document analyzed via prebuilt-read; no invoice totals require arithmetic reconciliation.',
    };
  }

  const getNum = (key: string): number => {
    const f = fields.find((x) => x.key === key);
    if (!f) return 0;
    if (typeof f.numericValue === 'number' && !Number.isNaN(f.numericValue)) {
      return f.numericValue;
    }
    const parsed = parseFloat(String(f.value).replace(/[^0-9.-]+/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const lineItemsSum = Number(
    lineItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0).toFixed(2)
  );
  const reportedSubtotal = getNum('subtotal') || lineItemsSum;
  const reportedTax = getNum('tax');
  const reportedTotal = getNum('total_amount');
  const calculatedTotal = Number((reportedSubtotal + reportedTax).toFixed(2));
  const subtotalDiff = Math.abs(Number((lineItemsSum - reportedSubtotal).toFixed(2)));
  const totalDiff = Math.abs(Number((reportedTotal - calculatedTotal).toFixed(2)));

  const effectiveRate =
    reportedSubtotal > 0 ? `${((reportedTax / reportedSubtotal) * 100).toFixed(2)}%` : undefined;

  if (subtotalDiff > 0.02 || totalDiff > 0.02) {
    const diff = Number((reportedTotal - calculatedTotal).toFixed(2));
    return {
      lineItemsSum,
      reportedSubtotal,
      reportedTax,
      reportedTotal,
      calculatedTotal,
      effectiveTaxRate: effectiveRate,
      discrepancyAmount: diff !== 0 ? diff : Number((reportedSubtotal - lineItemsSum).toFixed(2)),
      hasDiscrepancy: true,
      summary:
        totalDiff > 0.02
          ? `Reported total (${reportedTotal.toFixed(2)}) differs from Subtotal + Tax (${calculatedTotal.toFixed(2)}) by ${Math.abs(diff).toFixed(2)}.`
          : `Line items sum (${lineItemsSum.toFixed(2)}) differs from reported subtotal (${reportedSubtotal.toFixed(2)}) by ${subtotalDiff.toFixed(2)}.`,
    };
  }

  return {
    lineItemsSum,
    reportedSubtotal,
    reportedTax,
    reportedTotal,
    calculatedTotal,
    effectiveTaxRate: effectiveRate,
    discrepancyAmount: 0,
    hasDiscrepancy: false,
    summary: `All line items (${lineItemsSum.toFixed(2)}) and taxes (${reportedTax.toFixed(2)}) reconcile cleanly with the reported total (${reportedTotal.toFixed(2)}).`,
  };
}

const NORTHWIND_RAW_TEXT = `NORTHWIND CLOUD INFRASTRUCTURE LLC
1420 Harborview Blvd, Suite 900, Seattle, WA 98101
Tax ID / EIN: 91-4820194 | Billing Support: billing@northwindcloud.io | Tel: +1 (206) 555-0194

COMMERCIAL INVOICE
Invoice Number: INV-2026-8841
Invoice Date: 2026-10-15
Payment Terms: Net 30 (Due 2026-11-14)
Purchase Order: PO-440219

BILL TO:
Apex Meridian Financial Corp
Attn: Elena Rostova, VP Finance
775 Market Street, Floor 14, San Francisco, CA 94103
Email: e.rostova@apexmeridian.com | Direct: +1 (415) 555-0148

LINE ITEMS:
1. Azure Kubernetes Managed Cluster (Prod-US-West) — Qty: 3 × $2,400.00 = $7,200.00
2. Enterprise AI Document Processing Tier (250k pages) — Qty: 1 × $3,850.00 = $3,850.00
3. Dedicated Private Link & HSM Compliance Vault — Qty: 2 × $975.00 = $1,950.00

Subtotal: $13,000.00
State & Local Sales Tax (Stated Rate 8.25%): $1,215.00
Total Amount Due: $14,215.00

REMITTANCE INSTRUCTIONS:
ACH Wire Transfer — First Pacific Commercial Bank
Routing Number: 121000358 | Account Number: 8840-2910-4419
Account Holder Compliance Contact: Marcus Vance (SSN on W-9 Ref: 418-62-9031)
Late fee of 1.5% per month applies after 30 days past due.`;

const CONTOSO_RAW_TEXT = `CONTOSO GLOBAL LOGISTICS & FREIGHT INC.
8800 Cargo Terminal Way, Building C, Chicago, IL 60666
Customs Broker License: CB-77310 | Dispatch: customs@contosologistics.com | Phone: +1 (312) 555-0172

AIR FREIGHT & CUSTOMS CLEARANCE RECEIPT
Receipt / Waybill ID: FRT-90412
Issue Date: 2026-10-28
Settlement Status: Paid via Corporate Card (Ending 4821)

CONSIGNEE:
Helios Precision Medical Devices
405 Innovation Parkway, Austin, TX 78758
Receiving Officer: Dr. Priya Nair (p.nair@heliosmed.org | +1 (512) 555-0183)

CHARGES SUMMARY:
1. Priority Cold-Chain Air Cargo (FRA -> ORD, 420 kg) — Qty: 1 × $3,420.00 = $3,420.00
2. US Customs Entry & FDA Medical Clearance Filing — Qty: 1 × $485.00 = $485.00
3. Armored Last-Mile Climate Van Delivery — Qty: 2 × $310.00 = $620.00

Subtotal: $4,525.00
Federal Aviation & Handling Tax (6.00%): $271.50
Total Paid: $4,796.50

Verified by Terminal Inspector David Chen on 2026-10-28 at 14:22 CST.`;

const FABRIKAM_RAW_TEXT = `FABRIKAM CYBERSECURITY ADVISORY PARTNERS LLP
220 Bishopsgate, Floor 22, London EC2N 4BQ, United Kingdom
General Counsel: legal@fabrikamadvisory.co.uk | Tel: +44 20 7946 0821

MASTER SERVICES AGREEMENT — EXECUTIVE AUDIT SUMMARY (SOW-2026-09)
Effective Date: 2026-11-01 | Expiration Date: 2027-10-31
Client Organization: Sovereign Bancorp Holdings
Client Representative: Thomas Lindqvist (t.lindqvist@sovereignbancorp.com | +1 (212) 555-0136)
Client Headquarters: 399 Park Avenue, New York, NY 10022

SCOPE & COMMERCIAL OBLIGATIONS:
Fabrikam Advisory will perform quarterly zero-trust penetration assessments, SOC 2 Type II readiness audits, and Responsible AI governance reviews for Sovereign Bancorp Holdings.
Annual Retainer Cap: $185,000.00 billed quarterly in advance ($46,250.00 per quarter).
Termination Notice: Either party may terminate for convenience with 60 calendar days written notice.
Liability Cap: Aggregate liability shall not exceed 12 months of fees paid under this SOW.
Data Protection: All client PII and financial records must remain encrypted at rest (AES-256) and redacted prior to third-party model inference.

Authorized Signatory: Claire Beaumont, Managing Partner — Personal ID Ref: UK-994012-CB`;

export function getDemoAnalysis(sampleId?: string, fileName?: string): AnalysisResult {
  const lower = (fileName || sampleId || '').toLowerCase();
  const now = new Date().toISOString();

  if (sampleId === 'contoso-receipt' || lower.includes('contoso') || lower.includes('freight') || lower.includes('receipt')) {
    const piiEntities: PiiEntity[] = [
      { text: 'customs@contosologistics.com', category: 'Email', redactedValue: '[REDACTED: EMAIL]', confidence: 0.99 },
      { text: '+1 (312) 555-0172', category: 'PhoneNumber', redactedValue: '[REDACTED: PHONE]', confidence: 0.98 },
      { text: '8800 Cargo Terminal Way, Building C, Chicago, IL 60666', category: 'Address', redactedValue: '[REDACTED: ADDRESS]', confidence: 0.96 },
      { text: 'Dr. Priya Nair', category: 'Person', redactedValue: '[REDACTED: PERSON]', confidence: 0.95 },
      { text: 'p.nair@heliosmed.org', category: 'Email', redactedValue: '[REDACTED: EMAIL]', confidence: 0.99 },
      { text: '+1 (512) 555-0183', category: 'PhoneNumber', redactedValue: '[REDACTED: PHONE]', confidence: 0.98 },
      { text: '405 Innovation Parkway, Austin, TX 78758', category: 'Address', redactedValue: '[REDACTED: ADDRESS]', confidence: 0.97 },
      { text: 'David Chen', category: 'Person', redactedValue: '[REDACTED: PERSON]', confidence: 0.93 },
    ];

    const fields: ExtractedField[] = [
      { key: 'vendor_name', label: 'Vendor Name', value: 'Contoso Global Logistics & Freight Inc.', confidence: 0.99 },
      { key: 'invoice_id', label: 'Receipt / Waybill ID', value: 'FRT-90412', confidence: 0.98 },
      { key: 'invoice_date', label: 'Issue Date', value: '2026-10-28', confidence: 0.99 },
      { key: 'due_date', label: 'Settlement Status', value: 'Paid (Corp Card 4821)', confidence: 0.95 },
      { key: 'customer_name', label: 'Consignee', value: 'Helios Precision Medical Devices', confidence: 0.97 },
      { key: 'subtotal', label: 'Subtotal', value: '$4,525.00', confidence: 0.99, numericValue: 4525 },
      { key: 'tax', label: 'Tax Amount (6.00%)', value: '$271.50', confidence: 0.98, numericValue: 271.5 },
      { key: 'total_amount', label: 'Total Amount', value: '$4,796.50', confidence: 0.99, numericValue: 4796.5 },
    ];

    const lineItems: LineItem[] = [
      { description: 'Priority Cold-Chain Air Cargo (FRA -> ORD, 420 kg)', quantity: 1, unitPrice: 3420, amount: 3420, confidence: 0.98 },
      { description: 'US Customs Entry & FDA Medical Clearance Filing', quantity: 1, unitPrice: 485, amount: 485, confidence: 0.97 },
      { description: 'Armored Last-Mile Climate Van Delivery', quantity: 2, unitPrice: 310, amount: 620, confidence: 0.99 },
    ];

    const reconciliation = computeReconciliation(fields, lineItems, 'receipt');
    const flags: AuditFlag[] = [
      {
        severity: 'verified',
        title: 'Arithmetic & Tax Verified',
        detail: 'Line items ($4,525.00) plus 6.00% handling tax ($271.50) match the total paid ($4,796.50) to the cent.',
      },
      {
        severity: 'warning',
        title: '8 PII Entities Detected & Redacted',
        detail: 'Consignee officer name, direct emails, phone numbers, and facility addresses were masked for safe downstream sharing.',
      },
    ];

    return {
      document_type: 'receipt',
      model_used: 'prebuilt-invoice',
      processing_mode: 'demo',
      file_name: fileName || 'Contoso_Logistics_Receipt_FRT-90412.png',
      analyzed_at: now,
      average_confidence: 0.981,
      currency: 'USD',
      extracted_fields: fields,
      line_items: lineItems,
      reconciliation,
      raw_text: CONTOSO_RAW_TEXT,
      redacted_text: buildRedactedText(CONTOSO_RAW_TEXT, piiEntities),
      pii_entities: piiEntities,
      named_entities: [
        { text: 'Contoso Global Logistics & Freight Inc.', category: 'Organization', confidence: 0.99 },
        { text: 'Helios Precision Medical Devices', category: 'Organization', confidence: 0.98 },
        { text: 'US Customs', category: 'Organization', confidence: 0.94 },
        { text: '2026-10-28', category: 'DateTime', confidence: 0.99 },
        { text: 'Chicago, IL', category: 'Location', confidence: 0.97 },
        { text: 'Austin, TX', category: 'Location', confidence: 0.97 },
        { text: '$4,796.50', category: 'Currency', confidence: 0.99 },
        { text: 'CB-77310', category: 'Identifier', confidence: 0.92 },
      ],
      summary:
        'Settled air freight and customs clearance receipt (#FRT-90412) issued by Contoso Global Logistics to Helios Precision Medical Devices for 420 kg cold-chain cargo from Frankfurt to Chicago. Total settled amount is $4,796.50 including 6.00% federal handling tax, with zero billing discrepancies.',
      audit_flags: flags,
    };
  }

  if (sampleId === 'fabrikam-msa' || lower.includes('fabrikam') || lower.includes('msa') || lower.includes('contract')) {
    const piiEntities: PiiEntity[] = [
      { text: 'legal@fabrikamadvisory.co.uk', category: 'Email', redactedValue: '[REDACTED: EMAIL]', confidence: 0.99 },
      { text: '+44 20 7946 0821', category: 'PhoneNumber', redactedValue: '[REDACTED: PHONE]', confidence: 0.97 },
      { text: '220 Bishopsgate, Floor 22, London EC2N 4BQ, United Kingdom', category: 'Address', redactedValue: '[REDACTED: ADDRESS]', confidence: 0.96 },
      { text: 'Thomas Lindqvist', category: 'Person', redactedValue: '[REDACTED: PERSON]', confidence: 0.96 },
      { text: 't.lindqvist@sovereignbancorp.com', category: 'Email', redactedValue: '[REDACTED: EMAIL]', confidence: 0.99 },
      { text: '+1 (212) 555-0136', category: 'PhoneNumber', redactedValue: '[REDACTED: PHONE]', confidence: 0.98 },
      { text: '399 Park Avenue, New York, NY 10022', category: 'Address', redactedValue: '[REDACTED: ADDRESS]', confidence: 0.97 },
      { text: 'Claire Beaumont', category: 'Person', redactedValue: '[REDACTED: PERSON]', confidence: 0.95 },
      { text: 'UK-994012-CB', category: 'NationalID', redactedValue: '[REDACTED: ID]', confidence: 0.94 },
    ];

    const fields: ExtractedField[] = [
      { key: 'vendor_name', label: 'Counterparty / Vendor', value: 'Fabrikam Cybersecurity Advisory Partners LLP', confidence: 0.98 },
      { key: 'invoice_id', label: 'Document Reference', value: 'SOW-2026-09', confidence: 0.97 },
      { key: 'invoice_date', label: 'Effective Date', value: '2026-11-01', confidence: 0.99 },
      { key: 'due_date', label: 'Expiration Date', value: '2027-10-31', confidence: 0.99 },
      { key: 'customer_name', label: 'Client Organization', value: 'Sovereign Bancorp Holdings', confidence: 0.98 },
      { key: 'subtotal', label: 'Quarterly Billing', value: '$46,250.00', confidence: 0.95, numericValue: 46250 },
      { key: 'tax', label: 'Tax Specification', value: 'Excluded / TBD', confidence: 0.88, numericValue: 0 },
      { key: 'total_amount', label: 'Annual Retainer Cap', value: '$185,000.00', confidence: 0.97, numericValue: 185000 },
    ];

    return {
      document_type: 'document',
      model_used: 'prebuilt-read',
      processing_mode: 'demo',
      file_name: fileName || 'Fabrikam_Vendor_MSA_SOW-2026-09.png',
      analyzed_at: now,
      average_confidence: 0.964,
      currency: 'USD',
      extracted_fields: fields,
      line_items: [],
      reconciliation: {
        lineItemsSum: 0,
        reportedSubtotal: 46250,
        reportedTax: 0,
        reportedTotal: 185000,
        calculatedTotal: 185000,
        discrepancyAmount: 0,
        hasDiscrepancy: false,
        summary: 'Analyzed via prebuilt-read fallback (non-invoice legal SOW). Quarterly cadence ($46,250 × 4) aligns with the $185,000 annual retainer cap.',
      },
      raw_text: FABRIKAM_RAW_TEXT,
      redacted_text: buildRedactedText(FABRIKAM_RAW_TEXT, piiEntities),
      pii_entities: piiEntities,
      named_entities: [
        { text: 'Fabrikam Cybersecurity Advisory Partners LLP', category: 'Organization', confidence: 0.99 },
        { text: 'Sovereign Bancorp Holdings', category: 'Organization', confidence: 0.99 },
        { text: '2026-11-01', category: 'DateTime', confidence: 0.99 },
        { text: '2027-10-31', category: 'DateTime', confidence: 0.99 },
        { text: '60 calendar days', category: 'DateTime', confidence: 0.93 },
        { text: 'London, United Kingdom', category: 'Location', confidence: 0.98 },
        { text: 'New York, NY', category: 'Location', confidence: 0.98 },
        { text: '$185,000.00', category: 'Currency', confidence: 0.99 },
        { text: '$46,250.00', category: 'Currency', confidence: 0.98 },
      ],
      summary:
        'Master Services Agreement SOW-2026-09 between Fabrikam Cybersecurity Advisory Partners and Sovereign Bancorp Holdings covering quarterly penetration testing, SOC 2 Type II readiness, and Responsible AI reviews. Commercial cap is $185,000/year ($46,250/quarter in advance) with 60-day termination notice and a 12-month fee liability cap.',
      audit_flags: [
        {
          severity: 'verified',
          title: 'Automatic prebuilt-read Fallback Triggered',
          detail: 'Document classified as a legal agreement rather than a transactional invoice; key commercial terms extracted cleanly.',
        },
        {
          severity: 'alert',
          title: 'Personal Signatory ID Exposed',
          detail: 'Managing partner personal ID reference (UK-994012-CB) and direct corporate contacts were flagged and redacted.',
        },
      ],
    };
  }

  // Default & Primary Sample: Northwind Cloud Invoice (contains intentional realistic tax discrepancy + rich PII)
  const piiEntities: PiiEntity[] = [
    { text: '1420 Harborview Blvd, Suite 900, Seattle, WA 98101', category: 'Address', redactedValue: '[REDACTED: ADDRESS]', confidence: 0.97 },
    { text: 'billing@northwindcloud.io', category: 'Email', redactedValue: '[REDACTED: EMAIL]', confidence: 0.99 },
    { text: '+1 (206) 555-0194', category: 'PhoneNumber', redactedValue: '[REDACTED: PHONE]', confidence: 0.98 },
    { text: 'Elena Rostova', category: 'Person', redactedValue: '[REDACTED: PERSON]', confidence: 0.96 },
    { text: '775 Market Street, Floor 14, San Francisco, CA 94103', category: 'Address', redactedValue: '[REDACTED: ADDRESS]', confidence: 0.98 },
    { text: 'e.rostova@apexmeridian.com', category: 'Email', redactedValue: '[REDACTED: EMAIL]', confidence: 0.99 },
    { text: '+1 (415) 555-0148', category: 'PhoneNumber', redactedValue: '[REDACTED: PHONE]', confidence: 0.98 },
    { text: '121000358', category: 'ABARoutingNumber', redactedValue: '[REDACTED: ROUTING]', confidence: 0.95 },
    { text: '8840-2910-4419', category: 'BankAccountNumber', redactedValue: '[REDACTED: BANK_ACCT]', confidence: 0.97 },
    { text: 'Marcus Vance', category: 'Person', redactedValue: '[REDACTED: PERSON]', confidence: 0.95 },
    { text: '418-62-9031', category: 'USSocialSecurityNumber', redactedValue: '[REDACTED: SSN]', confidence: 0.99 },
  ];

  const fields: ExtractedField[] = [
    { key: 'vendor_name', label: 'Vendor Name', value: 'Northwind Cloud Infrastructure LLC', confidence: 0.99 },
    { key: 'invoice_id', label: 'Invoice ID', value: 'INV-2026-8841', confidence: 0.99 },
    { key: 'invoice_date', label: 'Invoice Date', value: '2026-10-15', confidence: 0.98 },
    { key: 'due_date', label: 'Due Date (Net 30)', value: '2026-11-14', confidence: 0.97 },
    { key: 'customer_name', label: 'Bill To', value: 'Apex Meridian Financial Corp', confidence: 0.98 },
    { key: 'subtotal', label: 'Subtotal', value: '$13,000.00', confidence: 0.99, numericValue: 13000 },
    { key: 'tax', label: 'Tax Amount (Stated 8.25%)', value: '$1,215.00', confidence: 0.84, numericValue: 1215 },
    { key: 'total_amount', label: 'Total Amount Due', value: '$14,215.00', confidence: 0.99, numericValue: 14215 },
  ];

  const lineItems: LineItem[] = [
    { description: 'Azure Kubernetes Managed Cluster (Prod-US-West)', quantity: 3, unitPrice: 2400, amount: 7200, confidence: 0.99 },
    { description: 'Enterprise AI Document Processing Tier (250k pages)', quantity: 1, unitPrice: 3850, amount: 3850, confidence: 0.98 },
    { description: 'Dedicated Private Link & HSM Compliance Vault', quantity: 2, unitPrice: 975, amount: 1950, confidence: 0.97 },
  ];

  // Expected tax at stated 8.25% on $13,000 = $1,072.50, billed $1,215.00 (+$142.50 overcharge!)
  const reconciliation: ReconciliationCheck = {
    lineItemsSum: 13000,
    reportedSubtotal: 13000,
    reportedTax: 1215,
    reportedTotal: 14215,
    calculatedTotal: 14072.5,
    expectedTaxRate: '8.25%',
    effectiveTaxRate: '9.35%',
    discrepancyAmount: 142.5,
    hasDiscrepancy: true,
    summary:
      'Tax discrepancy detected: Stated sales tax rate is 8.25% ($1,072.50 on $13,000.00 subtotal), but invoice charges $1,215.00 (effective 9.35%) — an overcharge of $142.50.',
  };

  const flags: AuditFlag[] = [
    {
      severity: 'alert',
      title: 'Tax Rate Overcharge (+$142.50)',
      detail: 'Invoice states 8.25% tax ($1,072.50 expected) on $13,000.00 subtotal, yet bills $1,215.00 (9.35% effective rate).',
    },
    {
      severity: 'alert',
      title: 'High-Sensitivity PII Exposed (SSN & Bank Account)',
      detail: 'Detected US SSN (418-62-9031), ACH routing/account numbers, and 8 additional PII entities. Safe redaction applied.',
    },
    {
      severity: 'verified',
      title: 'Line Item Subtotal Reconciled',
      detail: 'All 3 line items sum accurately to $13,000.00 with 98.0% average extraction confidence.',
    },
  ];

  return {
    document_type: 'invoice',
    model_used: 'prebuilt-invoice',
    processing_mode: 'demo',
    file_name: fileName || 'Northwind_Cloud_Invoice_INV-2026-8841.png',
    analyzed_at: now,
    average_confidence: 0.966,
    currency: 'USD',
    extracted_fields: fields,
    line_items: lineItems,
    reconciliation,
    raw_text: NORTHWIND_RAW_TEXT,
    redacted_text: buildRedactedText(NORTHWIND_RAW_TEXT, piiEntities),
    pii_entities: piiEntities,
    named_entities: [
      { text: 'Northwind Cloud Infrastructure LLC', category: 'Organization', confidence: 0.99 },
      { text: 'Apex Meridian Financial Corp', category: 'Organization', confidence: 0.99 },
      { text: 'First Pacific Commercial Bank', category: 'Organization', confidence: 0.96 },
      { text: '2026-10-15', category: 'DateTime', confidence: 0.99 },
      { text: '2026-11-14', category: 'DateTime', confidence: 0.98 },
      { text: 'Net 30', category: 'DateTime', confidence: 0.95 },
      { text: 'Seattle, WA', category: 'Location', confidence: 0.98 },
      { text: 'San Francisco, CA', category: 'Location', confidence: 0.98 },
      { text: '$13,000.00', category: 'Currency', confidence: 0.99 },
      { text: '$1,215.00', category: 'Currency', confidence: 0.97 },
      { text: '$14,215.00', category: 'Currency', confidence: 0.99 },
      { text: 'PO-440219', category: 'Identifier', confidence: 0.96 },
    ],
    summary:
      'Commercial cloud infrastructure invoice (#INV-2026-8841) from Northwind Cloud Infrastructure LLC to Apex Meridian Financial Corp totaling $14,215.00 under Net 30 terms (due 2026-11-14, 1.5%/mo late fee). Audit detected a $142.50 tax calculation discrepancy (9.35% billed vs. 8.25% stated) and high-risk remittance PII including an SSN and ACH bank credentials.',
    audit_flags: flags,
  };
}

export function getDemoChatReply(question: string, documentContext: string): string {
  const q = question.toLowerCase();
  const ctx = documentContext;

  // Grounded checks against the actual provided context
  if (q.includes('tax') || q.includes('discrepanc') || q.includes('math') || q.includes('overcharg') || q.includes('error')) {
    if (ctx.includes('1,215.00') && ctx.includes('8.25%')) {
      return `**Tax Discrepancy Identified in Document Context:**\n\n- **Reported Subtotal:** $13,000.00 (Line items sum: $7,200.00 + $3,850.00 + $1,950.00 = $13,000.00)\n- **Stated Tax Rate:** 8.25% → Expected Tax = **$1,072.50**\n- **Billed Tax Amount:** **$1,215.00** (Effective rate of **9.35%**)\n- **Variance:** **+$142.50 overcharge**\n\n**Audit Recommendation:** Place Invoice INV-2026-8841 on payment hold and request a revised invoice totaling **$14,072.50** before the November 14, 2026 due date.`;
    }
    if (ctx.includes('4,796.50') && ctx.includes('271.50')) {
      return `**No Tax or Arithmetic Discrepancies Found:**\n\n- **Line Items Subtotal:** $3,420.00 + $485.00 + $620.00 = **$4,525.00**\n- **Federal Aviation & Handling Tax (6.00%):** 6.00% × $4,525.00 = **$271.50**\n- **Total Paid:** **$4,796.50**\n\nEvery line item and tax computation reconciles accurately against the receipt context.`;
    }
    if (ctx.includes('SOW-2026-09')) {
      return `This document (SOW-2026-09) is a Master Services Agreement rather than an invoice. No tax line is billed on this document; the annual retainer cap is **$185,000.00**, which reconciles cleanly with 4 quarterly advance payments of **$46,250.00**.`;
    }
  }

  if (q.includes('payment') || q.includes('term') || q.includes('due') || q.includes('late') || q.includes('remit') || q.includes('termination')) {
    if (ctx.includes('INV-2026-8841')) {
      return `**Payment & Remittance Terms (from INV-2026-8841):**\n\n- **Terms:** Net 30 from invoice date (2026-10-15)\n- **Due Date:** 2026-11-14\n- **Late Penalty:** 1.5% per month after 30 days past due\n- **Method:** ACH Wire Transfer via First Pacific Commercial Bank (banking details are masked in Redacted Safe Text).`;
    }
    if (ctx.includes('FRT-90412')) {
      return `**Settlement Terms (from FRT-90412):**\n\n- **Status:** Already settled in full (**$4,796.50**)\n- **Payment Method:** Corporate Card ending in 4821\n- **Issue & Verification Date:** 2026-10-28.`;
    }
    if (ctx.includes('SOW-2026-09')) {
      return `**Commercial & Termination Terms (from SOW-2026-09):**\n\n- **Billing Schedule:** $46,250.00 billed quarterly in advance ($185,000.00 annual cap)\n- **Contract Period:** 2026-11-01 through 2027-10-31\n- **Termination:** 60 calendar days written notice for convenience\n- **Liability Cap:** 12 months of fees paid under the SOW.`;
    }
  }

  if (q.includes('pii') || q.includes('privacy') || q.includes('sensitive') || q.includes('ssn') || q.includes('redact')) {
    if (ctx.includes('INV-2026-8841')) {
      return `**Responsible AI PII Audit Findings:**\n\nThe uploaded invoice exposes **11 sensitive PII entities**, including high-risk financial and identity identifiers:\n- **US SSN** referenced on W-9 note (\`[REDACTED: SSN]\`)\n- **ACH Routing & Bank Account Numbers** (\`[REDACTED: ROUTING]\`, \`[REDACTED: BANK_ACCT]\`)\n- **2 Personal Names, 2 Direct Emails, 2 Phone Numbers, and 2 Street Addresses**.\n\nSwitch to the **Privacy & NLP Audit** tab to copy the fully redacted safe version.`;
    }
    if (ctx.includes('FRT-90412')) {
      return `**Responsible AI PII Audit Findings:**\n\nDetected **8 PII entities** across consignee and broker blocks (2 personal names, 2 emails, 2 phone numbers, and 2 street addresses). No SSN or bank account credentials appear in this receipt.`;
    }
    if (ctx.includes('SOW-2026-09')) {
      return `**Responsible AI PII Audit Findings:**\n\nDetected **9 PII entities**, including a **signatory personal ID reference** (\`[REDACTED: ID]\`), executive emails, direct phone numbers, and office addresses. The contract itself mandates AES-256 encryption and PII redaction prior to external model inference.`;
    }
  }

  if (q.includes('largest') || q.includes('expensive') || q.includes('highest') || q.includes('line item') || q.includes('breakdown')) {
    if (ctx.includes('INV-2026-8841')) {
      return `**Line Item Breakdown (INV-2026-8841):**\n\n1. **Largest item:** Azure Kubernetes Managed Cluster (Prod-US-West) — 3 × $2,400.00 = **$7,200.00** (55.4% of subtotal)\n2. Enterprise AI Document Processing Tier (250k pages) — 1 × $3,850.00 = **$3,850.00**\n3. Dedicated Private Link & HSM Compliance Vault — 2 × $975.00 = **$1,950.00**`;
    }
    if (ctx.includes('FRT-90412')) {
      return `**Charge Breakdown (FRT-90412):**\n\n1. **Largest charge:** Priority Cold-Chain Air Cargo (FRA -> ORD, 420 kg) — **$3,420.00** (75.6% of subtotal)\n2. Armored Last-Mile Climate Van Delivery (Qty 2 × $310.00) — **$620.00**\n3. US Customs Entry & FDA Medical Clearance Filing — **$485.00**`;
    }
  }

  if (q.includes('vendor') || q.includes('who') || q.includes('summar')) {
    const firstLines = ctx
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 6)
      .join('\n- ');
    return `Based strictly on the uploaded document context, here are the key header details:\n\n- ${firstLines}\n\nLet me know if you would like to audit tax calculations, payment terms, line items, or PII exposure.`;
  }

  return `I can only answer questions grounded directly in the uploaded document context. Based on the extracted document, I couldn't locate specific details for "${question.trim()}". Try asking about **tax discrepancies**, **payment terms**, **line-item amounts**, **vendor/client details**, or **detected PII risks**.`;
}
