import React, { useMemo, useState } from 'react';
import { Check, Copy, Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { AnalysisResult, EntityCategory } from '../types/audit';

interface PrivacyAuditTabProps {
  analysis: AnalysisResult;
}

function renderHighlightedText(
  text: string,
  mode: 'redacted' | 'original',
  piiValues: string[]
): React.ReactNode[] {
  if (!text) return ['No text extracted from document.'];

  if (mode === 'redacted') {
    const parts = text.split(/(\[REDACTED:[^\]]+\])/g);
    return parts.map((part, idx) => {
      if (part.startsWith('[REDACTED:') && part.endsWith(']')) {
        return (
          <mark
            key={idx}
            className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[11px] font-medium text-rose-300 ring-1 ring-rose-500/35"
          >
            {part}
          </mark>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  }

  // Original mode: highlight exact raw PII substrings in amber so auditors see exposure
  const uniquePii = Array.from(new Set(piiValues.filter((v) => v && v.trim().length >= 2))).sort(
    (a, b) => b.length - a.length
  );
  if (uniquePii.length === 0) return [text];

  const pattern = new RegExp(
    `(${uniquePii.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g'
  );
  const parts = text.split(pattern);
  const piiSet = new Set(uniquePii);

  return parts.map((part, idx) => {
    if (piiSet.has(part)) {
      return (
        <mark
          key={idx}
          className="rounded bg-amber-500/20 px-1 py-0.5 text-amber-200 ring-1 ring-amber-500/40"
        >
          {part}
        </mark>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function PrivacyAuditTab({ analysis }: PrivacyAuditTabProps) {
  const [viewMode, setViewMode] = useState<'redacted' | 'original'>('redacted');
  const [copiedSafe, setCopiedSafe] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'All' | EntityCategory>('All');

  const entityCategories = useMemo(() => {
    const cats = new Set<EntityCategory>();
    analysis.named_entities.forEach((e) => cats.add(e.category));
    return ['All', ...Array.from(cats)] as Array<'All' | EntityCategory>;
  }, [analysis.named_entities]);

  const filteredEntities = useMemo(() => {
    if (selectedCategory === 'All') return analysis.named_entities;
    return analysis.named_entities.filter((e) => e.category === selectedCategory);
  }, [analysis.named_entities, selectedCategory]);

  const handleCopySafeText = () => {
    navigator.clipboard.writeText(analysis.redacted_text);
    setCopiedSafe(true);
    setTimeout(() => setCopiedSafe(false), 1600);
  };

  return (
    <div className="space-y-8 p-6">
      {/* Executive Summary */}
      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-100">Executive Summary</h3>
          <span className="text-xs text-slate-500">Azure AI Language · Abstractive Summary</span>
        </div>
        <div className="rounded-lg border border-slate-800/90 bg-[#121826] p-4">
          <p className="text-sm leading-relaxed text-slate-300">{analysis.summary}</p>
        </div>
      </section>

      {/* Responsible AI PII Redaction Viewer */}
      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Responsible AI PII Redaction Viewer
            </h3>
            <p className="mt-0.5 text-xs text-slate-400 tabular-nums">
              {analysis.pii_entities.length} sensitive entities detected across emails, phones, addresses, and financial IDs
            </p>
          </div>

          {/* Interactive Segmented Toggle: Redacted Safe Text vs Original Text */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Text redaction view mode"
              className="inline-flex items-center rounded-lg border border-slate-800 bg-[#0B0F17] p-0.5"
            >
              <button
                type="button"
                onClick={() => setViewMode('redacted')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  viewMode === 'redacted'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <EyeOff className="h-3.5 w-3.5" />
                Redacted Safe Text
              </button>
              <button
                type="button"
                onClick={() => setViewMode('original')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  viewMode === 'original'
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Original Text
              </button>
            </div>
          </div>
        </div>

        {/* Status Caption Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-lg border border-b-0 border-slate-800/90 bg-[#0F1522] px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            {viewMode === 'redacted' ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-300">
                  Safe for downstream logging, export, or external audit review
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-amber-200">
                  Displaying unredacted original text — sensitive PII spans highlighted in amber
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleCopySafeText}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#141B2B] px-2.5 py-1 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:border-slate-600 hover:bg-slate-800 cursor-pointer"
          >
            {copiedSafe ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Copied Safe Text
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Safe Text
              </>
            )}
          </button>
        </div>

        {/* Document Text Container */}
        <div className="max-h-[300px] overflow-y-auto rounded-b-lg border border-slate-800/90 bg-[#121826] p-4 font-mono text-xs leading-6 whitespace-pre-wrap text-slate-300">
          {renderHighlightedText(
            viewMode === 'redacted' ? analysis.redacted_text : analysis.raw_text,
            viewMode,
            analysis.pii_entities.map((p) => p.text)
          )}
        </div>
      </section>

      {/* PII Detection Ledger */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Detected PII Entities</h3>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {analysis.pii_entities.length} flagged
          </span>
        </div>

        {analysis.pii_entities.length === 0 ? (
          <div className="rounded-lg border border-slate-800/90 bg-[#121826] px-4 py-5 text-xs text-slate-400">
            No personally identifiable information (PII) was detected in this document.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800/90 bg-[#121826]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Redacted Mask</th>
                  <th className="px-4 py-2.5 font-medium">Detected Value</th>
                  <th className="px-4 py-2.5 text-right font-medium">Conf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {analysis.pii_entities.map((entity, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 font-medium text-slate-200 whitespace-nowrap">
                      {entity.category}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-rose-300 whitespace-nowrap">
                      {entity.redactedValue}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 font-mono text-slate-400">
                      {viewMode === 'original' ? entity.text : '••••••••••••'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-400 tabular-nums">
                      {Math.round(entity.confidence * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Named Entity Recognition (NER) */}
      <section>
        <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Named Entities Recognized</h3>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#0B0F17] p-0.5">
            {entityCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-800/70 rounded-lg border border-slate-800/90 bg-[#121826]">
          {filteredEntities.map((ent, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="w-24 shrink-0 text-slate-500">{ent.category}</span>
                <span className="truncate font-medium text-slate-200">{ent.text}</span>
              </div>
              <span className="font-mono text-slate-400 tabular-nums shrink-0">
                {Math.round(ent.confidence * 100)}%
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
