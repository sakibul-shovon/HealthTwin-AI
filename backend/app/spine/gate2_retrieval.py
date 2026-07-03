import os
import pickle
from typing import List, TYPE_CHECKING
from pydantic import BaseModel
from app.graph.database import SessionLocal
from app.graph.models import KBChunk
from app.kb.load_corpus import tokenize, BM25_PATH

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer, CrossEncoder

_embedding_model = None
_rerank_model = None
_bm25_data = None


def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer  # lazy — avoids MemoryError on startup
        _embedding_model = SentenceTransformer("BAAI/bge-base-en-v1.5")
    return _embedding_model


def get_rerank_model():
    global _rerank_model
    if _rerank_model is None:
        from sentence_transformers import CrossEncoder  # lazy
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


def _bm25_only_retrieve(query: str, k: int, db) -> RetrievalResult:
    """BM25-only retrieval path — no PyTorch required."""
    bm25_data = get_bm25()
    if not bm25_data:
        return RetrievalResult(chunks=[], sufficient=False, top_score=0.0)

    bm25 = bm25_data["index"]
    chunk_ids = bm25_data["chunk_ids"]
    tokenized_query = tokenize(query)
    scores = bm25.get_scores(tokenized_query)

    top_idx = scores.argsort()[-(k * 2):][::-1]
    hits = [(chunk_ids[i], float(scores[i])) for i in top_idx if scores[i] > 0]

    if not hits:
        return RetrievalResult(chunks=[], sufficient=False, top_score=0.0)

    hit_ids = [h[0] for h in hits[:k]]
    score_map = {h[0]: h[1] for h in hits}

    chunks = db.query(KBChunk).filter(KBChunk.id.in_(hit_ids)).all()
    chunks.sort(key=lambda c: score_map.get(c.id, 0), reverse=True)

    top_score = score_map.get(chunks[0].id, 0.0) if chunks else 0.0
    # BM25 scores in this small corpus: in-domain medical queries score > 3;
    # out-of-domain / gibberish queries score < 3 even if stopwords partially match.
    sufficient = top_score > 3.0

    retrieved_chunks = [
        RetrievedChunk(text=c.text, source=c.source, url=c.url, score=score_map.get(c.id, 0.0))
        for c in chunks[:k]
    ]
    return RetrievalResult(chunks=retrieved_chunks, sufficient=sufficient, top_score=top_score)


def retrieve(query: str, k: int = 6) -> RetrievalResult:
    db = SessionLocal()
    try:
        # Try full pipeline (dense + sparse + rerank).
        # Falls back to BM25-only if PyTorch can't load (paging file / OOM).
        try:
            import numpy as np
            embedder = get_embedding_model()
            query_embedding = embedder.encode(query, normalize_embeddings=True)
            all_chunks = db.query(KBChunk).filter(KBChunk.embedding.isnot(None)).all()
            if not all_chunks:
                return _bm25_only_retrieve(query, k, db)
            chunk_embeddings = np.array([c.embedding for c in all_chunks], dtype=np.float32)
            cos_sims = chunk_embeddings @ query_embedding.astype(np.float32)
            top_idx = cos_sims.argsort()[-(k * 2):][::-1]
            dense_results = [all_chunks[i] for i in top_idx]
            query_embedding = query_embedding.tolist()
        except Exception:
            # PyTorch / OpenBLAS OOM — fall back to BM25 only
            return _bm25_only_retrieve(query, k, db)

        # Sparse search
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

        # RRF fusion
        unique_chunks = {c.id: c for c in dense_results + sparse_chunks}
        rrf_scores = {c_id: 0.0 for c_id in unique_chunks}
        rrf_k = 60

        for rank, c in enumerate(dense_results):
            rrf_scores[c.id] += 1.0 / (rrf_k + rank + 1)

        sparse_ranked = sorted(
            sparse_chunks,
            key=lambda c: sparse_hits.index(c.id) if c.id in sparse_hits else len(sparse_hits)
        )
        for rank, c in enumerate(sparse_ranked):
            rrf_scores[c.id] += 1.0 / (rrf_k + rank + 1)

        top_candidates = sorted(
            unique_chunks.values(), key=lambda c: rrf_scores[c.id], reverse=True
        )[:k * 2]

        if not top_candidates:
            return RetrievalResult(chunks=[], sufficient=False, top_score=0.0)

        # Cross-encoder reranking
        try:
            reranker = get_rerank_model()
            pairs = [[query, c.text] for c in top_candidates]
            cross_scores = reranker.predict(pairs)
            scored_candidates = sorted(
                zip(top_candidates, cross_scores), key=lambda x: x[1], reverse=True
            )[:k]
            top_score = float(scored_candidates[0][1]) if scored_candidates else 0.0
            # ms-marco cross-encoder: out-of-domain queries score 1-2, in-domain score 3+.
            # Threshold 3.0 separates irrelevant from relevant matches.
            sufficient = top_score > 3.0
            retrieved_chunks = [
                RetrievedChunk(text=c.text, source=c.source, url=c.url, score=float(score))
                for c, score in scored_candidates
            ]
        except Exception:
            # Reranker OOM — RRF scores have no meaningful relevance baseline,
            # so fall back to BM25 which has a calibrated threshold.
            return _bm25_only_retrieve(query, k, db)

        return RetrievalResult(chunks=retrieved_chunks, sufficient=sufficient, top_score=top_score)
    finally:
        db.close()
