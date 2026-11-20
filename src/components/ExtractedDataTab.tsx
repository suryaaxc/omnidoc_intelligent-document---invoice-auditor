import React, { useMemo, useState } from 'react';
import { Check, Copy, Search, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { AnalysisResult } from '../types/audit';

interface ExtractedDataTabProps {
  analysis: AnalysisResult;
}

function formatMoney(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function getConfidenceMeta(score: number): { label: string; colorClass: string } {
  const pct = Math.round(score * 100);
  if (pct >= 92) return { label: `${pct}% High`, colorClass: 'text-emerald-400' };
  if (pct >= 80) return { label: `${pct}% Review`, colorClass: 'text-amber-400' };
  return { label: `${pct}% Low`, colorClass: 'text-rose-400' };
}

export function ExtractedDataTab({ analysis }: ExtractedDataTabProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [itemFilter, setItemFilter] = useState('');

  const filteredItems = useMemo(() => {
    const q = itemFilter.trim().toLowerCase();
    if (!q) return analysis.line_items;
    return analysis.line_items.filter((item) => item.description.toLowerCase().includes(q));
  }, [analysis.line_items, itemFilter]);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const { reconciliation } = analysis;

  return (
    <div className="space-y-8 p-6">
      {/* Pipeline Metadata Row (Zero-Pill Clean Typography) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-slate-200">{analysis.model_used}</span>
          <span aria-hidden="true">·</span>
          <span className="capitalize">{analysis.document_type}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-emerald-400">
            {(analysis.average_confidence * 100).toFixed(1)}% avg confidence
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {analysis.extracted_fields.length} fields · {analysis.line_items.length} line items
        </span>
      </div>

      {/* Automated Reconciliation Check */}
      <section aria-label="Arithmetic and tax reconciliation">
        <div
          className={`flex items-start gap-3.5 rounded-lg border px-4 py-3.5 ${
            reconciliation.hasDiscrepancy
              ? 'border-rose-500/35 bg-rose-950/20'
              : 'border-emerald-500/30 bg-emerald-950/15'
          }`}
        >
          {reconciliation.hasDiscrepancy ? (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3
                className={`text-sm font-semibold ${
                  reconciliation.hasDiscrepancy ? 'text-rose-200' : 'text-emerald-200'
                }`}
              >
                {reconciliation.hasDiscrepancy
                  ? 'Discrepancy Flagged in Tax / Total Reconciliation'
                  : 'Arithmetic & Tax Reconciliation Verified'}
              </h3>
              {reconciliation.hasDiscrepancy && reconciliation.discrepancyAmount !== 0 && (
                <span className="font-mono text-xs font-semibold text-rose-300 tabular-nums">
                  Variance: {reconciliation.discrepancyAmount > 0 ? '+' : ''}
                  {formatMoney(reconciliation.discrepancyAmount, analysis.currency)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              {reconciliation.summary}
            </p>
            {(reconciliation.expectedTaxRate || reconciliation.effectiveTaxRate) && (
              <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-400 tabular-nums">
                {reconciliation.expectedTaxRate && (
                  <span>Stated Tax Rate: {reconciliation.expectedTaxRate}</span>
                )}
                {reconciliation.effectiveTaxRate && (
                  <span>Effective Billed Rate: {reconciliation.effectiveTaxRate}</span>
                )}
                <span>Expected Total: {formatMoney(reconciliation.calculatedTotal, analysis.currency)}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Structured Key-Value Extraction Grid */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Extracted Key-Value Fields</h3>
          <span className="text-xs text-slate-500">Click any value to copy</span>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-800/70 rounded-lg border border-slate-800/90 bg-[#121826] sm:grid-cols-2 sm:divide-y-0">
          {analysis.extracted_fields.map((field, index) => {
            const conf = getConfidenceMeta(field.confidence);
            const isNumeric =
              field.key === 'subtotal' ||
              field.key === 'tax' ||
              field.key === 'total_amount' ||
              field.key === 'invoice_id' ||
              field.key === 'invoice_date' ||
              field.key === 'due_date';

            return (
              <div
                key={`${field.key}-${index}`}
                className="group flex flex-col justify-between border-b border-slate-800/70 p-4 last:border-b-0 sm:odd:border-r"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">{field.label}</span>
                  <span className={`font-mono text-[11px] tabular-nums ${conf.colorClass}`}>
                    {conf.label}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span
                    className={`truncate text-sm font-medium text-slate-100 ${
                      isNumeric ? 'font-mono tabular-nums' : ''
                    }`}
                    title={field.value}
                  >
                    {field.value || '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(field.key, field.value)}
                    aria-label={`Copy ${field.label}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 opacity-70 transition-colors hover:bg-slate-800 hover:text-slate-200 group-hover:opacity-100 cursor-pointer"
                  >
                    {copiedKey === field.key ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Audit Flags */}
      {analysis.audit_flags.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-100">Automated Audit Observations</h3>
          <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800/90 bg-[#121826]">
            {analysis.audit_flags.map((flag, idx) => (
              <div key={idx} className="flex items-start gap-3 px-4 py-3">
                {flag.severity === 'alert' ? (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                ) : flag.severity === 'warning' ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200">{flag.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{flag.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Line Items High-Density Data Grid */}
      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Extracted Line Items</h3>
          {analysis.line_items.length > 0 && (
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={itemFilter}
                onChange={(e) => setItemFilter(e.target.value)}
                placeholder="Filter line items…"
                aria-label="Filter line items"
                className="w-full rounded-md border border-slate-800 bg-[#121826] py-1.5 pr-3 pl-8 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {analysis.line_items.length === 0 ? (
          <div className="rounded-lg border border-slate-800/80 bg-[#121826] px-4 py-6 text-center">
            <p className="text-xs font-medium text-slate-300">
              No tabular invoice line items found
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Processed with <span className="font-mono text-slate-400">{analysis.model_used}</span>. Full extracted text and entities are available in the Privacy & NLP Audit tab.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800/90 bg-[#121826]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Unit Price</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 text-right font-medium">Conf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredItems.map((item, idx) => {
                  const conf = getConfidenceMeta(item.confidence);
                  return (
                    <tr key={idx} className="transition-colors hover:bg-slate-800/35">
                      <td className="max-w-[260px] px-4 py-3 text-slate-200">{item.description}</td>
                      <td className="px-3 py-3 text-right font-mono text-slate-300 tabular-nums">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-300 tabular-nums">
                        {formatMoney(item.unitPrice, analysis.currency)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-medium text-slate-100 tabular-nums">
                        {formatMoney(item.amount, analysis.currency)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono tabular-nums ${conf.colorClass}`}>
                        {Math.round(item.confidence * 100)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700/80 bg-[#0E1420]">
                  <td colSpan={3} className="px-4 py-2.5 text-right font-medium text-slate-400">
                    Computed Line Items Subtotal
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-100 tabular-nums">
                    {formatMoney(reconciliation.lineItemsSum, analysis.currency)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
