# ShaktiVector RAG — Sovereign Document Intelligence System

## 1. Project Overview

ShaktiVector RAG is a Retrieval-Augmented Generation (RAG) system that uses **ShaktiDB as a native vector store** to enable document-based question answering. Documents are chunked, embedded using transformer models, and stored in ShaktiDB as BLOBs alongside their text chunks. User queries are embedded, matched against stored vectors via cosine similarity, and the retrieved context is fed to an LLM for grounded, source-cited answers.

The project proves that ShaktiDB — India's sovereign indigenous database — can serve as a vector database for AI workloads without requiring external vector DBs like Pinecone, Chroma, or Weaviate.

---

## 2. Problem Statement / Motivation

- **Sovereignty requirement:** Government and PSU projects mandate Indian databases. If ShaktiDB can handle vector search, it eliminates the need to import foreign vector DBs.
- **Single-stack simplicity:** Using one DB for structured data + vectors removes ETL pipelines between systems.
- **Practical use case:** Colleges, departments, and offices have hundreds of documents (circulars, policies, project reports) stored in databases. A native search-and-Q&A capability is genuinely useful.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                      │
│  Upload Panel  ·  Chat Panel  ·  Source Cards  ·  Preview   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / JSON
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI)                    │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌─────────┐  │
│  │ Chunker  │  │ Embedder │  │ RAG Pipe   │  │ Vector  │  │
│  │ (split)  │─▶│ (encode) │──▶│ (retrieve  │──▶│ Store   │  │
│  │          │  │          │  │  + prompt) │  │ (CRUD)  │  │
│  └──────────┘  └──────────┘  └─────┬──────┘  └────┬────┘  │
│                                    │              │        │
│                                    ▼              ▼        │
│                            ┌──────────┐    ┌──────────┐    │
│                            │   LLM    │    │ ShaktiDB │    │
│                            │(Ollama / │    │(vectors, │    │
│                            │ Groq API)│    │ chunks,  │    │
│                            │          │    │  docs)   │    │
│                            └──────────┘    └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend | Python 3.10+ · FastAPI · uvicorn | API server |
| Frontend | React 18 · Vite · Tailwind CSS | User interface |
| Database | ShaktiDB | Vector + document storage |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2, 384-dim) | Text → vector |
| LLM | Ollama (local) or Groq/OpenAI API | Answer generation |
| Document parsing | PyMuPDF (pdfplumber), python-docx, txt | File → text |
| Other | Git, pip, npm, Postman | Tooling |

---

## 5. System Design — Data Flow

### 5.1 Document Ingestion
```
Upload PDF/DOCX/TXT
       │
       ▼
Extract raw text (PyMuPDF / python-docx)
       │
       ▼
Recursive chunking (chunk_size=512, overlap=50)
       │
       ▼
Embed each chunk → [0.23, -0.45, ... 384 floats]
       │
       ▼
Store in ShaktiDB:
  - documents table: id, filename, upload_date
  - chunks table: id, doc_id, chunk_index, text, embedding (BLOB)
```

### 5.2 Query Flow
```
User types question
       │
       ▼
Embed query → vector q
       │
       ▼
Load all stored embeddings from ShaktiDB
Compute cosine similarity: q · chunk_v / (|q| * |chunk_v|)
Return top-K chunks (K=3) with scores
       │
       ▼
Build prompt:
  "Context:\n{chunk1}\n{chunk2}\n{chunk3}\n\n
   Question: {query}\n\nAnswer with sources:"
       │
       ▼
Send to LLM (Ollama or Groq)
       │
       ▼
Return answer + source list to frontend
```

### 5.3 Storage Schema (ShaktiDB)

```sql
CREATE TABLE documents (
    id INTEGER PRIMARY KEY,
    filename TEXT NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_chunks INTEGER DEFAULT 0
);

CREATE TABLE chunks (
    id INTEGER PRIMARY KEY,
    doc_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding BLOB NOT NULL,        -- 384 float32 values (1536 bytes)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversations (
    id INTEGER PRIMARY KEY,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    sources TEXT,                    -- JSON array of {doc, chunk, score}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_chunks_doc_id ON chunks(doc_id);
CREATE INDEX idx_conversations_created ON conversations(created_at);
```

