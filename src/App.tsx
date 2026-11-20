import React, { useEffect, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  MessageSquareText,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { analyzeDocument, fetchHealth, sendAuditChat } from './lib/api';
import { generateSampleDocumentFile } from './lib/sampleInvoices';
import type { AnalysisResult, ChatMessage } from './types/audit';
import { UploadDropzone } from './components/UploadDropzone';
import { DocumentViewer } from './components/DocumentViewer';
import { ExtractedDataTab } from './components/ExtractedDataTab';
import { PrivacyAuditTab } from './components/PrivacyAuditTab';
import { AuditChatTab } from './components/AuditChatTab';
import { ArchitectureView } from './components/ArchitectureView';

type AppPage = 'workspace' | 'architecture';
type AuditTab = 'extracted' | 'privacy' | 'chat';

function formatTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  const [page, setPage] = useState<AppPage>('workspace');
  const [activeTab, setActiveTab] = useState<AuditTab>('extracted');

  // Engine state synced from /api/health
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [liveAiAvailable, setLiveAiAvailable] = useState<boolean>(true);

  // Active document & analysis state
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | undefined>(undefined);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Audit Q&A Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const quickFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHealth()
      .then((health) => {
        setLiveAiAvailable(health.live_ai_available);
        setDemoMode(health.default_demo_mode);
      })
      .catch(() => {
        // Fallback smoothly to demo mode if health endpoint is temporarily unreachable
        setLiveAiAvailable(false);
        setDemoMode(true);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const runAnalysis = async (file: File, useDemo: boolean, sampleId?: string) => {
    setPage('workspace');
    setIsAnalyzing(true);
    setAnalysisError(null);
    setChatMessages([]);
    setChatError(null);

    // Prepare instant document preview URL
    const nextUrl = URL.createObjectURL(file);
    setFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
    setCurrentFile(file);
    setActiveSampleId(sampleId);

    try {
      const result = await analyzeDocument(file, { demoMode: useDemo, sampleId });
      setAnalysis(result);
      setActiveTab('extracted');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Document analysis failed.';
      setAnalysisError(msg);
      setAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileSelected = (file: File) => {
    void runAnalysis(file, demoMode, undefined);
  };

  const handleSampleSelected = async (sampleId: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const sampleFile = await generateSampleDocumentFile(sampleId);
      await runAnalysis(sampleFile, demoMode, sampleId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to generate sample document.';
      setAnalysisError(msg);
      setIsAnalyzing(false);
    }
  };

  const handleEngineSwitch = (nextDemo: boolean) => {
    setDemoMode(nextDemo);
    if (currentFile) {
      void runAnalysis(currentFile, nextDemo, activeSampleId);
    }
  };

  const handleResetWorkspace = () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
    setCurrentFile(null);
    setActiveSampleId(undefined);
    setAnalysis(null);
    setAnalysisError(null);
    setChatMessages([]);
    setChatError(null);
    setPage('workspace');
  };

  const handleExportJson = () => {
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${analysis.file_name.replace(/\.[^.]+$/, '')}_audit.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendChat = async (question: string) => {
    if (!analysis) return;
    setChatError(null);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: formatTime(),
    };

    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setIsSendingChat(true);

    // Construct a comprehensive grounded document context string for RAG-lite chat
    const structuredSummary = [
      `FILE: ${analysis.file_name}`,
      `MODEL: ${analysis.model_used} | TYPE: ${analysis.document_type}`,
      `SUMMARY: ${analysis.summary}`,
      `RECONCILIATION: ${analysis.reconciliation.summary}`,
      `EXTRACTED FIELDS:\n${analysis.extracted_fields
        .map((f) => `- ${f.label}: ${f.value} (confidence ${Math.round(f.confidence * 100)}%)`)
        .join('\n')}`,
      analysis.line_items.length > 0
        ? `LINE ITEMS:\n${analysis.line_items
            .map((li) => `- ${li.description} | Qty ${li.quantity} × ${li.unitPrice} = ${li.amount}`)
            .join('\n')}`
        : '',
      `DETECTED PII COUNT: ${analysis.pii_entities.length} (${Array.from(
        new Set(analysis.pii_entities.map((p) => p.category))
      ).join(', ')})`,
      `RAW DOCUMENT TEXT:\n${analysis.raw_text}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      const response = await sendAuditChat({
        document_context: structuredSummary,
        question,
        chat_history: chatMessages.map((m) => ({ role: m.role, content: m.content })),
        demo_mode: demoMode,
      });

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        timestamp: formatTime(),
        grounded: response.grounded,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to send audit question.';
      setChatError(msg);
    } finally {
      setIsSendingChat(false);
    }
  };

  const hasDocument = Boolean(currentFile && fileUrl);

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0F17] text-slate-100">
      {/* Hidden quick upload input triggered from header primary button */}
      <input
        ref={quickFileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileSelected(f);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B0F17]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-8 px-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setPage('workspace')}
            className="text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            OmniDoc
          </button>

          {/* Zone 2: Clean Single-Line Navigation Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-7 text-sm font-medium md:flex"
          >
            <button
              type="button"
              onClick={() => setPage('workspace')}
              className={`border-b-2 py-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                page === 'workspace'
                  ? 'border-blue-500 text-slate-50'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              Auditor Workspace
            </button>
            <button
              type="button"
              onClick={() => void handleSampleSelected('northwind-invoice')}
              className="border-b-2 border-transparent py-4 text-slate-400 transition-colors hover:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sample Invoice
            </button>
            <button
              type="button"
              onClick={() => setPage('architecture')}
              className={`border-b-2 py-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                page === 'architecture'
                  ? 'border-blue-500 text-slate-50'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              FastAPI & Deploy
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            {hasDocument && page === 'workspace' ? (
              <button
                type="button"
                onClick={handleResetWorkspace}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white whitespace-nowrap shrink-0 transition-colors hover:bg-blue-500 cursor-pointer"
              >
                New Audit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => quickFileInputRef.current?.click()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white whitespace-nowrap shrink-0 transition-colors hover:bg-blue-500 cursor-pointer"
              >
                Upload Document
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col">
        {page === 'architecture' ? (
          <ArchitectureView onBackToWorkspace={() => setPage('workspace')} />
        ) : !hasDocument ? (
          <UploadDropzone
            demoMode={demoMode}
            liveAiAvailable={liveAiAvailable}
            onToggleDemoMode={setDemoMode}
            onFileSelected={handleFileSelected}
            onSampleSelected={(id) => void handleSampleSelected(id)}
            isAnalyzing={isAnalyzing}
            error={analysisError}
          />
        ) : (
          /* Split-Screen Enterprise Audit Workspace */
          <div className="flex flex-1 flex-col">
            {/* Workspace Contextual Sub-Toolbar */}
            <div className="border-b border-slate-800/80 bg-[#0E131F] px-6 py-2.5">
              <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-medium text-slate-200">{currentFile?.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {analysis
                      ? `${analysis.processing_mode === 'demo' ? 'Offline Demo Mode' : 'Live AI Pipeline'} (${analysis.model_used})`
                      : isAnalyzing
                        ? 'Processing document…'
                        : 'Pending analysis'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Engine Toggle */}
                  <div
                    role="group"
                    aria-label="Switch analysis engine"
                    className="inline-flex items-center rounded-md border border-slate-800 bg-[#0B0F17] p-0.5"
                  >
                    <button
                      type="button"
                      disabled={isAnalyzing}
                      onClick={() => handleEngineSwitch(false)}
                      className={`rounded px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        !demoMode
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Live AI
                    </button>
                    <button
                      type="button"
                      disabled={isAnalyzing}
                      onClick={() => handleEngineSwitch(true)}
                      className={`rounded px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        demoMode
                          ? 'bg-slate-700 text-slate-100'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Demo Mode
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => quickFileInputRef.current?.click()}
                    disabled={isAnalyzing}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-[#121826] px-3 py-1.5 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:border-slate-600 hover:bg-slate-800 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Replace File
                  </button>

                  {analysis && (
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-[#121826] px-3 py-1.5 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:border-slate-600 hover:bg-slate-800 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export JSON
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Split-Screen Grid: Left Preview Pane | Right Tabbed Audit Pane */}
            <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 lg:grid-cols-12">
              {/* Left Pane: Interactive Document Preview */}
              <div className="border-b border-slate-800/80 lg:col-span-5 lg:border-r lg:border-b-0 lg:h-[calc(100vh-105px)] lg:sticky lg:top-[105px]">
                {currentFile && fileUrl && (
                  <DocumentViewer
                    fileUrl={fileUrl}
                    fileName={currentFile.name}
                    fileType={currentFile.type}
                    fileSize={currentFile.size}
                  />
                )}
              </div>

              {/* Right Pane: Tabbed Audit Interface */}
              <div className="flex flex-col bg-[#0B0F17] lg:col-span-7">
                {/* Tab Bar */}
                <div
                  role="tablist"
                  aria-label="Audit inspection views"
                  className="flex items-center gap-1 overflow-x-auto border-b border-slate-800/80 bg-[#0E131F] px-4 pt-2"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'extracted'}
                    onClick={() => setActiveTab('extracted')}
                    className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      activeTab === 'extracted'
                        ? 'border-blue-500 text-slate-50'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Extracted Data
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'privacy'}
                    onClick={() => setActiveTab('privacy')}
                    className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      activeTab === 'privacy'
                        ? 'border-blue-500 text-slate-50'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Privacy & NLP Audit
                    {analysis && analysis.pii_entities.length > 0 && (
                      <span className="font-mono text-[11px] text-rose-400 tabular-nums">
                        ({analysis.pii_entities.length})
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'chat'}
                    onClick={() => setActiveTab('chat')}
                    className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      activeTab === 'chat'
                        ? 'border-blue-500 text-slate-50'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <MessageSquareText className="h-3.5 w-3.5" />
                    Audit Q&A Chat
                  </button>
                </div>

                {/* Tab Panel Content */}
                <div className="flex-1">
                  {isAnalyzing ? (
                    <div className="space-y-6 p-6">
                      <div className="h-4 w-64 animate-pulse rounded bg-slate-800" />
                      <div className="h-20 w-full animate-pulse rounded-lg border border-slate-800 bg-[#121826]" />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-16 animate-pulse rounded-lg border border-slate-800 bg-[#121826]"
                          />
                        ))}
                      </div>
                      <div className="h-44 w-full animate-pulse rounded-lg border border-slate-800 bg-[#121826]" />
                    </div>
                  ) : analysisError ? (
                    <div className="p-6">
                      <div
                        role="alert"
                        className="rounded-lg border border-rose-500/35 bg-rose-950/25 p-5"
                      >
                        <div className="flex items-start gap-3">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                          <div>
                            <h3 className="text-sm font-semibold text-rose-200">
                              Document Analysis Error
                            </h3>
                            <p className="mt-1 text-xs leading-relaxed text-rose-200/80">
                              {analysisError}
                            </p>
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                              {currentFile && (
                                <button
                                  type="button"
                                  onClick={() => void runAnalysis(currentFile, demoMode, activeSampleId)}
                                  className="rounded-md bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 cursor-pointer"
                                >
                                  Retry Analysis
                                </button>
                              )}
                              {!demoMode && currentFile && (
                                <button
                                  type="button"
                                  onClick={() => handleEngineSwitch(true)}
                                  className="rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 cursor-pointer"
                                >
                                  Run in Offline Demo Mode
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : analysis ? (
                    <>
                      {activeTab === 'extracted' && <ExtractedDataTab analysis={analysis} />}
                      {activeTab === 'privacy' && <PrivacyAuditTab analysis={analysis} />}
                      {activeTab === 'chat' && (
                        <AuditChatTab
                          analysis={analysis}
                          messages={chatMessages}
                          isSending={isSendingChat}
                          error={chatError}
                          onSendMessage={(q) => void handleSendChat(q)}
                          onClearChat={() => {
                            setChatMessages([]);
                            setChatError(null);
                          }}
                        />
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
