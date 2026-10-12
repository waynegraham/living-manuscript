"""Nabra wrapper tests isolate external inference while exercising chunk handling."""
import contextlib
import importlib.util
from pathlib import Path
import sys
from types import ModuleType
import unittest
from unittest.mock import patch
import numpy as np

spec = importlib.util.spec_from_file_location("nabra_runtime", Path(__file__).resolve().parents[1] / "local-ai/nabra.py")
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class Audio:
    def __init__(self, size): self.samples = np.zeros(size, dtype=np.float32)
    def detach(self): return self
    def cpu(self): return self
    def numpy(self): return self.samples


class NabraRuntimeTests(unittest.TestCase):
    def test_long_arabic_response_is_not_truncated_at_upstream_phoneme_limit(self):
        # Emulate the documented upstream truncation; each non-space character
        # expands to three phonemes. The full text needs 3,000 generated samples.
        class Pipeline:
            def g2p(self, text):
                return ("x" * (sum(not c.isspace() for c in text) * 3), text)
            def __call__(self, text, voice):
                yield (text, "", Audio(min(len(self.g2p(text)[0]), 510)))
            def generate_from_tokens(self, tokens, voice):
                if len(tokens) > 510:
                    raise ValueError("Upstream phoneme limit exceeded")
                yield ("", tokens, Audio(len(tokens)))

        model = object.__new__(runtime.NabraSpeech)
        model.pipeline = Pipeline(); model.voice = "voice tensor"
        torch = ModuleType("torch"); torch.inference_mode = contextlib.nullcontext
        with patch.dict(sys.modules, {"torch": torch}):
            audio = model.generate("مرحبا " * 200)
        self.assertEqual(len(audio), 3000)
        self.assertEqual(audio.dtype, np.float32)


if __name__ == "__main__":
    unittest.main()
