import type { SampleDocumentMeta } from '../types/audit';

export const SAMPLE_DOCUMENTS: SampleDocumentMeta[] = [
  {
    id: 'northwind-invoice',
    title: 'Northwind Cloud Invoice #INV-2026-8841',
    fileName: 'Northwind_Cloud_Invoice_INV-2026-8841.png',
    category: 'Invoice',
    subtitle: 'Contains a $142.50 tax overcharge discrepancy and exposed SSN / ACH routing PII.',
    highlights: 'prebuilt-invoice · Tax audit flag · 11 PII entities',
  },
  {
    id: 'contoso-receipt',
    title: 'Contoso Logistics Freight Receipt #FRT-90412',
    fileName: 'Contoso_Logistics_Receipt_FRT-90412.png',
    category: 'Freight Receipt',
    subtitle: 'Balanced cold-chain air cargo & customs clearance receipt paid via corporate card.',
    highlights: 'prebuilt-invoice · Verified totals · 8 PII entities',
  },
  {
    id: 'fabrikam-msa',
    title: 'Fabrikam Security Advisory MSA (SOW-2026-09)',
    fileName: 'Fabrikam_Vendor_MSA_SOW-2026-09.png',
    category: 'Vendor Contract',
    subtitle: 'Non-invoice Master Services Agreement demonstrating automatic prebuilt-read fallback.',
    highlights: 'prebuilt-read fallback · Commercial terms · 9 PII entities',
  },
];

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = '#CBD5E1',
  width = 1
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.trim()) {
    ctx.fillText(line.trim(), x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

/**
 * Generates an authentic, print-sharp 1240x1600 PNG File for any built-in sample document
 * so the left-pane document viewer and live multimodal AI analysis operate on real pixels.
 */
export async function generateSampleDocumentFile(sampleId: string): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // Crisp paper background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top subtle enterprise header bar
  const accent =
    sampleId === 'contoso-receipt'
      ? '#0F766E'
      : sampleId === 'fabrikam-msa'
        ? '#334155'
        : '#1E3A8A';

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, canvas.width, 14);

  const margin = 84;
  const rightEdge = canvas.width - margin;

  if (sampleId === 'contoso-receipt') {
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 32px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('CONTOSO GLOBAL LOGISTICS & FREIGHT INC.', margin, 96);

    ctx.fillStyle = '#475569';
    ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
    ctx.fillText('8800 Cargo Terminal Way, Building C, Chicago, IL 60666', margin, 128);
    ctx.fillText('Customs Broker License: CB-77310  |  customs@contosologistics.com  |  +1 (312) 555-0172', margin, 156);

    ctx.fillStyle = accent;
    ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('AIR FREIGHT & CUSTOMS CLEARANCE RECEIPT', margin, 224);

    drawLine(ctx, margin, 244, rightEdge, 244, '#CBD5E1', 2);

    // Metadata block
    ctx.fillStyle = '#64748B';
    ctx.font = '600 15px "DM Sans", system-ui, sans-serif';
    ctx.fillText('CONSIGNEE', margin, 290);
    ctx.fillText('RECEIPT DETAILS', 740, 290);

    ctx.fillStyle = '#0F172A';
    ctx.font = '600 20px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Helios Precision Medical Devices', margin, 322);
    ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('405 Innovation Parkway, Austin, TX 78758', margin, 352);
    ctx.fillText('Receiving Officer: Dr. Priya Nair', margin, 380);
    ctx.fillText('Email: p.nair@heliosmed.org  |  Tel: +1 (512) 555-0183', margin, 408);

    ctx.fillStyle = '#0F172A';
    ctx.font = '500 18px "JetBrains Mono", monospace';
    ctx.fillText('Receipt ID:   FRT-90412', 740, 322);
    ctx.fillText('Issue Date:   2026-10-28', 740, 354);
    ctx.fillText('Status:       PAID (Card 4821)', 740, 386);
    ctx.fillText('Route:        FRA -> ORD (420 kg)', 740, 418);

    // Table header
    const tableY = 486;
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(margin, tableY, rightEdge - margin, 48);
    ctx.fillStyle = '#334155';
    ctx.font = '600 16px "DM Sans", system-ui, sans-serif';
    ctx.fillText('DESCRIPTION', margin + 16, tableY + 30);
    ctx.fillText('QTY', 740, tableY + 30);
    ctx.fillText('UNIT PRICE', 845, tableY + 30);
    ctx.fillText('AMOUNT', 1030, tableY + 30);

    const rows = [
      ['Priority Cold-Chain Air Cargo (FRA -> ORD, 420 kg)', '1', '$3,420.00', '$3,420.00'],
      ['US Customs Entry & FDA Medical Clearance Filing', '1', '$485.00', '$485.00'],
      ['Armored Last-Mile Climate Van Delivery', '2', '$310.00', '$620.00'],
    ];

    let y = tableY + 84;
    for (const row of rows) {
      ctx.fillStyle = '#0F172A';
      ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
      ctx.fillText(row[0], margin + 16, y);
      ctx.font = '400 18px "JetBrains Mono", monospace';
      ctx.fillText(row[1], 752, y);
      ctx.fillText(row[2], 845, y);
      ctx.fillText(row[3], 1030, y);
      drawLine(ctx, margin, y + 22, rightEdge, y + 22, '#E2E8F0', 1);
      y += 66;
    }

    // Totals
    y += 30;
    ctx.font = '500 19px "DM Sans", system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('Subtotal', 740, y);
    ctx.font = '500 19px "JetBrains Mono", monospace';
    ctx.fillStyle = '#0F172A';
    ctx.fillText('$4,525.00', 1020, y);

    y += 42;
    ctx.font = '500 19px "DM Sans", system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('Federal Aviation & Handling Tax (6.00%)', 600, y);
    ctx.font = '500 19px "JetBrains Mono", monospace';
    ctx.fillStyle = '#0F172A';
    ctx.fillText('$271.50', 1044, y);

    drawLine(ctx, 600, y + 20, rightEdge, y + 20, '#0F172A', 2);
    y += 58;
    ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.fillText('TOTAL PAID', 740, y);
    ctx.font = '700 24px "JetBrains Mono", monospace';
    ctx.fillStyle = accent;
    ctx.fillText('$4,796.50', 1005, y);

    // Verification footer
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(margin, 1140, rightEdge - margin, 140);
    ctx.strokeStyle = '#E2E8F0';
    ctx.strokeRect(margin, 1140, rightEdge - margin, 140);
    ctx.fillStyle = '#0F172A';
    ctx.font = '600 17px "DM Sans", system-ui, sans-serif';
    ctx.fillText('TERMINAL VERIFICATION RECORD', margin + 24, 1180);
    ctx.fillStyle = '#475569';
    ctx.font = '400 17px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Verified by Terminal Inspector David Chen on 2026-10-28 at 14:22 CST.', margin + 24, 1216);
    ctx.fillText('Cold-chain temperature log maintained within 2°C – 8°C across all transit legs.', margin + 24, 1248);
  } else if (sampleId === 'fabrikam-msa') {
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 30px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('FABRIKAM CYBERSECURITY ADVISORY PARTNERS LLP', margin, 96);
    ctx.fillStyle = '#475569';
    ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
    ctx.fillText('220 Bishopsgate, Floor 22, London EC2N 4BQ, United Kingdom', margin, 128);
    ctx.fillText('General Counsel: legal@fabrikamadvisory.co.uk  |  Tel: +44 20 7946 0821', margin, 156);

    drawLine(ctx, margin, 188, rightEdge, 188, '#CBD5E1', 2);

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('MASTER SERVICES AGREEMENT — STATEMENT OF WORK (SOW-2026-09)', margin, 242);

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(margin, 274, rightEdge - margin, 174);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(margin, 274, rightEdge - margin, 174);

    ctx.fillStyle = '#0F172A';
    ctx.font = '600 18px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Client Organization: Sovereign Bancorp Holdings', margin + 24, 314);
    ctx.font = '400 17px "DM Sans", system-ui, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Client Headquarters: 399 Park Avenue, New York, NY 10022', margin + 24, 346);
    ctx.fillText('Client Representative: Thomas Lindqvist (t.lindqvist@sovereignbancorp.com | +1 (212) 555-0136)', margin + 24, 378);
    ctx.font = '500 17px "JetBrains Mono", monospace';
    ctx.fillText('Effective Date: 2026-11-01   |   Expiration Date: 2027-10-31   |   Annual Cap: $185,000.00', margin + 24, 418);

    let y = 510;
    const sections = [
      [
        '1. Scope of Advisory Services',
        'Fabrikam Cybersecurity Advisory Partners LLP shall perform quarterly zero-trust penetration assessments, SOC 2 Type II readiness audits, and Responsible AI governance reviews for Sovereign Bancorp Holdings across cloud production workloads.',
      ],
      [
        '2. Commercial Fee Structure & Retainer Cap',
        'Total annual retainer fees shall not exceed $185,000.00 USD, invoiced quarterly in advance at $46,250.00 per quarter. Applicable regional taxes are excluded and evaluated upon invoicing.',
      ],
      [
        '3. Termination & Liability Limitations',
        'Either party may terminate this Statement of Work for convenience upon sixty (60) calendar days prior written notice. Aggregate liability of either party shall not exceed twelve (12) months of fees paid under SOW-2026-09.',
      ],
      [
        '4. Data Privacy & Responsible AI Safeguards',
        'All client Personally Identifiable Information (PII) and confidential financial records must remain encrypted at rest using AES-256 and automatically redacted prior to any external AI model inference or audit indexing.',
      ],
    ];

    for (const [heading, body] of sections) {
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 20px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(heading, margin, y);
      y += 32;
      ctx.fillStyle = '#334155';
      ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
      y = drawWrappedText(ctx, body, margin, y, rightEdge - margin, 29);
      y += 32;
    }

    drawLine(ctx, margin, 1180, rightEdge, 1180, '#CBD5E1', 1);
    ctx.fillStyle = '#0F172A';
    ctx.font = '600 18px "DM Sans", system-ui, sans-serif';
    ctx.fillText('AUTHORIZED SIGNATORY — FABRIKAM ADVISORY', margin, 1230);
    ctx.fillStyle = '#334155';
    ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Claire Beaumont, Managing Partner', margin, 1266);
    ctx.font = '500 17px "JetBrains Mono", monospace';
    ctx.fillText('Personal Signatory ID Ref: UK-994012-CB   |   Date Signed: 2026-10-29', margin, 1300);
  } else {
    // Primary Sample: Northwind Cloud Infrastructure Invoice #INV-2026-8841
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 32px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('NORTHWIND CLOUD INFRASTRUCTURE LLC', margin, 96);

    ctx.fillStyle = '#475569';
    ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
    ctx.fillText('1420 Harborview Blvd, Suite 900, Seattle, WA 98101', margin, 128);
    ctx.fillText('Tax ID / EIN: 91-4820194  |  billing@northwindcloud.io  |  +1 (206) 555-0194', margin, 156);

    ctx.fillStyle = accent;
    ctx.font = '700 28px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('COMMERCIAL INVOICE', rightEdge - 310, 96);

    drawLine(ctx, margin, 192, rightEdge, 192, '#CBD5E1', 2);

    // Bill To & Invoice Meta
    ctx.fillStyle = '#64748B';
    ctx.font = '600 15px "DM Sans", system-ui, sans-serif';
    ctx.fillText('BILL TO', margin, 238);
    ctx.fillText('INVOICE SUMMARY', 740, 238);

    ctx.fillStyle = '#0F172A';
    ctx.font = '600 20px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Apex Meridian Financial Corp', margin, 272);
    ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Attn: Elena Rostova, VP Finance', margin, 302);
    ctx.fillText('775 Market Street, Floor 14, San Francisco, CA 94103', margin, 330);
    ctx.fillText('Email: e.rostova@apexmeridian.com', margin, 358);
    ctx.fillText('Direct: +1 (415) 555-0148', margin, 386);

    ctx.fillStyle = '#0F172A';
    ctx.font = '500 18px "JetBrains Mono", monospace';
    ctx.fillText('Invoice No:   INV-2026-8841', 740, 272);
    ctx.fillText('Invoice Date: 2026-10-15', 740, 304);
    ctx.fillText('Due Date:     2026-11-14 (Net 30)', 740, 336);
    ctx.fillText('PO Number:    PO-440219', 740, 368);

    // Line items table
    const tableY = 456;
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(margin, tableY, rightEdge - margin, 48);
    ctx.fillStyle = '#334155';
    ctx.font = '600 16px "DM Sans", system-ui, sans-serif';
    ctx.fillText('SERVICE DESCRIPTION', margin + 16, tableY + 30);
    ctx.fillText('QTY', 740, tableY + 30);
    ctx.fillText('UNIT PRICE', 840, tableY + 30);
    ctx.fillText('AMOUNT', 1025, tableY + 30);

    const rows = [
      ['Azure Kubernetes Managed Cluster (Prod-US-West)', '3', '$2,400.00', '$7,200.00'],
      ['Enterprise AI Document Processing Tier (250k pages)', '1', '$3,850.00', '$3,850.00'],
      ['Dedicated Private Link & HSM Compliance Vault', '2', '$975.00', '$1,950.00'],
    ];

    let y = tableY + 86;
    for (const row of rows) {
      ctx.fillStyle = '#0F172A';
      ctx.font = '400 18px "DM Sans", system-ui, sans-serif';
      ctx.fillText(row[0], margin + 16, y);
      ctx.font = '400 18px "JetBrains Mono", monospace';
      ctx.fillText(row[1], 752, y);
      ctx.fillText(row[2], 840, y);
      ctx.fillText(row[3], 1025, y);
      drawLine(ctx, margin, y + 24, rightEdge, y + 24, '#E2E8F0', 1);
      y += 72;
    }

    // Totals block (includes intentional 8.25% stated vs $1,215.00 billed discrepancy)
    y += 32;
    ctx.font = '500 19px "DM Sans", system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('Subtotal', 740, y);
    ctx.font = '500 19px "JetBrains Mono", monospace';
    ctx.fillStyle = '#0F172A';
    ctx.fillText('$13,000.00', 1015, y);

    y += 42;
    ctx.font = '500 19px "DM Sans", system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('State & Local Sales Tax (8.25%)', 655, y);
    ctx.font = '500 19px "JetBrains Mono", monospace';
    ctx.fillStyle = '#0F172A';
    ctx.fillText('$1,215.00', 1027, y);

    drawLine(ctx, 655, y + 22, rightEdge, y + 22, '#0F172A', 2);
    y += 60;
    ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.fillText('TOTAL AMOUNT DUE', 690, y);
    ctx.font = '700 24px "JetBrains Mono", monospace';
    ctx.fillStyle = accent;
    ctx.fillText('$14,215.00', 998, y);

    // Remittance & Compliance box with sensitive PII
    const boxY = 1090;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(margin, boxY, rightEdge - margin, 224);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(margin, boxY, rightEdge - margin, 224);

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 17px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('REMITTANCE & W-9 COMPLIANCE INSTRUCTIONS', margin + 24, boxY + 40);

    ctx.fillStyle = '#334155';
    ctx.font = '400 17px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Wire / ACH Institution: First Pacific Commercial Bank', margin + 24, boxY + 78);
    ctx.font = '500 17px "JetBrains Mono", monospace';
    ctx.fillText('ABA Routing Number: 121000358   |   Account Number: 8840-2910-4419', margin + 24, boxY + 112);
    ctx.font = '400 17px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Compliance Officer: Marcus Vance  |  SSN on W-9 Ref: 418-62-9031', margin + 24, boxY + 148);
    ctx.fillStyle = '#64748B';
    ctx.font = '400 16px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Payment due within 30 days (Net 30). A late fee of 1.5% per month applies after 30 days past due.', margin + 24, boxY + 188);
  }

  const meta = SAMPLE_DOCUMENTS.find((d) => d.id === sampleId) || SAMPLE_DOCUMENTS[0];

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to render sample document image'));
    }, 'image/png');
  });

  return new File([blob], meta.fileName, { type: 'image/png' });
}
