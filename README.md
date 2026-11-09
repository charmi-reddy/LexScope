# LexScope

**Understand what you're signing.**

LexScope is an AI-powered legal document understanding platform. Paste or upload an employment agreement, lease, terms of service, or any contract - and get a plain-language explanation, clause-by-clause, with attention indicators, red flags, key dates, and a list of questions to ask before signing.

> LexScope provides AI-generated explanations and document insights for informational purposes only. It is not legal advice and does not replace a qualified legal professional.

---

## Architecture

```
┌────────────────────────────── Browser ──────────────────────────────┐
│  React 18 + Vite 6 + Tailwind 4 (frontend/)                         │
│                                                                     │
│  Document text ──► services/legalAnalysisService.js                 │
│      │               (prompt + JSON schema + parse/normalize)       │
│      │  /api/*  (same-origin, proxied by Vite in dev)               │
│      ▼                                                              │
│  History: browser localStorage, on-device only (newest 10)          │
└──────┼──────────────────────────────────────────────────────────────┘
       ▼
┌────────────────────────────── Server ───────────────────────────────┐
│  FastAPI (backend/) - stateless document + AI processing:           │
│    • text extraction (.txt/.md/.pdf/.docx via pypdf + python-docx;  │
│      .doc/.rtf planned)                                             │
│    • cleaning, stats, size/content validation                       │
│    • POST /api/ai/chat → services/ai_proxy.py  ◄── the ONLY         │
│      provider-aware module. Server-side creds from .env:            │
│      GEMINI_API_KEY (free tier)                                     │
│      → Google Gemini (2.5 Flash, fallback 2.0 Flash)                │
│    • rate limit, model allowlist, no content logging, NO storage    │
└─────────────────────────────────────────────────────────────────────┘
```

**Auth model - developer pays, users never sign in:** AI credentials live only in the backend environment (`.env`). Visitors analyze documents with zero accounts and zero popups. Provider priority in the backend: `GEMINI_API_KEY` (Google AI Studio, free tier - recommended) first.

---

## Quick start

Requirements: **Python 3.11+** and **Node 18+**.

### 1. Backend (FastAPI) - port 8000

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt


uvicorn app.main:app --reload --env-file .env --port 8000
```

Verify: `curl http://localhost:8000/api/health` → `{"status":"ok",...}` (interactive docs at `/docs`).


