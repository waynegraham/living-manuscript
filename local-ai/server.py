"""Loopback-only speech bridge. No audio or transcript persistence or access logs."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
import io
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).resolve().parents[1] / ".env.local")
WHISPER = os.getenv("MLX_WHISPER_MODEL", "mlx-community/whisper-large-v3-turbo")
NABRA = os.getenv("NABRA_MODEL", "oddadmix/Nabra-Saudi-82M")
NABRA_REVISION = os.getenv("NABRA_REVISION", "ed4a932ebb5a154e742ae14321a7435853164b9f")
NABRA_ENABLED = os.getenv("TTS_PROVIDER", "kokoro") != "disabled" and os.getenv("ARABIC_TTS_PROVIDER", "nabra") == "nabra"
KOKORO = os.getenv("KOKORO_MODEL", "mlx-community/Kokoro-82M-bf16")
VOICES = {os.getenv("KOKORO_MANUSCRIPT_VOICE", "af_heart"), os.getenv("KOKORO_GUIDE_VOICE", "am_adam")}
STT_ENABLED = os.getenv("STT_PROVIDER", "mlx") == "mlx"
TTS_ENABLED = os.getenv("TTS_PROVIDER", "kokoro") == "kokoro"
MAX_UPLOAD = 5 * 1024 * 1024
# Model loading and inference share a single thread to avoid concurrent Metal work.
worker = ThreadPoolExecutor(max_workers=1)
state = {
    "stt": {"available": False, "model": WHISPER, "message": "Loading Whisper…" if STT_ENABLED else "Disabled"},
    "tts": {"available": False, "model": KOKORO, "voices": sorted(VOICES), "message": "Loading Kokoro…" if TTS_ENABLED else "Disabled"},
}
state["tts_ar"] = {"available": False, "model": NABRA, "revision": NABRA_REVISION, "voices": ["af_msa"], "message": "Loading Nabra…" if NABRA_ENABLED else "Disabled"}
models = {}
busy = False


def load_models():
    supported = platform.system() == "Darwin" and platform.machine() == "arm64"
    for kind, enabled in (("stt", STT_ENABLED), ("tts", TTS_ENABLED), ("tts_ar", NABRA_ENABLED)):
        if not enabled:
            continue
        if not supported:
            state[kind].update(available=False, message="Use native arm64 Python on macOS Apple Silicon.")
            continue
        if kind == "stt" and not shutil.which("ffmpeg"):
            state[kind].update(available=False, message="Install ffmpeg with brew install ffmpeg and restart the service.")
            continue
        if kind == "tts_ar" and not shutil.which("espeak-ng"):
            state[kind].update(available=False, message="Install espeak-ng with brew install espeak-ng and restart the service.")
            continue
        if kind == "tts" and len(VOICES) != 2:
            state[kind].update(available=False, message="Choose two distinct Kokoro voices and restart the service.")
            continue
        try:
            if kind == "tts_ar":
                from nabra import NabraSpeech
                models[kind] = NabraSpeech(NABRA, NABRA_REVISION)
                state[kind].update(available=True, message="Nabra loaded; both personas share its single Saudi Arabic voice.")
                continue
            import mlx.core as mx
            if kind == "stt":
                from mlx_whisper.transcribe import ModelHolder
                # Populate the same cache used by transcribe; health means loaded weights.
                models[kind] = ModelHolder.get_model(WHISPER, mx.float16)
                mx.eval(models[kind].parameters())
            else:
                from mlx_audio.tts.utils import load_model
                models[kind] = load_model(KOKORO)
                # Warm both voices; exercises phonemizer, voice assets, and inference.
                for voice in VOICES:
                    generated = False
                    for result in models[kind].generate(text="Welcome.", voice=voice, speed=1.0, lang_code="a"):
                        mx.eval(result.audio)
                        generated = True
                    if not generated:
                        raise RuntimeError("Voice warm-up produced no audio")
            state[kind].update(available=True, message="Model loaded and ready.")
        except Exception as exc:
            print(f"{kind.upper()} startup failed ({type(exc).__name__}). Check installation, model cache, and configuration.", flush=True)
            state[kind].update(available=False, message=f"Could not load {kind.upper()}. Check arm64 Python, ffmpeg, dependencies, model path/cache, espeak-ng, and voice settings; restart the service.")


@asynccontextmanager
async def lifespan(_app):
    task = asyncio.get_running_loop().run_in_executor(worker, load_models)
    yield
    await task
    worker.shutdown(wait=True)


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)


@app.middleware("http")
async def local_only(request: Request, call_next):
    # Browser calls go through Next.js; refuse cross-origin browser access.
    if request.headers.get("origin"):
        return Response(status_code=403)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/health")
def health():
    return state


async def bounded_body(request, limit):
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > limit:
            raise HTTPException(413, "Request too large")
    return bytes(body)


async def infer(kind, fn, *args):
    global busy
    if not state[kind]["available"]:
        raise HTTPException(503, state[kind]["message"])
    if busy:
        raise HTTPException(503, "Speech service is busy. Retry shortly.")
    busy = True
    try:
        # Shield the worker: a disconnected client must not unlock running inference.
        future = asyncio.get_running_loop().run_in_executor(worker, fn, *args)
        try:
            return await asyncio.shield(future)
        except asyncio.CancelledError:
            await future
            raise
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Speech inference failed. Check model dependencies and restart the service.") from None
    finally:
        busy = False


def recognize(raw, suffix, language="en"):
    import numpy as np
    import mlx_whisper
    # ffmpeg needs a seekable file for Safari's MP4. Removed even after failure.
    with tempfile.TemporaryDirectory(prefix="kawla-audio-") as folder:
        path = Path(folder) / f"recording{suffix}"
        path.write_bytes(raw)
        try:
            decoded = subprocess.run(
                ["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-t", "31", "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"],
                capture_output=True, timeout=15, check=True,
            ).stdout
        except (subprocess.SubprocessError, OSError):
            raise HTTPException(422, "Invalid or unsupported audio") from None
    samples = np.frombuffer(decoded, dtype=np.float32).copy()
    if not 0 < len(samples) <= int(30.5 * 16000):
        raise HTTPException(422, "Audio must be no longer than 30 seconds")
    result = mlx_whisper.transcribe(samples, path_or_hf_repo=WHISPER, language=language, verbose=None)
    return {"text": result["text"].strip()[:500]}


@app.post("/transcribe")
async def transcribe(request: Request):
    # Bound the multipart body before parsing it (including chunked requests).
    raw = await bounded_body(request, MAX_UPLOAD + 65536)
    request._body = raw
    async with request.form(max_files=1, max_fields=4, max_part_size=MAX_UPLOAD) as form:
        file = form.get("file")
        if not file or not hasattr(file, "read"):
            raise HTTPException(422, "Audio file required")
        if form.get("model") != WHISPER:
            raise HTTPException(422, "Whisper model differs from service configuration")
        language = form.get("language", "en")
        if language not in ("en", "ar"):
            raise HTTPException(422, "Choose English (en) or Arabic (ar)")
        mime = (file.content_type or "").split(";")[0]
        suffix = {"audio/webm": ".webm", "audio/mp4": ".mp4", "audio/ogg": ".ogg", "audio/wav": ".wav", "audio/x-wav": ".wav"}.get(mime)
        audio = await file.read(MAX_UPLOAD + 1)
        if not suffix or not 0 < len(audio) <= MAX_UPLOAD:
            raise HTTPException(422, "Unsupported audio or upload over 5 MB")
    return await infer("stt", recognize, audio, suffix, language)


class Speech(BaseModel):
    input: str = Field(min_length=1, max_length=2000)
    model: str
    voice: str
    response_format: str = "wav"
    language: Literal["en", "ar"] = "en"


def synthesize(payload):
    import numpy as np
    import soundfile as sf
    chunks = []
    sample_rate = None
    for result in models["tts"].generate(text=payload.input, voice=payload.voice, speed=1.0, lang_code="a"):
        chunks.append(np.asarray(result.audio))
        sample_rate = result.sample_rate
    if not chunks:
        raise HTTPException(503, "Kokoro produced no audio")
    output = io.BytesIO()
    sf.write(output, np.concatenate(chunks), sample_rate, format="WAV", subtype="PCM_16")
    return output.getvalue()


def synthesize_arabic(payload):
    import soundfile as sf
    audio = models["tts_ar"].generate(payload.input)
    output = io.BytesIO()
    sf.write(output, audio, 24000, format="WAV", subtype="PCM_16")
    return output.getvalue()


@app.post("/speak")
async def speak(request: Request):
    raw = await bounded_body(request, 16384)
    try:
        payload = Speech.model_validate_json(raw)
    except ValueError:
        raise HTTPException(422, "Invalid speech request") from None
    if payload.language == "ar":
        if payload.model != NABRA or payload.voice != "af_msa" or payload.response_format != "wav" or not payload.input.strip():
            raise HTTPException(422, "Unsupported Arabic model, voice, or format")
        return Response(await infer("tts_ar", synthesize_arabic, payload), media_type="audio/wav")
    if payload.model != KOKORO or payload.voice not in VOICES or payload.response_format != "wav" or not payload.input.strip():
        raise HTTPException(422, "Unsupported model, voice, or format")
    return Response(await infer("tts", synthesize, payload), media_type="audio/wav")
