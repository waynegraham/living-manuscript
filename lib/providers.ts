import { config } from "./config";
import { AppError, responseSchema, type PersonaId, type ResponseLanguage } from "./schemas";
const openaiUrl = "https://api.openai.com/v1";
function headers(local = false): Record<string, string> {
  const key = local ? process.env.LM_STUDIO_API_KEY : process.env.OPENAI_API_KEY;
  if (!local && !key) throw new AppError("Set OPENAI_API_KEY for the selected OpenAI provider, or select a local provider.", 503);
  return key ? { Authorization: `Bearer ${key}` } : {};
}
export async function serviceFetch(url: string, init: RequestInit, service: string, timeout = 120000) {
  let response: Response;
  try { response = await fetch(url, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(timeout) }); }
  catch { throw new AppError(`${service} is unavailable or timed out. Start the service and load the configured model.`, 503); }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new AppError(`${service} rejected authentication. Check the server-side API key.`, 503);
    if (response.status === 400 || response.status === 422 || response.status === 413) throw new AppError(`${service} rejected the request. Check the model, voice, audio format, and 30-second recording limit.`, 422);
    throw new AppError(`${service} could not run the configured model. Check /api/health and the service terminal.`, 503);
  }
  return response;
}
async function serviceJson(response: Response, service: string) {
  try { return await response.json(); }
  catch { throw new AppError(`${service} returned an invalid response. Check the service and try again.`, 502); }
}
export async function complete(messages: { role: string; content: string }[]) {
  const c = config(); const local = c.llm === "lmstudio";
  const response = await serviceFetch(`${local ? c.lmUrl : openaiUrl}/chat/completions`, {
    method: "POST", headers: { ...headers(local), "Content-Type": "application/json" },
    body: JSON.stringify({ model: local ? c.lmModel : c.openaiModels.llm, messages, temperature: 0.3, max_tokens: 700,
      response_format: { type: "json_schema", json_schema: { name: "manuscript_response", strict: true, schema: responseSchema } } }),
  }, local ? "LM Studio" : "OpenAI chat");
  const result = await serviceJson(response, "The language model");
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new AppError("The language model returned no answer. Disable Qwen3 thinking and check structured-output support.", 502);
  try { return JSON.parse(content.replace(/^\s*<think>[\s\S]*?<\/think>\s*/, "")); }
  catch { throw new AppError("The model returned invalid JSON. Disable Qwen3 thinking in LM Studio and try again.", 502); }
}
export async function transcribe(file: File, language: ResponseLanguage = "en") {
  const c = config();
  if (c.stt === "disabled") throw new AppError("Speech recognition is disabled. Please type your question.", 503);
  const form = new FormData(); form.set("file", file); form.set("model", c.stt === "mlx" ? c.whisperModel : c.openaiModels.stt); form.set("language", language);
  const response = await serviceFetch(c.stt === "mlx" ? `${c.speechUrl}/transcribe` : `${openaiUrl}/audio/transcriptions`, {
    method: "POST", headers: c.stt === "openai" ? headers() : {}, body: form,
  }, c.stt === "mlx" ? "MLX Whisper" : "OpenAI transcription");
  const result = await serviceJson(response, "Speech recognition");
  if (typeof result.text !== "string" || !result.text.trim()) throw new AppError("No speech was recognized. Try recording again or type your question.", 422);
  return result.text.trim().slice(0, 500);
}
export async function speak(input: string, speaker: PersonaId, language: ResponseLanguage = "en") {
  const c = config();
  if (c.tts === "disabled") throw new AppError("Speech playback is disabled. The text response is available.", 503);
  const local = c.tts === "kokoro";
  if (local && language === "ar") throw new AppError("Kokoro does not support Arabic speech. The Arabic text response is available.", 422);
  return serviceFetch(local ? `${c.speechUrl}/speak` : `${openaiUrl}/audio/speech`, {
    method: "POST", headers: { ...(local ? {} : headers()), "Content-Type": "application/json" },
    body: JSON.stringify({ input, model: local ? c.kokoroModel : c.openaiModels.tts, voice: c.voices[local ? "kokoro" : "openai"][speaker], response_format: "wav", ...(local ? { language } : {}) }),
  }, local ? "Kokoro speech" : "OpenAI speech");
}
export async function health() {
  const c = config();
  const llm = async () => {
    try {
      const response = await serviceFetch(`${c.llm === "lmstudio" ? c.lmUrl : openaiUrl}/models`, { headers: headers(c.llm === "lmstudio") }, c.llm, 4000);
      const result = await response.json(); const model = c.llm === "lmstudio" ? c.lmModel : c.openaiModels.llm;
      if (!Array.isArray(result.data) || !result.data.some((m: { id: string }) => m.id === model)) throw new AppError(c.llm === "lmstudio" ? `Model '${model}' was not found. Load Qwen3 in LM Studio and copy its exact API identifier to LM_STUDIO_MODEL.` : `OpenAI model '${model}' was not found. Check OPENAI_LLM_MODEL and API access.`, 503);
      return { provider: c.llm, model, available: true, message: "Model is listed; inference is checked when you send a question." };
    } catch (e) { return { provider: c.llm, available: false, message: e instanceof AppError ? e.message : "Model check failed." }; }
  };
  const speech = async () => {
    if (c.stt !== "mlx" && c.tts !== "kokoro") return null;
    try { return await (await serviceFetch(`${c.speechUrl}/health`, {}, "Local speech service", 4000)).json(); }
    catch { return null; }
  };
  const [chat, local] = await Promise.all([llm(), speech()]);
  function audio(kind: "stt" | "tts") {
    const provider = c[kind];
    if (provider === "disabled") return { provider, available: false, message: "Disabled; text interaction is available." };
    if (provider === "openai") return { provider, available: Boolean(process.env.OPENAI_API_KEY), message: "Remote provider; inference is checked on use." };
    const state = local?.[kind]; const model = kind === "stt" ? c.whisperModel : c.kokoroModel;
    const match = state?.model === model;
    const voicesMatch = kind !== "tts" || Object.values(c.voices.kokoro).every(v => state?.voices?.includes(v));
    return { provider, model, available: Boolean(state?.available && match && voicesMatch), message: !local ? "Start the local speech service. You can still type questions." : !match ? "Model settings differ. Restart the speech service with .env.local." : !voicesMatch ? "Configured Kokoro voices were not loaded. Restart the speech service." : state.message };
  }
  return { llm: chat, stt: audio("stt"), tts: audio("tts") };
}