---

## 6. Module Breakdown

| Module | File | Lines | Responsibility |
|--------|------|-------|---------------|
| **Chunker** | chunker.py | ~50 | Recursive text splitter with configurable chunk size and overlap. Handles PDF/DOCX/TXT extraction internally or via external parser. |
| **Embedder** | embedder.py | ~60 | Loads sentence-transformers model once (singleton). Provides `encode(text)` returning 384-dim list. In-memory cache for repeated texts. |
| **Vector Store** | vector_store.py | ~100 | All ShaktiDB interactions: init schema, insert document/chunks, retrieve all embeddings for search, delete document cascade. |
| **RAG Pipeline** | rag_pipeline.py | ~60 | Orchestrates: embed query → vector search → build prompt → call LLM → parse response → return answer + sources. |
| **API Layer** | app.py | ~80 | FastAPI app with 4 endpoints. CORS configured for frontend. Error handling on all routes. |
| **Config** | config.yaml | ~20 | Model name, chunk params, ShaktiDB connection, LLM endpoint, K value. |
| **Frontend — Layout** | App.jsx | ~50 | Main layout with sidebar + chat area + document preview panel. |
| **Frontend — Chat** | ChatPanel.jsx | ~80 | Message bubbles, input bar, streaming-like response display, source cards. |
| **Frontend — Sidebar** | Sidebar.jsx | ~60 | Upload button, document list with chunk counts, drag-reorder, delete. |
| **Frontend — Components** | SourceCard.jsx, Preview.jsx, etc. | ~70 | Reusable UI components. |
| **Frontend — Hooks** | hooks/useAPI.js | ~40 | fetch() wrappers for all API calls. |
| **Total** | | **~670** | |

---

## 7. API Endpoints

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| POST | `/upload` | Upload and index a document | `multipart/form-data` file | `{ doc_id, filename, chunks }` |
| GET | `/search?q=...&k=3` | Vector search only (no LLM) | Query string, optional k | `[{ chunk_text, doc_name, score }]` |
| POST | `/ask` | Full RAG query | `{ query, k (optional) }` | `{ answer, sources }` |
| GET | `/documents` | List all indexed documents | — | `[{ id, filename, chunk_count, date }]` |
| DELETE | `/documents/{id}` | Delete document + chunks | Path param | `{ deleted: true }` |
| GET | `/history` | Recent conversation history | Optional `limit` | `[{ query, response, sources, date }]` |

---

## 8. RAG Pipeline Detail

```
1. User sends POST /ask with {"query": "What are the eligibility criteria?"}

2. Embedder.encode(query) → q_vec (list of 384 floats)

3. Vector store loads ALL chunk embeddings from ShaktiDB
   For each chunk_v in embeddings:
       similarity = dot(q_vec, chunk_v) / (norm(q_vec) * norm(chunk_v))
   Sort descending → take top-K

4. Build prompt:
   System: "You are a helpful assistant. Answer the question based only on the provided context. Cite the source document name for each fact."
   User:   "Context:\n---\n{chunk1_text}\n(Source: {doc1_name})\n---\n{chunk2_text}\n(Source: {doc2_name})\n---\n{chunk3_text}\n(Source: {doc3_name})\n\nQuestion: {query}\n\nAnswer:"

5. Send prompt to LLM (Ollama on localhost:11434 or Groq API)

6. Parse LLM response → extract answer text + identify which sources were cited

7. Return:
   {
     "answer": "Eligibility requires a minimum CGPA of 6.5 and completion of all core courses...",
     "sources": [
       {"doc_name": "academic_policy.pdf", "chunk_index": 4, "similarity": 0.91},
       {"doc_name": "program_handbook.pdf", "chunk_index": 12, "similarity": 0.87}
     ]
   }
```

---

## 9. Frontend UI Layout

