# LexScope

**Understand what you're signing.**

LexScope is an AI-powered legal document understanding platform. Paste an employment agreement, lease, terms of service, or any contract — and get a plain-language explanation, clause-by-clause, with attention indicators, red flags, key dates, and a list of questions to ask before signing.

> LexScope provides AI-generated explanations and document insights for informational purposes only. It is not legal advice and does not replace a qualified legal professional.

---

## Architecture

```
┌────────────────────────────── Browser ──────────────────────────────┐
│  React + Vite + Tailwind (frontend/)                                │
│                                                                     │
│  Document text ──► services/legalAnalysisService.js                 │
│      │               (prompt + JSON schema + parse/normalize)       │
│      │  /api/*  (same-origin, proxied by Vite in dev)               │
│      ▼                                                              │
└──────┼──────────────────────────────────────────────────────────────┘
       ▼
┌────────────────────────────── Server ───────────────────────────────┐
│  FastAPI (backend/) — stateless document + AI processing:           │
│    • text extraction (TXT in v1; registry ready for PDF/DOCX)       │
│    • cleaning, stats, size/content validation                       │
│    • POST /api/ai/chat → services/ai_proxy.py  ◄── the ONLY         │
│      provider-aware module. Server-side creds from .env:            │
│      GEMINI_API_KEY (free tier)      │
│      → Google Gemini (2.5 Flash, fallback 2.0 Flash)                │
│    • rate limit, model allowlist, no content logging, NO storage    │
└─────────────────────────────────────────────────────────────────────┘
```

**Auth model — developer pays, users never sign in:** AI credentials live only in the backend environment (`.env`). Visitors analyze documents with zero accounts and zero popups. Provider priority in the backend: `GEMINI_API_KEY` (Google AI Studio, free tier — recommended) first.

---

## Quick start

Requirements: **Python 3.11+** and **Node 18+**.

### 1. Backend (FastAPI) — port 8000

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt


uvicorn app.main:app --reload --env-file .env --port 8000
```

Verify: `curl http://localhost:8000/api/health` → `{"status":"ok",...}` (interactive docs at `/docs`).


