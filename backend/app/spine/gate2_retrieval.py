import os
import pickle
from typing import List
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, CrossEncoder
from app.graph.database import SessionLocal
from app.graph.models import KBChunk
from app.kb.load_corpus import tokenize, BM25_PATH

_embedding_model = None
_rerank_model = None
_bm25_data = None


def get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer("BAAI/bge-base-en-v1.5")
    return _embedding_model


def get_rerank_model() -> CrossEncoder:
    global _rerank_model
    if _rerank_model is None:
        _rerank_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    return _rerank_model


def get_bm25():
    global _bm25_data
    if _bm25_data is None:
        if os.path.exists(BM25_PATH):
            with open(BM25_PATH, "rb") as f:
                _bm25_data = pickle.load(f)
    return _bm25_data


class RetrievedChunk(BaseModel):
    text: str
    source: str
    url: str
    score: float


class RetrievalResult(BaseModel):
    chunks: List[RetrievedChunk]
    sufficient: bool
    top_score: float


def retrieve(query: str, k: int = 6) -> RetrievalResult:
    db = SessionLocal()
    try:
        # 1. Dense search
        embedder = get_embedding_model()
        query_embedding = embedder.encode(query, normalize_embeddings=True).tolist()

        dense_results = db.query(KBChunk).order_by(
            KBChunk.embedding.cosine_distance(query_embedding)
        ).limit(k * 2).all()

        # 2. Sparse search
        bm25_data = get_bm25()
        sparse_hits = []
        if bm25_data:
            bm25 = bm25_data["index"]
            chunk_ids = bm25_data["chunk_ids"]
            tokenized_query = tokenize(query)
            sparse_scores = bm25.get_scores(tokenized_query)
            top_sparse_idx = sparse_scores.argsort()[-(k * 2):][::-1]
            for idx in top_sparse_idx:
                if sparse_scores[idx] > 0:
                    sparse_hits.append(chunk_ids[idx])

        sparse_chunks = []
        if sparse_hits:
            sparse_chunks = db.query(KBChunk).filter(KBChunk.id.in_(sparse_hits)).all()

        # 3. RRF fusion
        unique_chunks = {c.id: c for c in dense_results + sparse_chunks}
        rrf_scores = {c_id: 0.0 for c_id in unique_chunks}
        rrf_k = 60

        for rank, c in enumerate(dense_results):
            rrf_scores[c.id] += 1.0 / (rrf_k + rank + 1)

        sparse_ranked = sorted(
            [c for c in sparse_chunks],
            key=lambda c: sparse_hits.index(c.id) if c.id in sparse_hits else len(sparse_hits)
        )
        for rank, c in enumerate(sparse_ranked):
            rrf_scores[c.id] += 1.0 / (rrf_k + rank + 1)

        top_candidates = sorted(
            unique_chunks.values(), key=lambda c: rrf_scores[c.id], reverse=True
        )[:k * 2]

        if not top_candidates:
            return RetrievalResult(chunks=[], sufficient=False, top_score=0.0)

        # 4. Cross-encoder reranking
        reranker = get_rerank_model()
        pairs = [[query, c.text] for c in top_candidates]
        cross_scores = reranker.predict(pairs)

        scored_candidates = sorted(
            zip(top_candidates, cross_scores), key=lambda x: x[1], reverse=True
        )[:k]

        # 5. Sufficiency gate (ms-marco scores are logits; > 0 is a reasonable threshold)
        top_score = float(scored_candidates[0][1]) if scored_candidates else 0.0
        sufficient = top_score > 0.0

        retrieved_chunks = [
            RetrievedChunk(text=c.text, source=c.source, url=c.url, score=float(score))
            for c, score in scored_candidates
        ]

        return RetrievalResult(chunks=retrieved_chunks, sufficient=sufficient, top_score=top_score)
    finally:
        db.close()