```
┌────────────────────────────────────────────────────────────────┐
│  🛡️ ShaktiVector RAG                     [New Chat]  [⏎]     │
├───────────────┬────────────────────────────────────────────────┤
│ 📚 Documents   │  💬 Conversation                            │
│               │                                               │
│  ┌─────────┐  │  ┌─────────────────────────────────────────┐ │
│  │ + Upload │  │  │ You: What is the refund policy?        │ │
│  └─────────┘  │  │                                         │ │
│               │  │ ┌─────────────────────────────────────┐ │ │
│  ☐ policy.pdf │  │ │ The refund policy states that full  │ │ │
│    12 chunks  │  │ │ refund is available within 30 days  │ │ │
│               │  │ │ of purchase.                        │ │ │
│  ☐ handbook   │  │ │                                     │ │ │
│     8 chunks  │  │ │ Sources:                            │ │ │
│               │  │ │ ┌──────────────────────────┐        │ │ │
│  ☐ report.pdf │  │ │ │ 📄 policy.pdf — 94%      │        │ │ │
│    27 chunks  │  │ │ │ "Full refund within 30   │        │ │ │
│               │  │ │ │  days of purchase..."     │        │ │ │
│  [Delete All] │  │ │ └──────────────────────────┘        │ │ │
│               │  │ └─────────────────────────────────────┘ │ │
│               │  │                                         │ │
│               │  │ ┌─────────────────────────────────────┐ │ │
│               │  │ │ You: What about partial refunds?   │ │ │
│               │  │ └─────────────────────────────────────┘ │ │
│               │  │ ┌─────────────────────────────────────┐ │ │
│               │  │ │ Partial refunds are available...    │ │ │
│               │  │ └─────────────────────────────────────┘ │ │
│               │  │                                         │ │
│               │  │ ┌──────────────────────────────┐        │ │
│               │  │ │ Ask a question...     [Send] │        │ │
│               │  │ └──────────────────────────────┘        │ │
├───────────────┴────────────────────────────────────────────────┤
│  3 documents  ·  47 chunks  ·  19 queries today               │
└────────────────────────────────────────────────────────────────┘
```

---

## 10. Directory Structure

```
ShaktiVector RAG/
├── backend/
│   ├── app.py              # FastAPI entry point
│   ├── chunker.py          # Document chunking logic
│   ├── embedder.py         # Model wrapper
│   ├── vector_store.py     # ShaktiDB operations
│   ├── rag_pipeline.py     # Retrieve + prompt + call LLM
│   ├── config.yaml         # Settings
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main layout
│   │   ├── App.css         # Tailwind + custom styles
│   │   ├── components/
│   │   │   ├── ChatPanel.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── SourceCard.jsx
│   │   │   ├── MessageBubble.jsx
│   │   │   ├── UploadZone.jsx
│   │   │   └── Preview.jsx
│   │   └── hooks/
│   │       └── useAPI.js
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
└── PROJECT.md               # This file
```

---

## 11. Setup & Running

### Prerequisites
- Python 3.10+
- Node.js 18+
- ShaktiDB installed and running
- Ollama (optional, for local LLM) or Groq API key

