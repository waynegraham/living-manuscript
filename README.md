# KAWLA Living Manuscript

A Next.js museum prototype with one conversational orchestrator, two personas, push-to-talk, a transcript, and local inference on macOS Apple Silicon. Default inference stays on your Mac: Qwen3-8B through LM Studio, Whisper large-v3-turbo through MLX, Kokoro-82M through MLX-Audio for English, and Nabra-Saudi-82M through PyTorch on CPU for Arabic. No database, CMS, account, conversation storage, or cloud deployment is required.

## Install on Apple Silicon

Use a native arm64 terminal, macOS compatible with your installed MLX version, Node.js 20.9+ (Node 22 LTS recommended), and Python 3.11. The project uses npm and its existing lockfile. A 36 GB Mac can use Qwen3-8B 4-bit alongside the speech models; select smaller models if memory pressure requires it.

```sh
brew install node python@3.11 ffmpeg espeak-ng
npm install
/opt/homebrew/bin/python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r local-ai/requirements.txt
python -m spacy download en_core_web_sm
python -c 'import platform; print(platform.machine())'
```

The final command should print `arm64`. Python 3.11 avoids compatibility surprises with newer Python releases. `ffmpeg` decodes browser WebM/Opus and Safari MP4 recordings; `espeak-ng` provides the English phonemizer fallback and the Arabic phonemizer used by Nabra. Installation and the initial model/voice downloads need internet access. These are local Python inference dependencies, not hosted services.

If `.env.local` does not exist, copy the example:

```sh
cp .env.example .env.local
```

If you already have `.env.local`, merge the provider settings from `.env.example` into it and keep your existing secrets. Never commit `.env.local` or add `NEXT_PUBLIC_` prefixes to provider settings.

## Load Qwen3 in LM Studio

