"""
Server-side Kokoro TTS endpoint.
Model is pre-loaded from the Docker image layer — no per-request download.
Falls back gracefully if kokoro is not installed (returns 503).
"""
import asyncio
import io
import logging
import struct
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tts", tags=["tts"])

_pipeline: Optional[object] = None
_load_error: Optional[str] = None


def _load_pipeline_sync():
    """Blocking load — run in executor so it doesn't block the event loop."""
    global _pipeline, _load_error
    if _pipeline is not None:
        return _pipeline
    try:
        from kokoro import KPipeline  # type: ignore
        _pipeline = KPipeline(lang_code="a")  # "a" = American English
        logger.info("Kokoro TTS pipeline ready")
        return _pipeline
    except Exception as exc:
        _load_error = str(exc)
        logger.warning("Kokoro unavailable: %s", exc)
        raise


def _synthesize_wav(pipeline, text: str, voice: str, speed: float) -> bytes:
    """CPU-bound synthesis — called inside run_in_executor."""
    parts = []
    for _, _, audio in pipeline(text, voice=voice, speed=speed):
        if audio is not None:
            parts.append(audio)

    if not parts:
        return b""

    audio = np.concatenate(parts)
    audio_i16 = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
    raw = audio_i16.tobytes()
    sample_rate = 24_000

    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + len(raw)))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16))
    buf.write(b"data")
    buf.write(struct.pack("<I", len(raw)))
    buf.write(raw)
    return buf.getvalue()


class TTSRequest(BaseModel):
    text: str = Field(..., max_length=2000)
    voice: str = "af_bella"
    speed: float = Field(1.0, ge=0.5, le=2.0)


@router.post("")
async def synthesize(req: TTSRequest):
    loop = asyncio.get_running_loop()

    # Lazy-load pipeline (first call only; subsequent calls hit the cached instance)
    try:
        pipeline = await loop.run_in_executor(None, _load_pipeline_sync)
    except Exception:
        raise HTTPException(503, detail="TTS service unavailable — kokoro not installed")

    wav = await loop.run_in_executor(
        None, _synthesize_wav, pipeline, req.text, req.voice, req.speed
    )

    if not wav:
        raise HTTPException(422, detail="No audio generated")

    return Response(content=wav, media_type="audio/wav")


@router.get("/health")
async def tts_health():
    """Quick check: is Kokoro available?"""
    return {"available": _pipeline is not None, "error": _load_error}
