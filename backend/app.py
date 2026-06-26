import os
import json
import asyncio
import tempfile

from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from chunker import extract_text, chunk_text
from embedder import Embedder
from vector_store import VectorStore
from rag_pipeline import RAGPipeline
import yaml


with open("config.yaml") as f:
    cfg = yaml.safe_load(f)


app = FastAPI(title="ShaktiVector RAG")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

embedder = Embedder(cfg["model_name"])
store = VectorStore()
rag = RAGPipeline()

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_FILE_SIZE = 10 * 1024 * 1024


class AskRequest(BaseModel):
    query: str
    k: int = Field(default=None, ge=1, le=50)


@app.get("/")
def root():
    return {"status": "ok", "service": "ShaktiVector RAG"}


@app.get("/health")
def health():
    try:
        store.get_stats()
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "database": "connected" if db_ok else "error"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}. Use PDF, DOCX, or TXT.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large. Max 10MB.")

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        text = extract_text(tmp_path)
        if not text.strip():
            raise HTTPException(400, "File appears to be empty or unreadable.")

        chunks = chunk_text(text, cfg["chunk_size"], cfg["chunk_overlap"])
        doc_id = store.insert_document(file.filename)
        embeddings = [embedder.encode(c["text"]) for c in chunks]
        store.insert_chunks(doc_id, chunks, embeddings)

        return {"doc_id": doc_id, "filename": file.filename, "chunks": len(chunks)}
    finally:
        os.unlink(tmp_path)


@app.post("/upload/debug")
async def upload_file_debug(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}. Use PDF, DOCX, or TXT.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large. Max 10MB.")

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        text = extract_text(tmp_path)
        if not text.strip():
            raise HTTPException(400, "File appears to be empty or unreadable.")

        chunks = chunk_text(text, cfg["chunk_size"], cfg["chunk_overlap"])
        doc_id = store.insert_document(file.filename)

        chunk_details = []
        for i, c in enumerate(chunks):
            emb = embedder.encode(c["text"])
            chunk_details.append({
                "index": c["index"],
                "word_count": len(c["text"].split()),
                "char_count": len(c["text"]),
                "text_preview": c["text"][:200],
                "embedding_preview": [round(v, 6) for v in emb[:4]],
                "embedding_dimensions": len(emb),
            })

        embeddings = [embedder.encode(c["text"]) for c in chunks]
        store.insert_chunks(doc_id, chunks, embeddings)

        return {
            "doc_id": doc_id,
            "filename": file.filename,
            "total_chunks": len(chunks),
            "pipeline": {
                "extraction": {
                    "input_format": ext,
                    "input_size": len(contents),
                    "output_chars": len(text),
                    "output_words": len(text.split()),
                },
                "chunking": {
                    "strategy": "recursive",
                    "chunk_size": cfg["chunk_size"],
                    "chunk_overlap": cfg["chunk_overlap"],
                    "chunks": chunk_details,
                },
                "embedding": {
                    "model": cfg["model_name"],
                    "dimensions": 384,
                    "vectors_created": len(chunks),
                },
                "storage": {
                    "database": "shaktivector",
                    "table": "chunks",
                    "doc_id": doc_id,
                    "columns": ["doc_id", "chunk_index", "chunk_text", "embedding (BYTEA)"],
                },
            },
        }
    finally:
        os.unlink(tmp_path)


@app.post("/ask")
def ask(req: AskRequest):
    if not req.query.strip():
        raise HTTPException(400, "Query cannot be empty.")

    result = rag.answer(req.query, req.k)
    store.save_conversation(req.query, result["answer"], result["sources"])
    return result


class DebugAskRequest(BaseModel):
    query: str
    k: int = Field(default=None, ge=1, le=50)


@app.post("/ask/debug")
def ask_debug(req: DebugAskRequest):
    if not req.query.strip():
        raise HTTPException(400, "Query cannot be empty.")

    result = rag.debug_answer(req.query, req.k)
    store.save_conversation(req.query, result["answer"], result["sources"])
    return result


