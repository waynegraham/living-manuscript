"""Nabra's release loader, cached once and run on CPU on Apple Silicon.

The upstream patched Kokoro implementation is required by this checkpoint.
Use a fixed Hugging Face revision; no code or weights are fetched per request.
"""
from collections import deque
import importlib.util
import os
import re
from pathlib import Path
import sys


class NabraSpeech:
    def __init__(self, model_path: str, revision: str):
        import torch
        from huggingface_hub import snapshot_download
        from loguru import logger

        # Upstream debug/warning messages may contain input text or phonemes.
        logger.disable("kokoro")

        path = Path(model_path).expanduser()
        if not path.is_dir():
            path = Path(snapshot_download(
                repo_id=model_path, revision=revision,
                cache_dir=os.getenv("NABRA_CACHE_DIR", str(Path(__file__).resolve().parents[1] / "models" / "huggingface")),
                allow_patterns=["load_model.py", "arabic_g2p.py", "kokoro_patched/**", "config.json", "af_msa.pt", "nabra_saudi_82m_v0.pth", "README.md"],
            ))
        patched = path / "kokoro_patched" / "kokoro"
        existing = sys.modules.get("kokoro")
        if existing and Path(existing.__file__).resolve().parent != patched.resolve():
            raise RuntimeError("Nabra requires its patched Kokoro package; restart the speech service without stock kokoro loaded")
        spec = importlib.util.spec_from_file_location("_kawla_nabra_loader", path / "load_model.py")
        if spec is None or spec.loader is None:
            raise RuntimeError("Nabra loader is missing")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        # The release's CPU path also avoids unsupported Metal operations.
        with torch.inference_mode():
            self.model, self.pipeline, self.voice = module.load(device="cpu")
        self.generate("يا هلا وسهلا")

    def generate(self, text: str):
        import numpy as np
        import torch
        chunks = []
        with torch.inference_mode():
            for phonemes in self._phoneme_chunks(text):
                for _graphemes, _phonemes, audio in self.pipeline.generate_from_tokens(phonemes, voice=self.voice):
                    if audio is not None:
                        chunks.append(audio.detach().cpu().numpy().reshape(-1))
        if not chunks:
            raise RuntimeError("Nabra produced no audio")
        return np.concatenate(chunks).astype(np.float32, copy=False)

    def _phoneme_chunks(self, text: str):
        # The upstream non-English __call__ truncates at 510 phonemes. Split
        # before inference instead, including text with Arabic punctuation.
        pending = deque([text.strip()])
        while pending:
            part = pending.popleft()
            if not part:
                continue
            phonemes, _ = self.pipeline.g2p(part)
            if len(phonemes) <= 510:
                if phonemes:
                    yield phonemes
                continue
            if len(part) <= 1:
                raise RuntimeError("Nabra cannot synthesize this phoneme sequence")
            middle = len(part) // 2
            boundaries = [m.end() for m in re.finditer(r"\s+|[.!?؟؛]", part) if 0 < m.end() < len(part)]
            cut = min(boundaries, key=lambda index: abs(index - middle)) if boundaries else middle
            pending.appendleft(part[cut:].strip())
            pending.appendleft(part[:cut].strip())
