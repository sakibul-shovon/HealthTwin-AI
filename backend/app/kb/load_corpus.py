import os
import sys
import json
import pickle

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.graph.database import SessionLocal
from app.graph.models import KBChunk
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
CORPUS_PATH = os.path.join(DATA_DIR, "corpus.json")
BM25_PATH = os.path.join(DATA_DIR, "bm25_index.pkl")


def tokenize(text: str) -> list:
    return text.lower().split()


def load_corpus():
    if not os.path.exists(CORPUS_PATH):
        print(f"Corpus file not found: {CORPUS_PATH}")
        return

    with open(CORPUS_PATH, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    if not chunks:
        print("No chunks found.")
        return

    print(f"Loading {len(chunks)} chunks...")
    print("Loading BAAI/bge-base-en-v1.5 embedding model (downloading on first run)...")
    model = SentenceTransformer("BAAI/bge-base-en-v1.5")

    tokenized_corpus = []
    chunk_ids = []

    db = SessionLocal()
    try:
        db.query(KBChunk).delete()

        for c in chunks:
            text = c["text"]
            chunk_id = c["id"]

            embedding = model.encode(text, normalize_embeddings=True)

            kb_chunk = KBChunk(
                id=chunk_id,
                text=text,
                source=c["source"],
                url=c["url"],
                topic=c["topic"],
                embedding=embedding.tolist()
            )
            db.add(kb_chunk)

            tokenized_corpus.append(tokenize(text))
            chunk_ids.append(chunk_id)
            print(f"  Embedded: {chunk_id}")

        db.commit()
        print("Vectors stored in database.")

        bm25 = BM25Okapi(tokenized_corpus)
        with open(BM25_PATH, "wb") as f:
            pickle.dump({"index": bm25, "chunk_ids": chunk_ids}, f)
        print("BM25 index saved.")
        print(f"Done. {len(chunks)} chunks loaded.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    load_corpus()
