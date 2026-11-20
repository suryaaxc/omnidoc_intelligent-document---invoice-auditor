export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  numericValue?: number | null;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  confidence: number;
}

export type EntityCategory =
  | 'Organization'
  | 'DateTime'
  | 'Location'
  | 'Currency'
  | 'Person'
  | 'Identifier';

export interface NamedEntity {
  text: string;
  category: EntityCategory;
  confidence: number;
}

export interface PiiEntity {
  text: string;
  category: string;
  redactedValue: string;
  confidence: number;
}

export interface ReconciliationCheck {
  lineItemsSum: number;
  reportedSubtotal: number;
  reportedTax: number;
  reportedTotal: number;
  calculatedTotal: number;
  expectedTaxRate?: string;
  effectiveTaxRate?: string;
  discrepancyAmount: number;
  hasDiscrepancy: boolean;
  summary: string;
}

export interface AuditFlag {
  severity: 'verified' | 'warning' | 'alert';
  title: string;
  detail: string;
}

export interface AnalysisResult {
  document_type: 'invoice' | 'receipt' | 'document';
  model_used: 'prebuilt-invoice' | 'prebuilt-read';
  processing_mode: 'demo' | 'live-ai';
  file_name: string;
  analyzed_at: string;
  average_confidence: number;
  currency: string;
  extracted_fields: ExtractedField[];
  line_items: LineItem[];
  reconciliation: ReconciliationCheck;
  raw_text: string;
  redacted_text: string;
  pii_entities: PiiEntity[];
  named_entities: NamedEntity[];
  summary: string;
  audit_flags: AuditFlag[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  grounded?: boolean;
}

export interface SampleDocumentMeta {
  id: string;
  title: string;
  fileName: string;
  category: 'Invoice' | 'Freight Receipt' | 'Vendor Contract';
  subtitle: string;
  highlights: string;
}