### 2. Frontend (React + Vite) - port 5173

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api/*` to port 8000, so no CORS setup is needed.


## How the AI integration works (developer-pays, no user sign-in)

The backend owns AI credentials; visitors never sign in. Provider priority in `ai_proxy.py`:

1. **`GEMINI_API_KEY`** (recommended, free tier) - Google AI Studio key via Gemini's official OpenAI-compatible endpoint (`generativelanguage.googleapis.com`). Create: https://aistudio.google.com/apikey


| File | Responsibility |
|---|---|
| `backend/app/services/ai_proxy.py` | **The only provider-aware module.** Picks the provider from env, translates `google/…` model names per provider, maps upstream errors to typed codes. Swap/add providers here. |
| `backend/app/routes/ai.py` | `POST /api/ai/chat` guard-rail: configured-check, per-client rate limit (`LEXSCOPE_AI_RATE_LIMIT`), payload size caps, `google/*` model allowlist. |
| `frontend/src/services/backendAiClient.js` | Primary client - calls the backend proxy. |


- Gemini is instructed to return **one strict JSON object** matching the LexScope schema (summary, document_type, overall_risk, key_takeaways, clauses[], red_flags[], obligations[], important_dates[], questions_to_ask[]). `utils/analysisSchema.js` re-validates/normalizes every field, so malformed AI output can never crash the UI.
- Model chain: `google/gemini-2.5-flash` → fallback `google/gemini-2.0-flash` (edit `MODEL_CHAIN` in `frontend/src/services/legalAnalysisService.js`).
- `GET /api/ai/status` reports `{"configured", "provider", "model", "reason"}` - handy for debugging which route is live. If the Gemini key is missing or still a placeholder, `configured` is `false` and the `reason` names the missing variable without exposing the key itself.

After deploying, run:

```bash
LEXSCOPE_API_BASE=http://localhost:8000 node scripts/smoke-ai.mjs
```

---

## Features

1. **Landing page** - hero, how-it-works, capabilities, worked example, privacy section, disclaimer, CTA.
2. **Document input** - paste text or upload `.txt`/`.md`/`.pdf`/`.docx` (drag & drop), live word/char counts, sample document loader, clear/reset, validation for empty / too-short / oversized input (60k chars). PDF and DOCX text is extracted server-side with pypdf and python-docx; scanned or password-protected PDFs get a clear, specific error with the "paste the text instead" fallback.
3. **AI analysis** - structured JSON via Gemini with the full safety prompt (never invent clauses, quote only verbatim text, distinguish fact from interpretation, express uncertainty, never claim definitively illegal).
4. **Results dashboard** - document header (type + overall attention level), plain-English summary, numbered key takeaways, risk overview with counts (labeled *AI-generated attention indicators, not legal judgments*), obligations, important dates.
5. **Top findings** - the Overview opens with *"N things to look at before you sign"*: the most serious red flags, each one tappable to jump to the exact sentence in your document.
6. **Citation-integrity** - every red flag carries a supporting quote that LexScope then locates in the document text, labeled *Verified in document* (exact match), *Matched approximately*, or *Quote not found*. Flags whose quote can't be located are explicitly marked "treat this flag with caution" instead of being silently trusted.
7. **Clause explorer** - every clause with original text beside the plain-language explanation, why it matters, and a "worth checking" action; filter by attention level and category; expand/collapse.
8. **Document highlighting** - the original document with color-coded highlights per attention level; click any highlight for the side-by-side explanation. Matching uses exact whitespace/case/quote normalization, handles "…" excerpts, and a conservative fuzzy fallback; paraphrased excerpts are never highlighted wrongly.
9. **Red flags** - severity-ranked flags with explanations of the *actual wording* (presence alone is never treated as a problem).
10. **Questions to ask** - practical pre-signing questions with check-off and copy-all.
11. **History** - past analyses are saved on-device in the browser's localStorage (newest 10, individually deletable from the History page). No accounts, no server-side storage: reports live only in your browser.
12. **Save as PDF** - one click on *Save as PDF* exports the full report through the browser's print flow, using a dedicated print-ready report layout.
13. **UX** - serif "legal brief" design system (paper/ink/laurel), hairline rules, strong typography, responsive, print-friendly report.


---

## API (backend)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Service health |
| GET | `/api/meta/limits` | Limits + supported formats (mirrored by the UI) |
| POST | `/api/documents/extract` | Upload `.txt`/`.md`/`.pdf`/`.docx` file → cleaned text + stats (multipart) |
| POST | `/api/documents/validate` | Pasted text → cleaned text + stats (JSON) |

All errors use one envelope: `{"error": {"code", "message", "details"}}`.

## Configuration (backend `.env` - defaults in `backend/app/config.py`)


| `LEXSCOPE_AI_MODEL` | `google/gemini-2.5-flash` | Default Gemini model |
| `LEXSCOPE_AI_TIMEOUT_SECONDS` | `180` | Upstream AI timeout |
| `LEXSCOPE_AI_RATE_LIMIT` | `8/600` | Per-IP AI calls per window (protects your quota) |
| `LEXSCOPE_MAX_FILE_BYTES` | `524288` | Max upload size (512 KB) |
| `LEXSCOPE_MAX_TEXT_CHARS` | `60000` | Max analyzable text length |
| `LEXSCOPE_CORS_ORIGINS` | `*` | Comma-separated origins (lock down for production) |

Security notes: the token lives only in the backend environment (never shipped to the browser, never committed - `.env` is git-ignored). Document content is **never logged**; the AI proxy logs only model names, status codes and timings.

## Tests

```bash
# Backend (24 tests, no network needed)
cd backend && python -m pytest tests/ -q

# Frontend logic: JSON parsing, schema normalization, quote/highlight location, top findings
node scripts/test-logic.mjs

# Live end-to-end: real pipeline → real backend proxy → real Gemini
# (requires a running backend with a working key; uses one analysis of free-tier quota)
node scripts/test-live.mjs

# AI proxy smoke check after deploying
LEXSCOPE_API_BASE=http://localhost:8000 node scripts/smoke-ai.mjs
```


## Adding more formats later (.doc/.rtf are planned)

Write an extractor and register it - routes and schemas stay untouched:

```python
# backend/app/services/extraction.py
def extract_doc(content: bytes) -> str: ...   # legacy Word

EXTRACTORS[".doc"] = extract_doc
```

On the frontend, only `AnalyzePage`'s accepted-file logic needs the new extension.

## Privacy & security posture

- **No server-side document storage and no accounts.** The backend processes each document in memory only and keeps nothing. Past analyses live only in this browser's localStorage on this device (newest 10, deletable from the History page); the in-progress report sits in `sessionStorage` and clears when the tab closes.
- No document content is logged, client or server.
- No API credentials exist in the project.
- The UI explicitly warns users not to paste highly sensitive information.
- The disclaimer is displayed on the landing page, footer, analyzer, and results.

## Known limitations (v1)

- File uploads: `.txt`/`.md`/`.pdf`/`.docx` only - `.doc` and `.rtf` are on the roadmap (extension point ready). Scanned PDFs (page images) and password-protected PDFs can't be read; the error says so and offers the paste fallback.
- Analysis takes ~15-60s for typical documents (single Gemini call; model fallback chain mitigates outages).
- Quote matching can't locate paraphrased (non-verbatim) excerpts; those clauses and flags show *Quote not found* instead of a highlight, and the UI says so.
- English-language documents only (Gemini handles other languages, but the UI copy is English).
- Attention levels are heuristic AI indicators, not legal judgments - stated throughout the UI.

## Demo flow (5 minutes)

1. **Landing page** - point out the tagline, the worked example, and the privacy section ("built to forget your document").
2. Click **Analyze a document** → **Load sample agreement** (a fictional employment contract, included) - or upload a `.pdf`/`.docx` to show extraction.
3. Note the live stats bar, then hit **Analyze document**. Show the staged progress panel.
4. On the report: read the **summary**, then **Top findings** - *"N things to look at before you sign"*. Tap one and watch it jump to the exact sentence in the document.
5. Show the **risk overview** ("attention indicators - not judgments").
6. Open **Clauses** → expand *"Liability and indemnity (uncapped)"* - original text beside plain language, why it matters, what to check, plus the *Verified in document* quote chip. Toggle the *High* filter to show triage.
7. Open **Document** → click the highlighted indemnity passage in the original contract; the explanation appears in the side panel.
8. Open **Red flags** - emphasize the wording-based explanations, the citation badges (*Verified in document* / *Matched approximately* / *Quote not found*), and the "not automatically a problem" note.
9. Open **Questions** → copy all.
10. Hit **Save as PDF** for the print-ready full report, then open **History** - the analysis is there, on-device only, and deletable.
11. Close with the disclaimer card + privacy posture: nothing stored server-side, no API keys, reports live in your browser.

*(Optional offline fallback: `node scripts/test-pipeline.mjs` demonstrates the full analysis pipeline against a recorded Gemini response without any network.)*
