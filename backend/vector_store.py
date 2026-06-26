import yaml
import psycopg2
from psycopg2 import pool
from psycopg2 import extras
import numpy as np
import struct


def _load_config():
    with open("config.yaml") as f:
        return yaml.safe_load(f)


_cfg = _load_config()["shaktidb"]
_conn_pool = pool.ThreadedConnectionPool(
    1, 10,
    host=_cfg["host"],
    port=_cfg["port"],
    database=_cfg["database"],
    user=_cfg["user"],
    password=_cfg["password"],
)

_MAX_CHUNKS_FOR_SEARCH = 50000


def _get_conn():
    return _conn_pool.getconn()


def _put_conn(conn):
    _conn_pool.putconn(conn)


class VectorStore:
    def insert_document(self, filename: str) -> int:
        conn = _get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO documents (filename) VALUES (%s) RETURNING id",
                (filename,),
            )
            doc_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            return doc_id
        finally:
            _put_conn(conn)

    def insert_chunks(self, doc_id: int, chunks: list, embeddings: list):
        conn = _get_conn()
        try:
            cur = conn.cursor()
            rows = []
            for c, emb in zip(chunks, embeddings):
                blob = struct.pack(f"{len(emb)}f", *emb)
                rows.append((doc_id, c["index"], c["text"], blob))
            psycopg2.extras.execute_values(
                cur,
                "INSERT INTO chunks (doc_id, chunk_index, chunk_text, embedding) VALUES %s",
                rows,
                template="(%s, %s, %s, %s)",
            )
            cur.execute(
                "UPDATE documents SET total_chunks = (SELECT COUNT(*) FROM chunks WHERE doc_id = %s) WHERE id = %s",
                (doc_id, doc_id),
            )
            conn.commit()
            cur.close()
        finally:
            _put_conn(conn)

    def get_all_chunks(self):
        conn = _get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT c.id, c.chunk_index, c.chunk_text, c.embedding, d.filename, c.doc_id "
                "FROM chunks c JOIN documents d ON c.doc_id = d.id "
                "ORDER BY c.id LIMIT %s",
                (_MAX_CHUNKS_FOR_SEARCH,),
            )
            rows = cur.fetchall()
            cur.close()
            result = []
            for row_id, chunk_index, text, blob, doc_name, doc_id in rows:
                emb = list(struct.unpack(f"{len(blob)//4}f", blob))
                result.append({"id": row_id, "chunk_index": chunk_index, "text": text, "embedding": emb, "doc_name": doc_name, "doc_id": doc_id})
            return result
        finally:
            _put_conn(conn)

    def delete_document(self, doc_id: int):
        conn = _get_conn()
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
            if cur.rowcount == 0:
                raise ValueError("Document not found")
            conn.commit()
            cur.close()
        finally:
            _put_conn(conn)

    def search(self, query_vec: list, k: int = 3):
        chunks = self.get_all_chunks()
        q = np.array(query_vec)
        scores = []
        for c in chunks:
            v = np.array(c["embedding"])
            sim = float(np.dot(q, v))
            scores.append((sim, c))
        scores.sort(key=lambda x: x[0], reverse=True)
        return scores[:k]

    def get_document_chunks(self, doc_id: int):
        conn = _get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT chunk_index, chunk_text FROM chunks WHERE doc_id = %s ORDER BY chunk_index",
                (doc_id,),
            )
            rows = cur.fetchall()
            cur.close()
            return [{"index": r[0], "text": r[1]} for r in rows]
        finally:
            _put_conn(conn)

    def save_conversation(self, query: str, response: str, sources: list):
        conn = _get_conn()
        try:
            cur = conn.cursor()
            import json
            cur.execute(
                "INSERT INTO conversations (query, response, sources) VALUES (%s, %s, %s)",
                (query, response, json.dumps(sources)),
            )
            conn.commit()
            cur.close()
        finally:
            _put_conn(conn)

    def get_history(self, limit: int = 20):
        conn = _get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT query, response, sources, created_at FROM conversations ORDER BY created_at DESC LIMIT %s",
                (limit,),
            )
            rows = cur.fetchall()
            cur.close()
            import json
            return [
                {"query": r[0], "response": r[1], "sources": json.loads(r[2]) if r[2] else [], "date": r[3].isoformat()}
                for r in rows
            ]
        finally:
            _put_conn(conn)

    def get_stats(self):
        conn = _get_conn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM documents")
            doc_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM chunks")
            chunk_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM conversations")
            conv_count = cur.fetchone()[0]
            cur.close()
            return {"documents": doc_count, "chunks": chunk_count, "conversations": conv_count}
        finally:
            _put_conn(conn)