### Backend
```bash
cd backend
pip install -r requirements.txt
# Edit config.yaml with your ShaktiDB connection
python app.py
# → http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Quick Test
```bash
curl -X POST http://localhost:8000/upload -F "file=@test.pdf"
curl -X POST http://localhost:8000/ask -H "Content-Type: application/json" -d '{"query": "What is this document about?"}'
```

---

## 12. Project Build Tracker

The project is split into sequential parts based on development flow. Mark each as **[✓ DONE]** when completed.

### Phase A: Foundation

- [✓] **A1 — Project scaffolding**
  - Initialize backend (Python venv, requirements.txt, app.py skeleton)
  - Initialize frontend (Vite + React + Tailwind, clean App.jsx)
  - Create directory structure as defined in Section 10
  - Git init with .gitignore (Python + Node)
- [✓] **A2 — ShaktiDB setup & schema**
  - ShaktiDB running in distrobox container (shakti-env)
  - User `shaktidb` created, database `shaktivector` created
  - Schema init script (init_db.py) with 3 tables + indexes
  - Tables verified: documents, chunks, conversations

### Phase B: Backend Core

- [✓] **B1 — Document chunker**
  - Implement `chunker.py`: extract text from PDF (PyMuPDF), DOCX, TXT
  - Recursive chunking with configurable chunk_size and overlap
  - Return list of chunk dicts with index and text
  - Test with sample files of each format
- [✓] **B2 — Embedding service**
  - Implement `embedder.py`: load sentence-transformers model (singleton)
  - `encode(text)` → 384-dim list of floats
  - In-memory cache for repeated texts (dict)
  - Test: encode a string, verify output shape and normalization
- [✓] **B3 — Vector store (ShaktiDB operations)**
  - Implement `vector_store.py`:
    - `insert_document(filename)` → doc_id
    - `insert_chunks(doc_id, chunks, embeddings)` → bulk insert
    - `get_all_chunks()` → list of (id, text, embedding, doc_name)
    - `delete_document(doc_id)` → cascade delete
    - `get_stats()` → doc count, chunk count, query count
  - Test each function with asserts
- [✓] **B4 — Cosine similarity search**
  - Implemented `search(query_vec, k)` inside vector_store.py
  - Uses numpy dot product on normalized embeddings
  - Returns top-K results with scores + doc names
  - Tested with known embeddings, correct ranking order verified
- [✓] **B5 — RAG pipeline**
  - Implement `rag_pipeline.py`:
    - `answer(query, k=3)` → embed → search → build prompt → call LLM → parse response
    - Prompt template: system + context + question
    - Support Ollama (default) and Groq API (config switch)
    - Parse LLM output to extract answer + cited sources
  - Test: hardcoded context → verify LLM returns grounded answer
- [✓] **B6 — API layer**
  - Implement `app.py` with FastAPI:
    - `POST /upload` — receives file, calls chunker → embedder → vector_store
    - `POST /ask` — receives query, calls RAG pipeline, saves to conversations table
    - `GET /search` — direct vector search without LLM
    - `GET /documents` — list indexed docs
    - `DELETE /documents/{id}` — delete doc + chunks
    - `GET /history` — recent conversation history
  - Add CORS middleware, error handlers, request validation
  - Test all endpoints via TestClient — all passing

### Phase C: Frontend Core

- [✓] **C1 — Main layout**
  - Three-panel layout (sidebar, chat, preview) using CSS Grid
  - Sticky header with title + new chat button + dark mode toggle
  - Sticky footer status bar
  - Responsive behavior (sidebar collapses at md, preview at xl)
- [✓] **C2 — Sidebar component**
  - Upload zone with drag-drop + click (accepts .pdf, .docx, .txt)
  - File upload progress bar (animated)
  - Document list with file icon, chunk count badge, delete on hover
  - Delete All button with confirmation
  - Empty state
  - Calls `POST /upload`, `GET /documents`, `DELETE /documents/{id}` via useAPI hook
- [✓] **C3 — Chat panel component**
  - Message history area with auto-scroll
  - User message bubbles (right, indigo) and AI bubbles (left, white)
  - Typing indicator (three bouncing dots) while waiting for response
  - Input bar with auto-growing textarea + send button
  - Enter to send, Shift+Enter for newline
  - Calls `POST /ask` and displays response with sources
- [✓] **C4 — Source cards & document preview**
  - Source cards below each AI answer with:
    - File name, chunk index
    - Similarity bar (animated gradient, emerald→red)
    - Snippet text (first 200 chars)
    - Hover lift effect (translateY + shadow)
  - Click source card → opens preview panel with:
    - Full document text with matched chunk highlighted in yellow
    - Skeleton loading state
    - Close button
  - GET `/documents/{id}/text` endpoint returning ordered chunks with text
  - Sources include `doc_id` and `chunk_index` for preview linkage

### Phase D: Polish & Integration

- [✓] **D1 — Dark mode**
  - Toggle in header (sun/moon icon) with smooth transition
  - Persist preference in localStorage
  - Correct colors for all components (sidebar, chat, cards, input, toasts)
- [✓] **D2 — Animations & loading states**
  - Message fadeIn animation (300ms)
  - Similarity bar width animation (500ms)
  - Preview panel slideIn (250ms)
  - Skeleton loaders for document list (shimmer animation)
  - Toast notifications (slideDown, success green / error red, auto-dismiss 3s)
  - Typing indicator (bouncing dots)
- [✓] **D3 — Error handling & edge cases**
  - File too large error (>10MB client-side validation)
  - Unsupported file format error
  - API errors shown as toast notifications + inline fallback message
  - Empty query validation (button disabled)
  - No documents → graceful empty state in sidebar + chat
- [✓] **D4 — Responsive design**
  - Three-panel layout at >1280px
  - Preview panel visible at all sizes via state toggle
  - Mobile hamburger menu for sidebar with overlay backdrop
  - Touch-friendly targets on all interactive elements

### Phase E: Demo Ready

- [✓] **E1 — Sample documents**
  - 3 realistic sample PDFs created: academic_policy.pdf, project_guidelines.pdf, hostel_rules.pdf
  - Contains realistic academic content with placement, refund, grading, project, hostel rules
- [✓] **E2 — End-to-end test**
  - All 3 docs uploaded and verified (3 chunks total)
  - 6 questions asked, all 6 correctly answered with proper source attribution
  - Conversation history verified (6 entries)
  - Search endpoint verified
- [✓] **E3 — Final cleanup**
  - No debug logs or console.log in source code
  - All 38 backend tests passing
  - Frontend builds without errors
  - PROJECT.md fully updated with accurate build status

### Summary

```
Phase A: [✓] / 2  — Foundation
Phase B: [✓] / 6  — Backend Core
Phase C: [✓] / 4  — Frontend Core
Phase D: [✓] / 4  — Polish & Integration
Phase E: [✓] / 3  — Demo Ready
Total:   [✓] / 19 parts
```

---

## 13. UI/UX Design Specifications

The frontend must deliver a polished, modern, demo-ready experience. Every visual element must look intentional.

### 13.1 Color Palette

| Role | Color | Hex |
|------|-------|-----|
| Primary | Indigo | `#4F46E5` |
| Primary hover | Darker indigo | `#4338CA` |
| Background | Off-white | `#F8FAFC` |
| Surface | White | `#FFFFFF` |
| Text primary | Dark gray | `#1E293B` |
| Text secondary | Medium gray | `#64748B` |
| Success (source match) | Emerald | `#10B981` |
| Border | Light gray | `#E2E8F0` |
| Dark mode bg | Slate-900 | `#0F172A` |
| Dark mode surface | Slate-800 | `#1E293B` |

