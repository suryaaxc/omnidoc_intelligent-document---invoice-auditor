import React, { useRef, useState } from 'react';
import { Upload, FileText, ArrowRight, AlertCircle } from 'lucide-react';
import { SAMPLE_DOCUMENTS } from '../lib/sampleInvoices';
import type { SampleDocumentMeta } from '../types/audit';

interface UploadDropzoneProps {
  demoMode: boolean;
  liveAiAvailable: boolean;
  onToggleDemoMode: (next: boolean) => void;
  onFileSelected: (file: File) => void;
  onSampleSelected: (sampleId: string) => void;
  isAnalyzing: boolean;
  error: string | null;
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export function UploadDropzone({
  demoMode,
  liveAiAvailable,
  onToggleDemoMode,
  onFileSelected,
  onSampleSelected,
  isAnalyzing,
  error,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateAndSubmit = (file: File | undefined) => {
    if (!file) return;
    setValidationError(null);

    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const validMime = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ].includes(file.type);

    if (!validMime && !ACCEPTED_EXTENSIONS.includes(ext)) {
      setValidationError('Unsupported format. Upload a PDF, PNG, or JPG invoice or document.');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setValidationError('File exceeds the 15 MB limit. Please compress or split the document.');
      return;
    }

    onFileSelected(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    validateAndSubmit(file);
  };

  const displayError = validationError || error;

  return (
    <div className="mx-auto w-full max-w-[1160px] px-6 py-12 lg:py-16">
      {/* Intro & Mode Bar */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-blue-400">
            Azure AI-900 Audit Pipeline · Document Intelligence · AI Language · Grounded Q&A
          </p>
          <h1
            className="mt-2.5 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl"
            style={{ textWrap: 'balance' }}
          >
            Intelligent Document & Invoice Auditor
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-400">
            Extract structured invoice fields and line items, redact sensitive PII for Responsible AI
            compliance, and interrogate payment terms or tax discrepancies through grounded Q&A.
          </p>
        </div>

        {/* Workspace Analysis Engine Segmented Switch */}
        <div className="shrink-0">
          <div className="mb-1.5 text-xs text-slate-400">Analysis Engine</div>
          <div
            role="group"
            aria-label="Analysis engine mode"
            className="inline-flex items-center rounded-lg border border-slate-800 bg-[#121826] p-1"
          >
            <button
              type="button"
              onClick={() => onToggleDemoMode(false)}
              disabled={isAnalyzing}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                !demoMode
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Live AI Extraction
            </button>
            <button
              type="button"
              onClick={() => onToggleDemoMode(true)}
              disabled={isAnalyzing}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                demoMode
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Offline Demo Mode
            </button>
          </div>
          {!demoMode && !liveAiAvailable && (
            <p className="mt-1.5 text-xs text-amber-400">
              No live key detected — switch to Offline Demo Mode to test immediately.
            </p>
          )}
        </div>
      </div>

      {/* Primary Focal Anchor: Drag & Drop Upload Zone */}
      <div className="mt-8">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isAnalyzing && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isAnalyzing) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label="Upload PDF, PNG, or JPG document for auditing"
          className={`group relative flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            isDragging
              ? 'border-blue-400 bg-blue-950/25'
              : 'border-slate-700/90 bg-[#121826] hover:border-slate-500 hover:bg-[#151C2C]'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={(e) => {
              validateAndSubmit(e.target.files?.[0]);
              e.target.value = '';
            }}
            className="hidden"
          />

          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-700/80 bg-[#0B0F17] text-blue-400 transition-transform duration-150 group-hover:-translate-y-0.5">
            <Upload className="h-5 w-5" />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-slate-100">
            {isAnalyzing ? 'Analyzing document across AI pipeline…' : 'Drop an invoice, receipt, or contract here'}
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-slate-400">
            Supports PDF, PNG, and JPG files up to 15 MB. Automatically routes through{' '}
            <span className="font-mono text-slate-300">prebuilt-invoice</span> with fallback to{' '}
            <span className="font-mono text-slate-300">prebuilt-read</span>.
          </p>

          <div className="mt-6 flex items-center gap-4">
            <span className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white whitespace-nowrap shrink-0 transition-colors group-hover:bg-blue-500">
              Select Document
            </span>
          </div>

          <p className="mt-5 text-xs text-slate-500">
            PDF · PNG · JPG · Max 15 MB · Processed in memory without third-party retention
          </p>
        </div>

        {displayError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{displayError}</span>
          </div>
        )}
      </div>

      {/* Quick-Load Sample Documents */}
      <div className="mt-12 border-t border-slate-800/80 pt-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Audit Sample Documents
            </h2>
            <p className="text-sm text-slate-400">
              Load a high-resolution sample document to test extraction, tax reconciliation, PII redaction, and Q&A immediately.
            </p>
          </div>
          <span className="text-xs text-slate-500">
            3 reference scenarios
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {SAMPLE_DOCUMENTS.map((sample: SampleDocumentMeta) => (
            <button
              key={sample.id}
              type="button"
              disabled={isAnalyzing}
              onClick={() => onSampleSelected(sample.id)}
              className="group flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#121826] p-5 text-left transition-colors hover:border-slate-600 hover:bg-[#161E30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-blue-400">{sample.category}</span>
                  <FileText className="h-4 w-4 text-slate-500 transition-colors group-hover:text-slate-300" />
                </div>
                <h3 className="mt-2.5 text-sm font-semibold text-slate-100">
                  {sample.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                  {sample.subtitle}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-800/80 pt-3.5 text-xs">
                <span className="truncate pr-2 text-slate-500">{sample.highlights}</span>
                <span className="inline-flex items-center gap-1 font-medium text-slate-200 whitespace-nowrap shrink-0 transition-transform group-hover:translate-x-0.5">
                  Audit
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Concise 3-Stage Pipeline Summary */}
      <div className="mt-12 grid grid-cols-1 gap-8 border-t border-slate-800/80 pt-8 md:grid-cols-3">
        <div>
          <p className="text-xs font-medium text-slate-500">01. Document Intelligence</p>
          <h3 className="mt-1.5 text-sm font-semibold text-slate-200">
            Structured Invoice & Table OCR
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Extracts vendor details, invoice IDs, tax lines, and itemized tables with per-field confidence and automatic arithmetic verification.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">02. Azure AI Language</p>
          <h3 className="mt-1.5 text-sm font-semibold text-slate-200">
            Responsible AI PII Redaction
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Detects emails, phone numbers, SSNs, addresses, and bank routing numbers with side-by-side Redacted Safe Text and Original views.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">03. Azure OpenAI / AI Foundry</p>
          <h3 className="mt-1.5 text-sm font-semibold text-slate-200">
            Strictly Grounded Audit Q&A
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Query payment terms, tax variances, or compliance exposure using context-locked retrieval that refuses unsupported speculation.
          </p>
        </div>
      </div>
    </div>
  );
}