@app.post("/ask/stream")
async def ask_stream(req: AskRequest):
    if not req.query.strip():
        raise HTTPException(400, "Query cannot be empty.")

    async def event_generator():
        loop = asyncio.get_event_loop()
        gen = rag.answer_stream(req.query, req.k)
        try:
            while True:
                event = await loop.run_in_executor(None, next, gen)
                if "token" in event and event["token"]:
                    yield f"data: {json.dumps({'token': event['token']})}\n\n"
                if event.get("done"):
                    src = event.get("sources", [])
                    yield f"data: {json.dumps({'sources': src})}\n\n"
                    yield "data: [DONE]\n\n"
                    return
        except StopIteration:
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/suggestions")
def get_suggestions():
    import psycopg2
    with open("config.yaml") as f:
        db_cfg = yaml.safe_load(f)["shaktidb"]
    conn = psycopg2.connect(host=db_cfg["host"], port=db_cfg["port"], database=db_cfg["database"], user=db_cfg["user"], password=db_cfg["password"])
    cur = conn.cursor()
    cur.execute("SELECT id, filename FROM documents ORDER BY upload_date DESC LIMIT 1")
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return {"suggestions": []}

    chunks = store.get_document_chunks(row[0])
    if not chunks:
        return {"suggestions": []}

    preview = " ".join(c["text"] for c in chunks[:3])[:2000]
    prompt = (
        "Based on the following document content, generate 3 specific questions someone might ask about it. "
        "Return ONLY the questions as a JSON array of strings, nothing else.\n\n"
        f"Document content:\n{preview[:2000]}\n\nQuestions:"
    )

    try:
        resp = rag._call_llm(prompt)
        questions = json.loads(resp.strip())
        if isinstance(questions, list) and len(questions) <= 10:
            return {"suggestions": questions[:5]}
    except Exception:
        pass

    return {"suggestions": [
        "What is the main topic of this document?",
        "What are the key points mentioned?",
        "Can you summarize this document?",
    ]}


@app.get("/config")
def get_config():
    with open("config.yaml") as f:
        c = yaml.safe_load(f)
    return {
        "llm_provider": c["llm"]["provider"],
        "llm_model": c["llm"]["ollama_model"],
        "chunk_size": c["chunk_size"],
        "chunk_overlap": c["chunk_overlap"],
        "top_k": c.get("top_k", 3),
    }


class ConfigUpdate(BaseModel):
    llm_provider: str = None
    llm_model: str = None
    groq_api_key: str = None
    chunk_size: int = None
    chunk_overlap: int = None
    top_k: int = None


@app.put("/config")
def update_config(update: ConfigUpdate):
    with open("config.yaml") as f:
        c = yaml.safe_load(f)
    if update.llm_provider is not None:
        c["llm"]["provider"] = update.llm_provider
    if update.llm_model is not None:
        c["llm"]["ollama_model"] = update.llm_model
        c["llm"]["groq_model"] = update.llm_model
    if update.groq_api_key is not None:
        c["llm"]["groq_api_key"] = update.groq_api_key
    if update.chunk_size is not None:
        c["chunk_size"] = update.chunk_size
    if update.chunk_overlap is not None:
        c["chunk_overlap"] = update.chunk_overlap
    if update.top_k is not None:
        c["top_k"] = update.top_k
        rag.top_k = update.top_k
    with open("config.yaml", "w") as f:
        yaml.dump(c, f)
    return {"status": "ok", **get_config()}


@app.get("/search")
def search(q: str = Query(..., min_length=1), k: int = Query(3, ge=1, le=20)):
    query_vec = embedder.encode(q)
    results = store.search(query_vec, k)
    return [
        {"doc_name": r["doc_name"], "text": r["text"][:200], "score": round(score, 4)}
        for score, r in results
    ]


@app.get("/documents")
def list_documents():
    import psycopg2
    with open("config.yaml") as f:
        cfg = yaml.safe_load(f)["shaktidb"]
    conn = psycopg2.connect(host=cfg["host"], port=cfg["port"], database=cfg["database"], user=cfg["user"], password=cfg["password"])
    cur = conn.cursor()
    cur.execute("SELECT id, filename, total_chunks FROM documents ORDER BY upload_date DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [{"id": r[0], "filename": r[1], "chunks": r[2]} for r in rows]


@app.get("/documents/{doc_id}/text")
def get_document_text(doc_id: int):
    chunks = store.get_document_chunks(doc_id)
    if not chunks:
        raise HTTPException(404, "Document not found")
    full_text = "\n".join(c["text"] for c in chunks)
    return {"doc_id": doc_id, "chunks": chunks, "full_text": full_text}


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: int):
    try:
        store.delete_document(doc_id)
    except Exception:
        raise HTTPException(404, "Document not found")
    return {"deleted": True}


@app.get("/history")
def get_history(limit: int = Query(20, ge=1, le=100)):
    return store.get_history(limit)
