# OmniDoc: Intelligent Document & Invoice Auditor — Setup & Production Deployment

## 1. Project Folder Structure

```text
omnidoc/
├── server.ts                      # Unified Express + Vite Node server (port 3000)
├── server/
│   └── demoData.ts                # Deterministic Azure AI-900 mock payloads & reconciler
├── backend/                       # Standalone Python FastAPI + Azure AI SDK backend (port 8000)
│   ├── main.py                    # POST /api/analyze, POST /api/chat, DEMO_MODE & CORS
│   ├── requirements.txt           # FastAPI, Uvicorn, azure-ai-documentintelligence, azure-ai-textanalytics, openai
│   └── .env.example               # Azure AI service endpoints & DEMO_MODE configuration
├── src/
│   ├── App.tsx                    # Top-bar layout, upload workspace, split-screen auditor & deploy docs
│   ├── types/audit.ts             # Shared TypeScript interfaces
│   ├── lib/
│   │   ├── api.ts                 # Typed API client for /api/analyze, /api/chat, /api/health
│   │   └── sampleInvoices.ts      # High-DPI realistic invoice/receipt/SOW visual generators
│   └── components/
│       ├── UploadDropzone.tsx     # Drag-and-drop PDF/PNG/JPG upload + 1-click sample documents
│       ├── DocumentViewer.tsx     # Interactive PDF & pan/zoom/rotate image preview pane
│       ├── ExtractedDataTab.tsx   # Document Intelligence key-value pairs, reconciliation & line items
│       ├── PrivacyAuditTab.tsx    # Azure AI Language summary, NER & Responsible AI PII redaction viewer
│       ├── AuditChatTab.tsx       # Strictly grounded RAG-lite Audit Q&A chat
│       └── ArchitectureView.tsx   # Interactive FastAPI code viewer, local CLI steps & deploy guide
└── DEPLOYMENT.md
```

## 2. Local Development (Both Stacks)

### Option A: Unified Full-Stack Web App (Port 3000)
```bash
npm install
npm run dev
# Opens http://localhost:3000 with /api/analyze and /api/chat ready immediately
```

### Option B: Standalone Python FastAPI Backend (Port 8000) + Frontend (Port 3000)
```bash
# Terminal 1 — Python FastAPI + Azure AI SDKs
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # Leave DEMO_MODE=true for offline testing, or add Azure keys
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend (pointing API base URL to FastAPI)
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

## 3. Production Deployment Guide

### Azure Container Apps (FastAPI Backend)
1. Provision Azure AI resources in the same region (e.g. `eastus`):
   - **Azure AI Document Intelligence** (S0 tier)
   - **Azure AI Language** (S tier for PII + Summarization)
   - **Azure AI Foundry / Azure OpenAI** (`gpt-4o` deployment)
2. Store API keys in **Azure Key Vault** or authenticate via **Managed Identity** (`DefaultAzureCredential`).
3. Containerize `backend/` with Python 3.12-slim running `uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2`.
4. Deploy to **Azure Container Apps** with `DEMO_MODE=false` and `FRONTEND_URL=https://omnidoc.yourdomain.com`.

### Vercel / Azure Static Web Apps (Frontend)
1. Set `VITE_API_BASE_URL` (or `NEXT_PUBLIC_API_BASE_URL`) to your Azure Container Apps HTTPS URL.
2. Build with `npm run build` and deploy `dist/`.
3. Configure HTTPS-only ingress, strict CORS origins, and 15 MB upload payload limits at the edge proxy.
