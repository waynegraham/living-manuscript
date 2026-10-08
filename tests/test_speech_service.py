"""HTTP/decoding tests with fake models. No model download or GPU is required.
Run: python -m unittest discover -s tests -p 'test_*.py'
Requires the speech requirements plus httpx.
"""
import importlib.util
import io
import os
from pathlib import Path
import sys
from types import SimpleNamespace, ModuleType
import unittest
from unittest.mock import patch

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

os.environ["STT_PROVIDER"] = "disabled"
os.environ["TTS_PROVIDER"] = "disabled"
spec = importlib.util.spec_from_file_location("kawla_speech", Path(__file__).resolve().parents[1] / "local-ai/server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class SpeechTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(server.app)
        server.busy = False
        for kind in ("stt", "tts"):
            server.state[kind]["available"] = True

    def tearDown(self):
        self.client.close()
        server.models.clear()

    def payload(self, **kwargs):
        return {"input": "Hello.", "model": server.KOKORO, "voice": sorted(server.VOICES)[0], **kwargs}

    def test_health_reports_loaded_model_and_voice_settings(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["tts"]["voices"], sorted(server.VOICES))
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_unavailable_and_busy_services_fail_without_model_invocation(self):
        server.state["tts"]["available"] = False
        self.assertEqual(self.client.post("/speak", json=self.payload()).status_code, 503)
        server.state["tts"]["available"] = True
        server.busy = True
        self.assertEqual(self.client.post("/speak", json=self.payload()).status_code, 503)
        server.busy = False

    def test_speech_schema_rejects_unknown_voice_model_and_empty_text(self):
        for payload in (self.payload(voice="invented"), self.payload(model="other"), self.payload(input=" "), self.payload(input="x" * 2001)):
            self.assertEqual(self.client.post("/speak", json=payload).status_code, 422)

    def test_synthesis_returns_real_pcm_wav_and_uses_requested_voice(self):
        calls = []

        class Model:
            def generate(self, **kwargs):
                calls.append(kwargs)
                yield SimpleNamespace(audio=np.zeros(2400, dtype=np.float32), sample_rate=24000)
                yield SimpleNamespace(audio=np.ones(2400, dtype=np.float32) * 0.1, sample_rate=24000)

        server.models["tts"] = Model()
        response = self.client.post("/speak", json=self.payload())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "audio/wav")
        samples, rate = sf.read(io.BytesIO(response.content))
        self.assertEqual(rate, 24000)
        self.assertEqual(len(samples), 4800)
        self.assertEqual(calls[0]["voice"], self.payload()["voice"])
        self.assertEqual(calls[0]["lang_code"], "a")
        self.assertFalse(server.busy)

    def test_transcription_accepts_bounded_multipart_and_passes_audio(self):
        with patch.object(server, "recognize", return_value={"text": "Who are you?"}) as recognize:
            response = self.client.post("/transcribe", files={"file": ("q.webm", b"test audio", "audio/webm")}, data={"model": server.WHISPER, "language": "en"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["text"], "Who are you?")
            recognize.assert_called_once_with(b"test audio", ".webm")
        self.assertFalse(server.busy)

    def test_transcription_rejects_model_mismatch_and_oversized_body(self):
        response = self.client.post("/transcribe", files={"file": ("q.webm", b"audio", "audio/webm")}, data={"model": "other"})
        self.assertEqual(response.status_code, 422)
        response = self.client.post("/transcribe", content=b"x" * (server.MAX_UPLOAD + 65537))
        self.assertEqual(response.status_code, 413)

    def test_decode_checks_actual_duration_and_always_cleans_temporary_file(self):
        whisper = ModuleType("mlx_whisper")
        whisper.transcribe = lambda *_args, **_kwargs: {"text": "Who are you?"}
        paths = []

        def decode(command, **_kwargs):
            paths.append(Path(command[command.index("-i") + 1]))
            self.assertTrue(paths[-1].exists())
            self.assertEqual(command[command.index("-t") + 1], "31")
            return SimpleNamespace(stdout=np.zeros(5 * 16000, dtype=np.float32).tobytes())

        with patch.dict(sys.modules, {"mlx_whisper": whisper}), patch.object(server.subprocess, "run", side_effect=decode):
            self.assertEqual(server.recognize(b"audio", ".mp4")["text"], "Who are you?")
        self.assertFalse(paths[0].exists())
        with patch.dict(sys.modules, {"mlx_whisper": whisper}), patch.object(server.subprocess, "run", return_value=SimpleNamespace(stdout=np.zeros(31 * 16000, dtype=np.float32).tobytes())):
            with self.assertRaises(server.HTTPException) as raised:
                server.recognize(b"audio", ".mp4")
            self.assertEqual(raised.exception.status_code, 422)

    def test_startup_loads_whisper_once_and_warms_both_kokoro_voices(self):
        evaluated = []
        voices = []
        mx = ModuleType("mlx.core")
        mx.float16 = "float16"
        mx.eval = lambda value: evaluated.append(value)
        whisper = ModuleType("mlx_whisper.transcribe")
        whisper.ModelHolder = SimpleNamespace(get_model=lambda *_args: SimpleNamespace(parameters=lambda: "weights"))
        tts = ModuleType("mlx_audio.tts.utils")

        class Model:
            def generate(self, **kwargs):
                voices.append(kwargs["voice"])
                yield SimpleNamespace(audio="waveform")

        tts.load_model = lambda _model: Model()
        with patch.dict(sys.modules, {"mlx": ModuleType("mlx"), "mlx.core": mx, "mlx_whisper.transcribe": whisper, "mlx_audio.tts.utils": tts}), patch.object(server, "STT_ENABLED", True), patch.object(server, "TTS_ENABLED", True), patch.object(server.platform, "system", return_value="Darwin"), patch.object(server.platform, "machine", return_value="arm64"), patch.object(server.shutil, "which", return_value="/ffmpeg"):
            server.load_models()
        self.assertTrue(server.state["stt"]["available"])
        self.assertTrue(server.state["tts"]["available"])
        self.assertEqual(set(voices), server.VOICES)
        self.assertEqual(evaluated, ["weights", "waveform", "waveform"])

    def test_browser_cross_origin_requests_are_refused(self):
        self.assertEqual(self.client.get("/health", headers={"Origin": "https://example.com"}).status_code, 403)

    def test_inference_failures_clear_busy_and_do_not_expose_upstream_detail(self):
        with patch.object(server, "synthesize", side_effect=RuntimeError("private visitor data")):
            response = self.client.post("/speak", json=self.payload())
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("private visitor data", response.text)
        self.assertFalse(server.busy)


if __name__ == "__main__":
    unittest.main()
