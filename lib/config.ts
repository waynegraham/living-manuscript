import { AppError } from "./schemas";
function choose<T extends string>(name: string, fallback: T, choices: readonly T[]): T {
  const value = process.env[name] || fallback;
  if (!choices.includes(value as T)) throw new AppError(`${name} must be ${choices.join(" or ")}.`, 503);
  return value as T;
}
export function localUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new AppError("Local AI service URL is invalid. Use an HTTP loopback URL.", 503); }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.protocol !== "http:" || url.username || url.password || url.search || url.hash) throw new AppError("Local AI URLs must use HTTP on localhost or a loopback address.", 503);
  return value.replace(/\/$/, "");
}
export function config() {
  return {
    llm: choose("LLM_PROVIDER", "lmstudio", ["lmstudio", "openai"]),
    stt: choose("STT_PROVIDER", "mlx", ["mlx", "openai", "disabled"]),
    tts: choose("TTS_PROVIDER", "kokoro", ["kokoro", "openai", "disabled"]),
    lmUrl: localUrl(process.env.LM_STUDIO_BASE_URL || "http://127.0.0.1:1234/v1"),
    lmModel: process.env.LM_STUDIO_MODEL || "qwen3-8b",
    speechUrl: localUrl(process.env.LOCAL_SPEECH_BASE_URL || "http://127.0.0.1:8001"),
    whisperModel: process.env.MLX_WHISPER_MODEL || "mlx-community/whisper-large-v3-turbo",
    kokoroModel: process.env.KOKORO_MODEL || "mlx-community/Kokoro-82M-bf16",
    voices: {
      kokoro: { manuscript: process.env.KOKORO_MANUSCRIPT_VOICE || "af_heart", guide: process.env.KOKORO_GUIDE_VOICE || "am_adam" },
      openai: { manuscript: process.env.OPENAI_MANUSCRIPT_VOICE || "shimmer", guide: process.env.OPENAI_GUIDE_VOICE || "onyx" },
    },
    openaiModels: { llm: process.env.OPENAI_LLM_MODEL || "gpt-4o-mini", stt: process.env.OPENAI_STT_MODEL || "whisper-1", tts: process.env.OPENAI_TTS_MODEL || "tts-1" },
  };
}