Install [LM Studio](https://lmstudio.ai/), download a **Qwen3-8B 4-bit** model suitable for Apple Silicon (GGUF or supported MLX format), and load it. Set the context window to around 8,192 tokens for this prototype. Disable thinking in the model settings; the application also supplies `/no_think` and requests constrained JSON output.

In the Developer tab, start the server on port 1234. Keep it on localhost and disable automatic model unloading for the demonstration. Inspect its exact API model identifier:

```sh
curl http://127.0.0.1:1234/v1/models
```

Set `LM_STUDIO_MODEL` in `.env.local` to that exact `id`; `qwen3-8b` is an example, not a guaranteed identifier. If LM Studio authentication is enabled, set `LM_STUDIO_API_KEY` and include its bearer token when using curl. Chat uses LM Studio's [OpenAI-compatible structured-output endpoint](https://lmstudio.ai/docs/developer/openai-compat/structured-output).

## Start the demonstration

Three processes run independently: LM Studio, the speech bridge, and Next.js.

In a second terminal at the project root:

```sh
source .venv/bin/activate
python -m uvicorn server:app --app-dir local-ai --host 127.0.0.1 --port 8001 --no-access-log
```

The service reads `.env.local`. It loads Whisper, Kokoro, and Nabra once into a shared worker, warms both Kokoro voices, and checks Nabra with a Saudi Arabic warm-up sentence. Model loading may take several minutes on the first start; `/health` remains responsive and reports loading or failure separately for each service. Do not use multiple workers or auto-reload for the demonstration: that duplicates model memory and loading.

In a third terminal:

```sh
npm run dev -- --hostname 127.0.0.1
```

Open http://localhost:3000. Expand **Model service status** and select **Refresh status** after loading finishes. You can also check:

```sh
curl http://127.0.0.1:8001/health
curl http://localhost:3000/api/health
```

Whisper health means its weights are loaded; Kokoro health means both configured voices successfully synthesized a warm-up sentence; Arabic speech health means Nabra loaded and synthesized its warm-up sentence. LM Studio health checks that the configured model identifier is listed; the first chat request verifies generation and structured-output compatibility. The `/v1/models` listing alone does not prove that LM Studio has already loaded the model into memory.

## Provider and model settings

All settings are server-side. Restart both Next.js and the speech service after changes.

| Variable | Default / options |
| --- | --- |
| `LLM_PROVIDER` | `lmstudio` or `openai` |
| `STT_PROVIDER` | `mlx`, `openai`, or `disabled` |
| `TTS_PROVIDER` | English playback: `kokoro`, `openai`, or `disabled`; `disabled` stops playback in both languages |
| `ARABIC_TTS_PROVIDER` | Arabic playback: `nabra` (default), `openai`, or `disabled` |
| `NABRA_MODEL` | `oddadmix/Nabra-Saudi-82M`, or a complete local release directory |
| `NABRA_REVISION` | `ed4a932ebb5a154e742ae14321a7435853164b9f` (fixed upstream release) |
| `NABRA_CACHE_DIR` | Optional Python-side cache override; defaults to `models/huggingface` in this project |
| `LM_STUDIO_BASE_URL` | `http://127.0.0.1:1234/v1` |
| `LM_STUDIO_MODEL` | `qwen3-8b`; replace with the actual API identifier |
| `LM_STUDIO_API_KEY` | Optional LM Studio authentication token |
| `LOCAL_SPEECH_BASE_URL` | `http://127.0.0.1:8001` |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo`; MLX repository ID or local directory |
| `KOKORO_MODEL` | `mlx-community/Kokoro-82M-bf16`; compatible repository ID or local directory |
| `KOKORO_MANUSCRIPT_VOICE` | `af_heart` |
| `KOKORO_GUIDE_VOICE` | `am_adam` |
| `OPENAI_API_KEY` | Required only for explicitly selected OpenAI providers |
| `OPENAI_LLM_MODEL` | `gpt-4o-mini` |
| `OPENAI_STT_MODEL` | `whisper-1` |
| `OPENAI_TTS_MODEL` | `tts-1` |
| `OPENAI_MANUSCRIPT_VOICE` | `shimmer` |
| `OPENAI_GUIDE_VOICE` | `onyx` |

English and Arabic TTS are selected independently, with `TTS_PROVIDER=disabled` acting as a global playback off switch. For cloud speech in both languages, explicitly set `TTS_PROVIDER=openai` and `ARABIC_TTS_PROVIDER=openai`. For example, select local chat with `STT_PROVIDER=disabled` and `TTS_PROVIDER=disabled` for a text-only demonstration. No service failure automatically switches to a hosted API. Local URLs must use HTTP and a loopback hostname/address. Changing the speech port requires changing both the uvicorn command and `LOCAL_SPEECH_BASE_URL`.

Kokoro uses [MLX-Audio's Python API](https://github.com/Blaizzy/mlx-audio/blob/main/docs/models/tts/kokoro.md), American English (`lang_code=a`), and two distinct presets. Keep the voices different and select American English presets compatible with this language code. The configured voices are tested on service startup. Whisper uses [mlx-whisper](https://github.com/ml-explore/mlx-examples/blob/main/whisper/README.md); models must be converted for MLX, not arbitrary Whisper checkpoint files. The default model has its own [MLX model card](https://huggingface.co/mlx-community/whisper-large-v3-turbo).

For the optional OpenAI adapter, select the relevant `openai` providers explicitly. Supported voices depend on the selected speech model; `shimmer` and `onyx` are supported by the default `tts-1` model. See [OpenAI speech documentation](https://developers.openai.com/api/docs/guides/text-to-speech).

## Nabra Arabic speech

The Arabic switch now uses [Nabra-Saudi-82M](https://huggingface.co/oddadmix/Nabra-Saudi-82M) by default. Its release provides a single female voice, `af_msa`, shared by the manuscript and guide. Persona labels and conversational behavior still differ, while English retains distinct Kokoro voices. The chat prompt uses short, accessible Saudi Arabic without full tashkeel when Nabra is selected; with Arabic speech disabled or OpenAI selected, replies use Modern Standard Arabic.

Nabra runs through its documented **PyTorch CPU** loader on Apple Silicon. It uses the upstream patched Kokoro package because the checkpoint's decoder differs from stock Kokoro. Do not install or import the stock `kokoro` package in this speech process. `local-ai/nabra.py` fetches the pinned loader, patched runtime, release checkpoint, configuration, and voice into the ignored `models/huggingface` cache on first startup (about 329 MB). These code and weight files come from the requested upstream model repository at `NABRA_REVISION`. The later conversational checkpoint is not used. No weights or voice files are downloaded per response.

The approved Saudi voice is designed for Saudi dialect, rather than Modern Standard Arabic. Nabra's Saudi loader disables MSA diacritization, so no camel-tools package or diacritization corpus is required. `espeak-ng` and the additional dependencies in `local-ai/requirements.txt` are required. The wrapper disables upstream Kokoro logging to prevent input text or phonemes from reaching the service logs. Synthesis returns 24 kHz mono WAV and splits text into bounded phoneme sequences to prevent upstream truncation of long Arabic passages, and concatenates all generated segments.

For an existing installation:

```sh
source .venv/bin/activate
python -m pip install -r local-ai/requirements.txt
```

Merge the new `ARABIC_TTS_PROVIDER`, `NABRA_MODEL`, and `NABRA_REVISION` entries from `.env.example` into `.env.local`, then restart the speech service and Next.js. Defaults work without these entries when English TTS is enabled. Check the **Arabic speech** row in the UI or `tts_ar` in the Python `/health` response. Nabra loading or inference failures leave Arabic text and English speech usable; Replay retries Arabic generation after the service recovers. No failure triggers automatic cloud inference.

## Offline operation

First complete installation, download/load Qwen3, start the speech service online, and wait until Whisper, English speech, and Arabic speech health checks report ready. This caches the weights, Kokoro voice assets, English language resources, and the pinned Nabra runtime and voice. For subsequent offline starts:

```sh
source .venv/bin/activate
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 python -m uvicorn server:app --app-dir local-ai --host 127.0.0.1 --port 8001 --no-access-log
```

Start LM Studio with the downloaded model and start Next.js as above. A missing cache asset produces an unavailable health status; prepare it online before the museum demonstration. `MLX_WHISPER_MODEL`, `KOKORO_MODEL`, and `NABRA_MODEL` may point to local model directories, but Kokoro's voice and language assets must also have been cached. These flags apply to the Python speech service. With all three local providers selected, visitor content is sent only to the localhost services.

## English and Arabic responses

Use **Response language / لغة الرد** in the conversation panel to choose English or Arabic. Both personas reply in the selected language, even if a typed question or earlier messages use the other language. Arabic replies use Saudi phrasing when Nabra is selected, or Modern Standard Arabic with other Arabic speech settings, and display right-to-left. Switching retains conversation context and previous messages in their original language; it stops current playback and cancels any recording. Reset clears the conversation and keeps the selected language; reloading defaults to English.

The selected language also sets Whisper recognition to `en` or `ar`. Use a multilingual MLX Whisper model, such as the default large-v3-turbo, for Arabic recording. English-only Whisper models cannot recognize Arabic. The surrounding interface and suggested questions remain in English; this switch controls responses rather than translating manuscript metadata or adding a full localization framework.

Arabic replies use Nabra and English replies use Kokoro by default. Both languages support automatic speech, Stop audio, and Replay. The UI explains that Nabra has one shared Saudi voice. Use `ARABIC_TTS_PROVIDER=disabled` for Arabic text only; English speech can remain enabled.

## Interaction and API contract

Hold the microphone button and release to submit, or hold Space/Enter while focused on it. **Start recording** and **Stop and send** offer a keyboard-accessible toggle alternative. Escape or **Cancel** discards the recording. Recordings stop automatically at 30 seconds, are limited to 5 MB, and release microphone tracks. The local service also decodes and checks the actual audio duration.

Text input stays available when the microphone, transcription, or speech generation fails. A failed transcription offers retry from the in-memory recording; failed chat preserves the input. Failed synthesis keeps the response in the transcript. **Replay** retries generation or playback; **Stop audio** stops playback and cancels a pending synthesis request. Autoplay restrictions are handled with a visible replay hint. Reset aborts pending browser requests, stops recording/audio, revokes audio URLs, and clears the session. An already-running local inference may finish after cancellation; its output is discarded.

- `POST /api/chat`: `{ "message": "Who are you?", "history": [], "language": "en" }`; returns `{ speaker, text, certainty, evidenceIds, viewerAction }`.
- History entries: `{ "role": "user", "text": "…" }` or `{ "role": "assistant", "response": { ...structuredResponse } }`.
- `POST /api/transcribe`: multipart `file` plus `duration` in seconds and optional `language` (`en` or `ar`); returns `{ "text": "…" }`.
- `POST /api/speak`: `{ "speaker": "manuscript" | "guide", "text": "…", "language": "en" }`; returns WAV audio when the selected provider supports the language.

The optional request `language` defaults to `en` for all three endpoints. Unsupported values are rejected. The structured chat response format is unchanged; optional `language` metadata on history turns records their original response language.

- `GET /api/health`: separate provider readiness and helpful diagnostics (`llm`, `stt`, `tts` for English, and `ttsAr` for Arabic).

Server requests and model outputs are bounded. Up to 20 transcript turns remain in browser memory; the UI sends at most 18 previous turns. The chat output is limited to 700 tokens and 2,000 characters. Every output is validated, including allowed evidence IDs. Unsupported viewer actions and model-generated coordinates are rejected; `viewerAction` is currently always `null`. Persona transitions share one history and one orchestrator. Prompt instructions require unknown answers for missing evidence, but generated prose still requires human review for historical accuracy.

## Manuscript knowledge and privacy

`data/manuscript.json` remains the authoritative source. The supplied record is preserved; dates and scribes are not invented. The interface reads the current `imageUrl` and optional metadata. A JPEG derivative of the supplied TIFF is used for browser compatibility without changing the original TIFF or knowledge JSON.

No transcripts or recordings are retained by the application on disk. Browser session memory retains the conversation and optionally a recording for retry until reset or reload. The speech bridge uses a temporary file for ffmpeg's MP4 decoding and removes it after decoding, including on error; multipart parser temporary uploads are closed after use. WAV synthesis stays in memory. Model weights and dependencies are cached on disk. Fixed stage names and elapsed milliseconds are logged; visitor text, audio, keys, and upstream error bodies are not logged. Keep the app and model services local; public use would require rate limiting and abuse protection.

## Checks and troubleshooting

```sh
npm run lint
npm run typecheck
npm test
npm run build
python -m py_compile local-ai/server.py
# Optional Python HTTP tests (no weights downloaded):
python -m pip install -r local-ai/requirements-test.txt
python -m unittest discover -s tests -p 'test_*.py'
```

Provider tests mock HTTP inference and cover validation, citations, unknown-answer instructions, context through persona transitions, the nine visitor prompts, local routing, voice mapping, health failures, upload bounds, explicit cloud opt-in, language validation, bilingual context, and Arabic speech fallback. Python HTTP tests also check the speech HTTP contract, WAV generation, actual decoded duration, temporary-file cleanup, and failure handling with fake model output. These tests do not prove model accuracy or microphone behavior. Run the live checks below after installing/loading the local models.

If your environment restricts Turbopack's local build-worker port, use `npm run build -- --webpack`; the app works with either bundler. After building, use `npm start -- --hostname 127.0.0.1`.

| Symptom | Action |
| --- | --- |
| LM Studio unavailable | Start its Developer server; check URL, port, token, and model identifier. Load the model before the demo. |
| Invalid JSON / empty Qwen3 answer | Disable thinking, keep `/no_think`, and use a model/backend that supports LM Studio JSON-schema output. |
| Speech stays unavailable | Check native arm64 Python, requirements, ffmpeg, model cache/path, spaCy English model, and Kokoro voice IDs; restart the speech service. |
| Arabic speech unavailable | Check the Arabic speech health row, Nabra dependencies, espeak-ng, pinned model cache/path, and `ARABIC_TTS_PROVIDER`. Restart the speech service after correcting startup failures. |
| Configuration mismatch | Restart both services with matching `.env.local` settings. |
| No microphone permission | Allow microphone access on localhost or use text input. |
| No recognized speech | Retry with a short clear question in the selected language, or type it. |
| Audio blocked | Click Replay; the transcript is already available. |
| Service busy / slow | Wait for the current inference to finish; reduce model size or LM Studio context if memory pressure is high. |

Live demonstration checks:

1. Ask “Who are you?”, “How old are you?”, and “Who created you?” Confirm unknown dates/scribes remain unknown.
2. Ask “How do scholars know?” and “What is written on your pages?” Confirm evidence is limited to the JSON record and no translation is invented.
3. Ask “Can you show me something interesting?” and “What don't we know about you?” Confirm no unsupported image action or evidence identifier appears.
4. Request the scholar, ask a follow-up, then request the manuscript again. Confirm context and voice changes.
5. Test mouse/touch holding, keyboard holding, toggle recording, permission denial, cancellation, and the 30-second cutoff.
6. Stop the speech service and submit a typed question. Confirm chat/text still work; restore the service and retry speech.
7. Reset during recording, transcription, chat, and playback. Confirm no stale response appears and the microphone releases.
8. Switch to Arabic and ask an English question. Confirm the reply is Arabic and right-to-left, then switch back and ask a follow-up. Confirm history is retained, Nabra speaks the Arabic reply, both Arabic personas use its shared voice, and English playback still uses the two Kokoro voices.
