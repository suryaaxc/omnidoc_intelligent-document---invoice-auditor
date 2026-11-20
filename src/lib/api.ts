import type { AnalysisResult } from '../types/audit';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface HealthStatus {
  status: string;
  default_demo_mode: boolean;
  live_ai_available: boolean;
  azure_configured: boolean;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error('Failed to check backend status');
  }
  return res.json();
}

export async function analyzeDocument(
  file: File,
  options: { demoMode: boolean; sampleId?: string }
): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('demo_mode', String(options.demoMode));
  if (options.sampleId) {
    formData.append('sample_id', options.sampleId);
  }

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || `Analysis request failed (${res.status})`);
  }
  return data as AnalysisResult;
}

export async function sendAuditChat(payload: {
  document_context: string;
  question: string;
  chat_history: Array<{ role: 'user' | 'assistant'; content: string }>;
  demo_mode: boolean;
}): Promise<{ answer: string; mode: string; grounded: boolean }> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || `Chat request failed (${res.status})`);
  }
  return data;
}
