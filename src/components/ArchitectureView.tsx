import React, { useState } from 'react';
import { Check, Copy, Terminal, Server, FolderTree, Cloud } from 'lucide-react';

type SnippetKey = 'commands' | 'fastapi' | 'requirements' | 'env' | 'deploy';

const SNIPPETS: Record<SnippetKey, { label: string; filePath: string; code: string }> = {
  commands: {
    label: 'Local CLI Run Commands',
    filePath: 'Terminal (Frontend + Python FastAPI)',
    code: `# 1. Start the Python FastAPI + Azure AI SDK Backend (Port 8000)
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env             # DEMO_MODE=true works offline out of the box
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 2. Start the Frontend Server (Port 3000) in a second terminal
npm install
VITE_API_BASE_URL=http://localhost:8000 npm run dev

# Or run the unified Node + Express + Vite full-stack server directly on port 3000:
npm install && npm run dev`,
  },
  fastapi: {
    label: 'backend/main.py',
    filePath: 'backend/main.py',
    code: `import os
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
DEMO_MODE_DEFAULT = os.getenv("DEMO_MODE", "true").lower() == "true"

app = FastAPI(title="OmniDoc Intelligent Document & Invoice Auditor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Full runnable implementation lives in /backend/main.py in this repository:
# - POST /api/analyze -> Azure Document Intelligence (prebuilt-invoice -> prebuilt-read)
#                        + Azure AI Language (recognize_pii_entities, recognize_entities, abstract_summary)
# - POST /api/chat    -> Azure OpenAI / Azure AI Foundry grounded RAG-lite Q&A
# - DEMO_MODE=true    -> Realistic offline Azure AI-900 mock payloads when keys are unset`,
  },
  requirements: {
    label: 'requirements.txt',
    filePath: 'backend/requirements.txt',
    code: `fastapi==0.115.6
uvicorn[standard]==0.32.1
python-multipart==0.0.19
pydantic==2.10.3
python-dotenv==1.0.1
azure-ai-documentintelligence==1.0.0b4
azure-ai-textanalytics==5.3.0
openai==1.57.4`,
  },
  env: {
    label: '.env.example',
    filePath: 'backend/.env.example',
    code: `DEMO_MODE=true
FRONTEND_URL=http://localhost:3000

AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your_document_intelligence_key

AZURE_LANGUAGE_ENDPOINT=https://your-language.cognitiveservices.azure.com/
AZURE_LANGUAGE_KEY=your_language_key

AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-10-21`,
  },
  deploy: {
    label: 'Production Deployment',
    filePath: 'Azure Container Apps + Vercel / Static Web Apps',
    code: `# 1. Provision Azure AI-900 Resources (same region, e.g. eastus)
az cognitiveservices account create -n omnidoc-docintel -g omnidoc-rg --kind FormRecognizer --sku S0 -l eastus
az cognitiveservices account create -n omnidoc-lang -g omnidoc-rg --kind TextAnalytics --sku S -l eastus

# 2. Deploy FastAPI Backend to Azure Container Apps
az containerapp up \\
  --name omnidoc-api \\
  --resource-group omnidoc-rg \\
  --location eastus \\
  --source ./backend \\
  --target-port 8000 \\
  --ingress external \\
  --env-vars DEMO_MODE=false FRONTEND_URL=https://omnidoc.yourdomain.com

# 3. Deploy Frontend (Vercel or Azure Static Web Apps)
# Set VITE_API_BASE_URL=https://omnidoc-api.<region>.azurecontainerapps.io
npm run build`,
  },
};

export function ArchitectureView({ onBackToWorkspace }: { onBackToWorkspace: () => void }) {
  const [activeKey, setActiveKey] = useState<SnippetKey>('commands');
  const [copied, setCopied] = useState(false);

  const current = SNIPPETS[activeKey];

  const handleCopy = () => {
    navigator.clipboard.writeText(current.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto w-full max-w-[1160px] px-6 py-10">
      <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-blue-400">
            Reference Stack · Azure AI-900 Architecture
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold text-slate-50">
            Python FastAPI Backend & Production Deployment
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-400">
            Complete repository deliverables for running the standalone Python FastAPI + Azure AI SDKs service alongside this React workspace or deploying to Azure Container Apps.
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToWorkspace}
          className="rounded-lg border border-slate-700 bg-[#121826] px-4 py-2 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:border-slate-500 hover:bg-slate-800 cursor-pointer"
        >
          Back to Auditor
        </button>
      </div>

      {/* 3-Column Architecture Overview */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-slate-800/90 bg-[#121826] p-5">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-100">
            <FolderTree className="h-4 w-4 text-blue-400" />
            Repository Structure
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Includes both the active Express + Vite workspace (<span className="font-mono text-slate-300">server.ts</span>) and the standalone Python FastAPI backend (<span className="font-mono text-slate-300">backend/main.py</span>, <span className="font-mono text-slate-300">requirements.txt</span>, <span className="font-mono text-slate-300">.env.example</span>).
          </p>
        </div>

        <div className="rounded-lg border border-slate-800/90 bg-[#121826] p-5">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-100">
            <Server className="h-4 w-4 text-blue-400" />
            Unified API Contract
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            <span className="font-mono text-slate-300">POST /api/analyze</span> accepts multipart PDF/PNG/JPG files; <span className="font-mono text-slate-300">POST /api/chat</span> enforces grounded Q&A with CORS configured for <span className="font-mono text-slate-300">localhost:3000</span>.
          </p>
        </div>

        <div className="rounded-lg border border-slate-800/90 bg-[#121826] p-5">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-100">
            <Cloud className="h-4 w-4 text-blue-400" />
            Offline DEMO_MODE Toggle
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Set <span className="font-mono text-slate-300">DEMO_MODE=true</span> in <span className="font-mono text-slate-300">.env</span> or flip the workspace switch to demonstrate every Azure AI-900 capability offline without API keys.
          </p>
        </div>
      </div>

      {/* Interactive Code & CLI Viewer */}
      <div className="mt-8 overflow-hidden rounded-xl border border-slate-800/90 bg-[#121826]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 bg-[#0E131F] px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1">
            {(Object.keys(SNIPPETS) as SnippetKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveKey(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeKey === key
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                }`}
              >
                {SNIPPETS[key].label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#141B2B] px-3 py-1.5 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 hover:bg-slate-800 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Snippet
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-800/60 bg-[#0B0F17] px-4 py-2 text-xs text-slate-500">
          <Terminal className="h-3.5 w-3.5" />
          <span className="font-mono">{current.filePath}</span>
        </div>

        <pre className="overflow-x-auto p-5 font-mono text-xs leading-6 text-slate-300">
          <code>{current.code}</code>
        </pre>
      </div>
    </div>
  );
}