### 2. Frontend (React + Vite) — port 5173

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api/*` to port 8000, so no CORS setup is needed.


## How the AI integration works (developer-pays, no user sign-in)

The backend owns AI credentials; visitors never sign in. Provider priority in `ai_proxy.py`:

1. **`GEMINI_API_KEY`** (recommended, free tier) — Google AI Studio key via Gemini's official OpenAI-compatible endpoint (`generativelanguage.googleapis.com`). Create: https://aistudio.google.com/apikey


| File | Responsibility |
|---|---|
| `backend/app/services/ai_proxy.py` | **The only provider-aware module.** Picks the provider from env, translates `google/…` model names per provider, maps upstream errors to typed codes. Swap/add providers here. |
| `backend/app/routes/ai.py` | `POST /api/ai/chat` guard-rail: configured-check, per-client rate limit (`LEXSCOPE_AI_RATE_LIMIT`), payload size caps, `google/*` model allowlist. |
| `frontend/src/services/backendAiClient.js` | Primary client — calls the backend proxy. |


- Gemini is instructed to return **one strict JSON object** matching the LexScope schema (summary, document_type, overall_risk, key_takeaways, clauses[], red_flags[], obligations[], important_dates[], questions_to_ask[]). `utils/analysisSchema.js` re-validates/normalizes every field, so malformed AI output can never crash the UI.
- Model chain: `google/gemini-2.5-flash` → fallback `google/gemini-2.0-flash` (edit `MODEL_CHAIN` in `frontend/src/services/legalAnalysisService.js`).
- `GET /api/ai/status` reports `{"configured", "provider", "model"}` — handy for debugging which route is live.

---

## Features

1. **Landing page** — hero, how-it-works, capabilities, worked example, privacy section, disclaimer, CTA.
2. **Document input** — paste text or upload `.txt`/`.md` (drag & drop), live word/char counts, sample document loader, clear/reset, validation for empty / too-short / oversized input (60k chars).
3. **AI analysis** — structured JSON via Gemini with the full safety prompt (never invent clauses, quote only verbatim text, distinguish fact from interpretation, express uncertainty, never claim definitively illegal).
4. **Results dashboard** — document header (type + overall attention level), plain-English summary, numbered key takeaways, risk overview with counts (labeled *AI-generated attention indicators, not legal judgments*), obligations, important dates.
5. **Clause explorer** — every clause with original text beside the plain-language explanation, why it matters, and a "worth checking" action; filter by attention level and category; expand/collapse.
6. **Document highlighting** — the original document with color-coded highlights per attention level; click any highlight for the side-by-side explanation. Matching uses exact whitespace/case/quote normalization, handles "…" excerpts, and a conservative fuzzy fallback; paraphrased excerpts are never highlighted wrongly.
7. **Red flags** — severity-ranked flags with explanations of the *actual wording* (presence alone is never treated as a problem).
8. **Questions to ask** — practical pre-signing questions with check-off and copy-all.
9. **UX** — serif "legal brief" design system (paper/ink/laurel), hairline rules, strong typography, responsive, print-friendly report.


---

## API (backend)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Service health |
| GET | `/api/meta/limits` | Limits + supported formats (mirrored by the UI) |
| POST | `/api/documents/extract` | Upload `.txt` file → cleaned text + stats (multipart) |
| POST | `/api/documents/validate` | Pasted text → cleaned text + stats (JSON) |

All errors use one envelope: `{"error": {"code", "message", "details"}}`.

## Configuration (backend `.env` — see `.env.example`)


| `LEXSCOPE_AI_MODEL` | `google/gemini-2.5-flash` | Default Gemini model |
| `LEXSCOPE_AI_TIMEOUT_SECONDS` | `180` | Upstream AI timeout |
| `LEXSCOPE_AI_RATE_LIMIT` | `8/600` | Per-IP AI calls per window (protects your quota) |
| `LEXSCOPE_MAX_FILE_BYTES` | `524288` | Max upload size (512 KB) |
| `LEXSCOPE_MAX_TEXT_CHARS` | `60000` | Max analyzable text length |
| `LEXSCOPE_CORS_ORIGINS` | `*` | Comma-separated origins (lock down for production) |

Security notes: the token lives only in the backend environment (never shipped to the browser, never committed — `.env` is git-ignored). Document content is **never logged**; the AI proxy logs only model names, status codes and timings.

## Tests

```bash
# Backend (9 tests, no network needed)
cd backend && python -m pytest tests/ -q

# Frontend logic: JSON parsing, schema normalization, highlight location
node scripts/test-logic.mjs


## Adding PDF / DOCX later

Write an extractor and register it — routes and schemas stay untouched:

```python
# backend/app/services/extraction.py
def extract_pdf(content: bytes) -> str: ...   # e.g. pypdf

EXTRACTORS[".pdf"] = extract_pdf
```

On the frontend, only `AnalyzePage`'s accepted-file logic needs the new extension.

## Privacy & security posture

- No document persistence anywhere: backend processes in memory only; the frontend keeps the current report in `sessionStorage` (cleared when the tab closes).
- No document content is logged, client or server.
- No API credentials exist in the project.
- The UI explicitly warns users not to paste highly sensitive information.
- The disclaimer is displayed on the landing page, footer, analyzer, and results.

## Known limitations (v1)

- TXT/MD files only — PDF/DOCX are roadmap (extension point ready).
- Analysis takes ~15–60s for typical documents (single Gemini call; model fallback chain mitigates outages).
- Highlight matching can't locate paraphrased (non-verbatim) excerpts; those clauses simply aren't highlighted in the Document view.
- English-language documents only (Gemini handles other languages, but the UI copy is English).
- Attention levels are heuristic AI indicators, not legal judgments — stated throughout the UI.

## Demo flow (5 minutes)

1. **Landing page** — point out the tagline, the worked example, and the privacy section ("built to forget your document").
2. Click **Analyze a document** → **Load sample agreement** (a fictional employment contract, included).
3. Note the live stats bar, then hit **Analyze document**. Show the staged progress panel.
4. On the report: read the **summary**, then the **risk overview** ("attention indicators — not judgments").
5. Open **Clauses** → expand *"Liability and indemnity (uncapped)"* — original text beside plain language, why it matters, what to check. Toggle the *High* filter to show triage.
6. Open **Document** → click the highlighted indemnity passage in the original contract; the explanation appears in the side panel.
7. Open **Red flags** — emphasize the wording-based explanations and the "not automatically a problem" note.
8. Open **Questions** → copy all.
9. Close with the disclaimer card + privacy posture: no storage, no API keys, analysis runs in your browser.

*(Optional offline fallback: `node scripts/test-pipeline.mjs` demonstrates the full analysis pipeline against a recorded Gemini response without any network.)*