### 13.2 Layout Specifications

- **Three-panel layout:**
  - Left sidebar: 300px fixed width, scrollable document list
  - Center: Flex-grow chat area with max-width 800px centered
  - Right preview panel: 400px, slides in on source card click, slides out on close
- **Responsive:** Below 1024px, preview panel becomes modal overlay. Below 768px, sidebar collapses to hamburger.
- **Sticky header:** Always visible, shows project name + new chat button + dark mode toggle
- **Sticky footer:** Status bar showing doc/chunk/query counts

### 13.3 Chat Panel Specifications

- **Message bubbles:**
  - User: right-aligned, indigo background, white text, rounded-2xl, no shadow
  - AI: left-aligned, white background (surface), dark text, rounded-2xl, subtle shadow
  - Max width 75% of container, auto-wrapped
  - Each AI bubble has a small "ShaktiVector" avatar/icon on the left
  - Each user bubble has a subtle "You" label
- **Auto-scroll:** Chat auto-scrolls to bottom on new message. If user scrolled up, show a floating "↓ New message" button.
- **Typing indicator:** Three bouncing dots in an AI bubble while response is loading. Smooth fade-in/out.
- **Input bar:**
  - Fixed at bottom, full width, rounded-2xl border
  - Textarea (auto-growing, 1-4 lines) with placeholder "Ask a question..."
  - Send button: filled indigo circle with arrow icon, disabled when empty
  - Keyboard shortcut: Enter to send, Shift+Enter for newline

