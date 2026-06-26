import psycopg2
from psycopg2 import sql
import yaml

with open("config.yaml") as f:
    cfg = yaml.safe_load(f)["shaktidb"]

conn = psycopg2.connect(
    host=cfg["host"],
    port=cfg["port"],
    database=cfg["database"],
    user=cfg["user"],
    password=cfg["password"],
)
conn.autocommit = True
cur = conn.cursor()

cur.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_chunks INTEGER DEFAULT 0
    );
""")

cur.execute("""
    CREATE TABLE IF NOT EXISTS chunks (
        id SERIAL PRIMARY KEY,
        doc_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        embedding BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
""")

cur.execute("""
    CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        response TEXT NOT NULL,
        sources JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
""")

cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(doc_id);
""")
cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);
""")

cur.close()
conn.close()
print("Schema created successfully.")
