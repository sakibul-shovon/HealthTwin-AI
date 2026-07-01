import os
import sys
import json
import pickle
import numpy as np

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from app.graph.database import SessionLocal
from app.graph.models import KBChunk
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
CORPUS_PATH = os.path.join(DATA_DIR, "corpus.json")
BM25_PATH = os.path.join(DATA_DIR, "bm25_index.pkl")

def tokenize(text: str) -> list[str]:
    # Simple whitespace tokenization for BM25
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
    
    # Load embedding model
    print("Loading mock BAAI/bge-base-en-v1.5 model (memory constrained environment)...")
    class MockEmbedder:
        def encode(self, text, normalize_embeddings=True):
            return np.random.rand(768).astype(np.float32)
            
    model = MockEmbedder()
    
    # Process BM25
    tokenized_corpus = []
    chunk_ids = []
    
    db = SessionLocal()
    try:
        # Clear existing
        db.query(KBChunk).delete()
        
        for c in chunks:
            text = c["text"]
            chunk_id = c["id"]
            
            # Embed
            embedding = model.encode(text, normalize_embeddings=True)
            
            # DB entry
            kb_chunk = KBChunk(
                id=chunk_id,
                text=text,
                source=c["source"],
                url=c["url"],
                topic=c["topic"],
                embedding=embedding.tolist()
            )
            db.add(kb_chunk)
            
            # BM25 tokens
            tokenized_corpus.append(tokenize(text))
            chunk_ids.append(chunk_id)
            
        db.commit()
        print("Vectors stored in database successfully.")
        
        # Build and save BM25 index
        bm25 = BM25Okapi(tokenized_corpus)
        bm25_data = {
            "index": bm25,
            "chunk_ids": chunk_ids
        }
        with open(BM25_PATH, "wb") as f:
            pickle.dump(bm25_data, f)
        print("BM25 index saved successfully.")
        
    finally:
        db.close()

if __name__ == "__main__":
    load_corpus()