### 13.4 Source Card Specifications

Each source card appears below the AI answer (not inline):

```
┌─────────────────────────────────────────────────┐
│ 📄 policy.pdf  ·  Chunk 4                        │
│ ████████████████████░░░░░  94% match             │
│ "Full refund is available within 30 days of      │
│  purchase for all eligible products..."           │
│ [View in document →]                             │
└─────────────────────────────────────────────────┘
```

- **Similarity bar:** Horizontal gradient bar (emerald → yellow → red for 100%→0%). Animated width on render.
- **Click behavior:** Clicking the card opens the right preview panel. The exact chunk text is highlighted in yellow in the document preview.
- **Hover:** Slight lift effect (translateY(-2px) + shadow increase). Cursor pointer.
- **Max 3 cards** shown. If more match, show "+N more" expandable link.

### 13.5 Sidebar Specifications

- **Upload zone:**
  - Dashed border box with cloud upload icon
  - Drag-over state: border turns indigo, background light indigo tint
  - Click to open file picker (accepts .pdf, .docx, .txt)
  - Upload progress: animated indeterminate bar while processing
  - Success toast: green pill notification "indexed 12 chunks"
  - Error toast: red pill notification with message
- **Document list:**
  - Each item: filename with filetype icon, chunk count badge
  - Checkbox for selection (select all at top)
  - Drag handle (⋮⋮) for reorder — drag re-prioritizes search
  - Delete button (trash icon) on hover, with confirmation modal
  - "Delete All" button at bottom with confirmation
- **Empty state:** Illustration + "Upload a document to get started" text

### 13.6 Dark Mode

- Toggle in header (sun/moon icon)
- Smooth transition (CSS `transition` on background and text colors, 300ms ease)
- Persists in localStorage
- Affects: all backgrounds, surfaces, borders, text, input fields, toast notifications
- Chat bubbles invert: AI bubble becomes slate-800, user bubble remains indigo

### 13.7 Animations & Transitions

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Message appear | Fade in + slide up 8px | 300ms | ease-out |
| Source card appear | Staggered fade (50ms delay each) | 200ms | ease-out |
| Sidebar toggle | Slide left/right | 250ms | ease-in-out |
| Preview panel | Slide right | 250ms | ease-out |
| Dark mode | All color transitions | 300ms | ease |
| Upload success | Toast slide down from top | 400ms | ease-out |
| Similarity bar | Width from 0 to final | 500ms | ease-out |
| Button hover | Slight scale (1.02) | 150ms | ease |
| Focus ring | Box-shadow glow | 200ms | ease |

### 13.8 Loading & Error States

- **Loading:** Skeleton loaders (animated shimmer) for document list. Spinner overlay for upload. Typing dots for chat.
- **Error:** Red toast notification. API errors shown as inline red text below input bar. Retry button on failed requests.
- **Empty:** Friendly illustrations (undraw.co style) for empty document list, empty chat.
- **File too large:** Immediate validation before upload, show error "Max file size: 10MB"
- **Unsupported format:** Show error with supported formats listed

### 13.9 Responsiveness

| Breakpoint | Behavior |
|------------|----------|
| >1280px | Full three-panel layout |
| 1024-1280px | Preview panel overlays on right as drawer |
| 768-1024px | Sidebar collapsible (hamburger), preview as modal |
| <768px | Single column: chat full width, sidebar as drawer, preview as full-screen modal |

### 13.10 Visual Polish Checklist

