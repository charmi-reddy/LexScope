# LexScope

**Understand what you're signing - and never miss the deadline buried in it.**

LexScope is an AI-powered legal document understanding platform. Paste or upload an employment agreement, lease, terms of service, legal notice, or any contract - and get a plain-language explanation, clause by clause, with attention indicators, red flags, key dates, and a list of questions to ask before signing.

For ongoing legal issues, LexScope goes further: group every notice and order into a **matter**, and it keeps a running plain-language summary of where things stand - plus automatic extraction of the deadlines each new document sets, so the dates that matter never get lost.

Live at **[lexscope.xyz](https://lexscope.xyz)**.

> LexScope provides AI-generated explanations and document insights for informational purposes only. It is not legal advice and does not replace a qualified legal professional.

---

## Features

1. **Document analysis** - paste text or upload `.txt`/`.md`/`.pdf`/`.docx` (drag & drop). Get a structured report: plain-English summary, key takeaways, clause-by-clause explanations, severity-ranked red flags, obligations, important dates, and questions to ask before signing.
2. **Top findings first** - the report opens with *"N things to look at before you sign"*: the most serious red flags, each one tappable to jump to the exact sentence in your document.
3. **Citation integrity** - every red flag carries a supporting quote that LexScope re-verifies against the document text: *Verified in document*, *Matched approximately*, or *Quote not found*. Flags that can't be located are marked "treat this flag with caution" instead of being silently trusted.
4. **Matters (case timelines)** - create a matter for an ongoing legal issue and add each new notice or order as it arrives. Every update gets an AI summary plus a "what changed" line, and the matter keeps a running *"where things stand"* summary that refreshes with each document.
5. **Automatic deadline extraction** - the AI pulls every deadline and hearing date a document explicitly sets ("submit evidence by March 3"), and the matter page shows a Deadlines card with the next due date highlighted. Relative dates are only converted when the document gives an explicit anchor date; dates are never invented.
6. **Quick analyses history** - one-shot analyses by signed-in users auto-save into a catch-all "Quick analyses" matter (newest 50 kept), so a quick check doesn't vanish when the tab closes.
7. **Accounts & privacy** - email/password sign-in. Matters and uploaded documents live in your private account, scoped to your user on every query and protected by row-level security on the Supabase tables. Deleting a matter removes it and its documents for good.
8. **Document highlighting & clause explorer** - the original document with color-coded highlights per attention level; click any highlight for the side-by-side explanation.
9. **Save as PDF** - one click exports the full report through the browser's print flow with a dedicated print-ready layout.
10. **Worked example** - the landing page includes a fictional sample employment agreement so visitors can try the full flow without a document of their own.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 6, Tailwind CSS 4, React Router 6, `@supabase/supabase-js` |
| Backend | Python, FastAPI, served with Uvicorn |
| Database & auth | Supabase (PostgreSQL + email/password auth, row-level security) |
| AI | Google Gemini API via its OpenAI-compatible endpoint (`generativelanguage.googleapis.com/v1beta/openai`) |
| File extraction | pypdf (PDF), python-docx (DOCX) |
| Deployment | Render - the FastAPI app also serves the built frontend (`frontend/dist`) as static files, at [lexscope.xyz](https://lexscope.xyz) |

### Architecture

```
Browser: React 18 + Vite 6 + Tailwind 4 (frontend/)
  Document text ──► services/legalAnalysisService.js
      │               (prompt + JSON schema + parse/normalize)
      │  /api/*  (same-origin; proxied by Vite in dev)
      ▼
Server: FastAPI (backend/)
  • text extraction (.txt/.md/.pdf/.docx), cleaning, validation
  • POST /api/ai/chat → services/ai_proxy.py - the ONLY provider-aware
    module. Server-side GEMINI_API_KEY from the environment.
    Rate limit, model allowlist, no content logging.
  • matters, documents, summaries and quick-saves via Supabase
      ▼
Supabase: accounts, matters, matter updates, deadlines (row-level security)
```

**Auth model - users sign in, developer pays:** Supabase accounts protect matter timelines and uploaded documents. AI credentials live only in the backend environment; end users never see them and the developer pays for Gemini usage.

### AI reliability

- The AI is instructed to return **one strict JSON object** matching the LexScope schema. The frontend re-validates and normalizes every field, so malformed AI output can never crash the UI; malformed JSON gets one automatic repair round.
- **Model failover chain:** `google/gemini-3.5-flash-lite` → `google/gemini-2.5-flash`, with automatic failover on retryable upstream errors (429 rate limits, model unavailable, provider errors). The chain lives in `frontend/src/services/legalAnalysisService.js` for document analysis and in `backend/app/services/matter_ai.py` for matter summaries.
- **Observability:** the AI proxy logs provider, model, status code, upstream response body and timings - document content is never logged. `GET /api/ai/status` reports `{"configured", "provider", "model", "reason"}` for debugging which route is live.

---

## Quick start

Requirements: **Python 3.11+** and **Node 18+**, plus a free [Supabase](https://supabase.com) project and a [Google AI Studio key](https://aistudio.google.com/apikey).

### 1. Backend (FastAPI) - port 8000

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/api/health` (interactive docs at `/docs`).

Create `backend/.env`:

```env
# Supabase (Project Settings → API). All three are required at startup.
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# AI (Google AI Studio). Without it the app runs but analysis is disabled.
GEMINI_API_KEY=<your-gemini-key>
```

In Supabase, create the `matters` and `matter_updates` tables with row-level security enabled (the `matter_updates` table needs a `deadlines jsonb` column), and turn on email/password auth. Email confirmation can stay off for development.

### 2. Frontend (React + Vite) - port 5173

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env`:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Open **http://localhost:5173**. The Vite dev server proxies `/api/*` to port 8000, so no CORS setup is needed.

### Optional backend tuning

All limits are environment-overridable (defaults in `backend/app/config.py`):

| Variable | Default | Purpose |
|---|---|---|
| `LEXSCOPE_AI_MODEL` | `google/gemini-3.5-flash-lite` | Default Gemini model |
| `LEXSCOPE_AI_TIMEOUT_SECONDS` | `180` | Upstream AI timeout |
| `LEXSCOPE_AI_RATE_LIMIT` | `8/600` | Per-IP AI calls per window (protects your quota) |
| `LEXSCOPE_MAX_FILE_BYTES` | `524288` | Max upload size (512 KB) |
| `LEXSCOPE_MAX_TEXT_CHARS` | `60000` | Max analyzable text length |
| `LEXSCOPE_CORS_ORIGINS` | `*` | Comma-separated origins (lock down for production) |

---

## API (backend)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Service health |
| GET | `/api/meta/limits` | Limits + supported formats (mirrored by the UI) |
| POST | `/api/documents/extract` | Upload `.txt`/`.md`/`.pdf`/`.docx` → cleaned text + stats (multipart) |
| POST | `/api/documents/validate` | Pasted text → cleaned text + stats (JSON) |
| GET | `/api/ai/status` | AI configuration status (never exposes the key) |
| POST | `/api/ai/chat` | Guard-railed AI proxy: rate limit, payload caps, model allowlist |
| POST | `/api/matters` | Create a matter |
| GET | `/api/matters` | List the signed-in user's matters |
| GET | `/api/matters/{id}` | Matter detail: updates, running summary, deadlines |
| POST | `/api/matters/{id}/updates` | Add a document; triggers AI summary, "what changed" and deadline extraction |
| PATCH | `/api/matters/{id}` | Rename a matter |
| DELETE | `/api/matters/{id}` | Delete a matter and its documents |
| POST | `/api/quick-saves` | Auto-save a one-shot analysis (signed-in users) |

All errors use one envelope: `{"error": {"code", "message", "details"}}`. Matter and quick-save routes require a Supabase auth token and are scoped to the signed-in user.

---

## Testing

```bash
# Backend: 42 tests, no network needed
cd backend && python -m pytest tests/ -q

# Frontend logic: JSON parsing, schema normalization, quote/highlight location, top findings
node scripts/test-logic.mjs

# Live end-to-end: real pipeline → real backend proxy → real Gemini
# (requires a running backend with a working key; uses free-tier quota)
node scripts/test-live.mjs

# AI proxy smoke check after deploying
LEXSCOPE_API_BASE=http://localhost:8000 node scripts/smoke-ai.mjs

# Offline fallback: full pipeline against a recorded Gemini response
node scripts/test-pipeline.mjs
```

The backend suite covers the document API, auth, AI proxy behavior (including failover and upstream error mapping), matters, and quick saves.

---

## Privacy & security posture

- Matters and uploads are stored in your private account, scoped per user and protected by row-level security; documents are never used to train AI models. Deleting a matter removes it and its documents for good.
- No document content is logged, client or server. The AI proxy logs only provider, model, status codes and timings.
- Provider secrets are never hardcoded or shipped to the browser; credentials are supplied through environment variables (`.env` is git-ignored).
- The UI explicitly warns users not to paste highly sensitive information, and the not-legal-advice disclaimer appears on the landing page, footer, analyzer, and results.

## Known limitations (v1)

- File uploads: `.txt`/`.md`/`.pdf`/`.docx` only - `.doc` and `.rtf` are on the roadmap (the extractor registry in `backend/app/services/extraction.py` makes adding formats a one-function change). Scanned and password-protected PDFs can't be read; the error says so and offers the paste fallback.
- Analysis takes ~15-60s for typical documents (a single Gemini call; the model fallback chain mitigates outages and rate limits).
- Quote matching can't locate paraphrased (non-verbatim) excerpts; those show *Quote not found* instead of a highlight, and the UI says so.
- English-language documents only (the UI copy is English).
- Attention levels and deadlines are AI-generated indicators, not legal judgments - stated throughout the UI.
