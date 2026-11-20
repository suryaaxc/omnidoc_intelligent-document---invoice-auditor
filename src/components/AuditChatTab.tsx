import React, { useEffect, useRef, useState } from 'react';
import { Send, RotateCcw, Copy, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import type { AnalysisResult, ChatMessage } from '../types/audit';

interface AuditChatTabProps {
  analysis: AnalysisResult;
  messages: ChatMessage[];
  isSending: boolean;
  error: string | null;
  onSendMessage: (question: string) => void;
  onClearChat: () => void;
}

const SUGGESTED_PROMPTS = [
  'Are there any tax or subtotal discrepancies?',
  'Summarize the payment terms and due date',
  'What sensitive PII risks were found in this document?',
  'Which line item represents the highest cost?',
];

function renderFormattedAnswer(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;

    // Parse inline **bold** and `code`
    const tokens = trimmed.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((tok, j) => {
      if (tok.startsWith('**') && tok.endsWith('**')) {
        return (
          <strong key={j} className="font-semibold text-slate-100">
            {tok.slice(2, -2)}
          </strong>
        );
      }
      if (tok.startsWith('`') && tok.endsWith('`')) {
        return (
          <code
            key={j}
            className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-rose-300"
          >
            {tok.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={j}>{tok}</React.Fragment>;
    });

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      return (
        <div key={i} className="flex items-start gap-2 pl-1">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
          <span className="leading-relaxed">{tokens.slice(0).map((t, k) => (k === 0 && typeof t === 'string' ? t : t))}</span>
        </div>
      );
    }

    return (
      <p key={i} className="leading-relaxed">
        {tokens}
      </p>
    );
  });
}

export function AuditChatTab({
  analysis,
  messages,
  isSending,
  error,
  onSendMessage,
  onClearChat,
}: AuditChatTabProps) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || isSending) return;
    setInput('');
    onSendMessage(q);
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="flex h-full min-h-[540px] flex-col">
      {/* Grounding Notice Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-6 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-blue-400" />
          <span>
            Strictly grounded to <span className="font-medium text-slate-200">{analysis.file_name}</span>
          </span>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearChat}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Thread
          </button>
        )}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {messages.length === 0 ? (
          <div className="py-6">
            <h3 className="text-sm font-semibold text-slate-100">
              Ask grounded audit questions about this document
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Answers are strictly restricted to extracted document text, line items, and verified calculations. Questions outside this document will be declined.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isSending}
                  onClick={() => onSendMessage(prompt)}
                  className="rounded-lg border border-slate-800/90 bg-[#121826] px-3.5 py-3 text-left text-xs text-slate-300 transition-colors hover:border-slate-600 hover:bg-[#161F31] hover:text-slate-100 cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-500">
                <span>{msg.role === 'user' ? 'Auditor' : 'OmniDoc Audit Copilot'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[90%] rounded-lg border px-4 py-3 text-xs ${
                  msg.role === 'user'
                    ? 'border-blue-500/30 bg-blue-600/15 text-slate-100'
                    : 'border-slate-800/90 bg-[#121826] text-slate-300'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="space-y-1">{renderFormattedAnswer(msg.content)}</div>
                ) : (
                  <p className="leading-relaxed">{msg.content}</p>
                )}

                {msg.role === 'assistant' && (
                  <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px] text-slate-500">
                    <span>Grounded in extracted document context</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isSending && (
          <div className="max-w-[85%] space-y-2 rounded-lg border border-slate-800 bg-[#121826] p-4">
            <div className="h-2.5 w-36 animate-pulse rounded bg-slate-800" />
            <div className="h-2.5 w-full animate-pulse rounded bg-slate-800/80" />
            <div className="h-2.5 w-4/5 animate-pulse rounded bg-slate-800/60" />
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-rose-500/35 bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Chat Input Form */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-800/80 bg-[#0E131F] px-6 py-4"
      >
        <div className="flex items-center gap-2.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending}
            placeholder="Ask about tax discrepancies, payment terms, line items, or PII…"
            aria-label="Ask a grounded audit question"
            className="flex-1 rounded-lg border border-slate-700/80 bg-[#121826] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white whitespace-nowrap shrink-0 transition-colors hover:bg-blue-500 disabled:opacity-45 cursor-pointer"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