- [ ] Consistent 4px border radius across all cards and buttons
- [ ] System font stack (Inter or system-ui)
- [ ] Smooth scrollbar styling (thin, rounded thumb)
- [ ] No layout shift on page load (fixed dimensions for dynamic content)
- [ ] Focus states on all interactive elements (keyboard accessible)
- [ ] Hover states on all clickable elements
- [ ] Loading skeleton matches final layout dimensions exactly
- [ ] Toast notifications auto-dismiss after 3 seconds
- [ ] Source cards have subtle left border color-coded by document
- [ ] Backend error messages shown in human-readable format (not raw JSON)

---

## 15. Key Design Decisions

The frontend must deliver a polished, modern, demo-ready experience. Every visual element must look intentional.

### 12.1 Color Palette

| Role | Color | Hex |
|------|-------|-----|
| Primary | Indigo | `#4F46E5` |
| Primary hover | Darker indigo | `#4338CA` |
| Background | Off-white | `#F8FAFC` |
| Surface | White | `#FFFFFF` |
| Text primary | Dark gray | `#1E293B` |
| Text secondary | Medium gray | `#64748B` |
| Success (source match) | Emerald | `#10B981` |
| Border | Light gray | `#E2E8F0` |
| Dark mode bg | Slate-900 | `#0F172A` |
| Dark mode surface | Slate-800 | `#1E293B` |

### 12.2 Layout Specifications

- **Three-panel layout:**
  - Left sidebar: 300px fixed width, scrollable document list
  - Center: Flex-grow chat area with max-width 800px centered
  - Right preview panel: 400px, slides in on source card click, slides out on close
- **Responsive:** Below 1024px, preview panel becomes modal overlay. Below 768px, sidebar collapses to hamburger.
- **Sticky header:** Always visible, shows project name + new chat button + dark mode toggle
- **Sticky footer:** Status bar showing doc/chunk/query counts

### 12.3 Chat Panel Specifications

- **Message bubbles:**
  - User: right-aligned, indigo background, white text, rounded-2xl, no shadow
  - AI: left-aligned, white background (surface), dark text, rounded-2xl, subtle shadow
  - Max width 75% of container, auto-wrapped
  - Each AI bubble has a small "ShaktiVector" avatar/icon on the left
  - Each user bubble has a subtle "You" label
- **Auto-scroll:** Chat auto-scrolls to bottom on new message. If user scrolled up, show a floating "↓ New message" button.
- **Typing indicator:** Three bouncing dots in an AI bubble while response is loading. Smooth fade-in/out.
- **Input bar:**
  - Fixed at bottom, full width, rounded-2xl border
  - Textarea (auto-growing, 1-4 lines) with placeholder "Ask a question..."
  - Send button: filled indigo circle with arrow icon, disabled when empty
  - Keyboard shortcut: Enter to send, Shift+Enter for newline

### 12.4 Source Card Specifications

Each source card appears below the AI answer (not inline):

```
┌─────────────────────────────────────────────────┐
│ 📄 policy.pdf  ·  Chunk 4                        │
│ ████████████████████░░░░░  94% match             │
│ "Full refund is available within 30 days of      │
│  purchase for all eligible products..."           │
│ [View in document →]                             │
└─────────────────────────────────────────────────┘
```

- **Similarity bar:** Horizontal gradient bar (emerald → yellow → red for 100%→0%). Animated width on render.
- **Click behavior:** Clicking the card opens the right preview panel. The exact chunk text is highlighted in yellow in the document preview.
- **Hover:** Slight lift effect (translateY(-2px) + shadow increase). Cursor pointer.
- **Max 3 cards** shown. If more match, show "+N more" expandable link.

### 12.5 Sidebar Specifications

- **Upload zone:**
  - Dashed border box with cloud upload icon
  - Drag-over state: border turns indigo, background light indigo tint
  - Click to open file picker (accepts .pdf, .docx, .txt)
  - Upload progress: animated indeterminate bar while processing
  - Success toast: green pill notification "indexed 12 chunks"
  - Error toast: red pill notification with message
- **Document list:**
  - Each item: filename with filetype icon, chunk count badge
  - Checkbox for selection (select all at top)
  - Drag handle (⋮⋮) for reorder — drag re-prioritizes search
  - Delete button (trash icon) on hover, with confirmation modal
  - "Delete All" button at bottom with confirmation
- **Empty state:** Illustration + "Upload a document to get started" text

### 12.6 Dark Mode

- Toggle in header (sun/moon icon)
- Smooth transition (CSS `transition` on background and text colors, 300ms ease)
- Persists in localStorage
- Affects: all backgrounds, surfaces, borders, text, input fields, toast notifications
- Chat bubbles invert: AI bubble becomes slate-800, user bubble remains indigo

### 12.7 Animations & Transitions

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Message appear | Fade in + slide up 8px | 300ms | ease-out |
| Source card appear | Staggered fade (50ms delay each) | 200ms | ease-out |
| Sidebar toggle | Slide left/right | 250ms | ease-in-out |
| Preview panel | Slide right | 250ms | ease-out |
| Dark mode | All color transitions | 300ms | ease |
| Upload success | Toast slide down from top | 400ms | ease-out |
| Similarity bar | Width from 0 to final | 500ms | ease-out |
| Button hover | Slight scale (1.02) | 150ms | ease |
| Focus ring | Box-shadow glow | 200ms | ease |

### 12.8 Loading & Error States

- **Loading:** Skeleton loaders (animated shimmer) for document list. Spinner overlay for upload. Typing dots for chat.
- **Error:** Red toast notification. API errors shown as inline red text below input bar. Retry button on failed requests.
- **Empty:** Friendly illustrations (undraw.co style) for empty document list, empty chat.
- **File too large:** Immediate validation before upload, show error "Max file size: 10MB"
- **Unsupported format:** Show error with supported formats listed

### 12.9 Responsiveness

| Breakpoint | Behavior |
|------------|----------|
| >1280px | Full three-panel layout |
| 1024-1280px | Preview panel overlays on right as drawer |
| 768-1024px | Sidebar collapsible (hamburger), preview as modal |
| <768px | Single column: chat full width, sidebar as drawer, preview as full-screen modal |

### 12.10 Visual Polish Checklist

- [ ] Consistent 4px border radius across all cards and buttons
- [ ] System font stack (Inter or system-ui)
- [ ] Smooth scrollbar styling (thin, rounded thumb)
- [ ] No layout shift on page load (fixed dimensions for dynamic content)
- [ ] Focus states on all interactive elements (keyboard accessible)
- [ ] Hover states on all clickable elements
- [ ] Loading skeleton matches final layout dimensions exactly
- [ ] Toast notifications auto-dismiss after 3 seconds
- [ ] Source cards have subtle left border color-coded by document
- [ ] Backend error messages shown in human-readable format (not raw JSON)

---

## 14. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Brute-force cosine search (O(n)) | Fine for demo-scale (<100K chunks). Shows the concept without premature optimization. |
| Embeddings stored as BLOB (1536 bytes each) | ShaktiDB handles BLOBs natively. No external object store needed. |
| sentence-transformers over OpenAI | Works offline, no API cost, sovereign-friendly. |
| Recursive chunking (512/50) | Balances context richness with precision. Adjustable in config. |
| Source cards on every answer | The core RAG value proposition — traceability. Makes the demo transparent and trustworthy. |
| No auth system | Out of scope for MVP. Can be added as middleware later. |

---

## 15. Future Enhancements (Out of Scope for v1)

- **Approximate Nearest Neighbor (ANN)** — IVF or product quantization for scale
- **Multi-user auth** — Private document vaults per user
- **Batch upload** — Bulk index entire folders
- **Streaming responses** — Token-by-token LLM output
- **Document classification** — Auto-tagging by content
- **PDF Q&A with page references** — Visual page highlighting in embedded PDF viewer

---

## 16. Why This Matters

> "Because ShaktiDB is the sovereign Indian database — we're proving it doesn't need foreign components to do vector search."

This project demonstrates that ShaktiDB can serve as a complete backend for modern AI applications: storing structured data, unstructured text, and high-dimensional vectors in a single database. No Pinecone, no Chroma, no Weaviate. Just ShaktiDB.
