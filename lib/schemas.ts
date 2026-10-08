export type ResponseLanguage = "en" | "ar";
export type PersonaId = "manuscript" | "guide";
export type ChatResponse = { speaker: PersonaId; text: string; certainty: "documented" | "interpretation" | "imaginative" | "unknown"; evidenceIds: string[]; viewerAction: null };
export type Turn = ({ role: "user"; text: string } | { role: "assistant"; response: ChatResponse }) & { language?: ResponseLanguage };
export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("Expected a JSON object.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new AppError(`Text must contain 1–${max} characters.`);
  return value.trim();
}
export function speaker(value: unknown): PersonaId {
  if (value !== "manuscript" && value !== "guide") throw new AppError("Choose manuscript or guide.");
  return value;
}
export function language(value: unknown = "en"): ResponseLanguage {
  if (value !== "en" && value !== "ar") throw new AppError("Choose English (en) or Arabic (ar).");
  return value;
}
export const responseSchema = {
  type: "object", additionalProperties: false,
  properties: {
    speaker: { type: "string", enum: ["manuscript", "guide"] },
    text: { type: "string", minLength: 1, maxLength: 2000 },
    certainty: { type: "string", enum: ["documented", "interpretation", "imaginative", "unknown"] },
    evidenceIds: { type: "array", items: { type: "string" }, maxItems: 20 },
    viewerAction: { type: "null" },
  }, required: ["speaker", "text", "certainty", "evidenceIds", "viewerAction"],
};
export function validateResponse(value: unknown, evidenceIds: readonly string[]): ChatResponse {
  const v = object(value);
  if (Object.keys(v).some(k => !Object.keys(responseSchema.properties).includes(k))) throw new AppError("Unexpected response field.");
  const persona = speaker(v.speaker);
  const answer = text(v.text);
  if (!["documented", "interpretation", "imaginative", "unknown"].includes(String(v.certainty))) throw new AppError("Invalid certainty.");
  if (!Array.isArray(v.evidenceIds) || v.evidenceIds.length > 20 || v.evidenceIds.some(id => typeof id !== "string" || !evidenceIds.includes(id))) throw new AppError("Invalid evidence reference.");
  if (v.certainty === "documented" && v.evidenceIds.length === 0) throw new AppError("Documented answers need evidence.");
  if (v.viewerAction !== null) throw new AppError("Viewer actions are not enabled.");
  return { speaker: persona, text: answer, certainty: v.certainty as ChatResponse["certainty"], evidenceIds: v.evidenceIds, viewerAction: null };
}
export function validateChat(value: unknown, evidenceIds: readonly string[]) {
  const v = object(value);
  const message = text(v.message, 500);
  const responseLanguage = language(v.language);
  if (!Array.isArray(v.history) || v.history.length > 20) throw new AppError("History must contain at most 20 turns.");
  const history: Turn[] = v.history.map(item => {
    const turn = object(item);
    const metadata = turn.language === undefined ? {} : { language: language(turn.language) };
    if (turn.role === "user") return { role: "user", text: text(turn.text, 500), ...metadata };
    if (turn.role === "assistant") return { role: "assistant", response: validateResponse(turn.response, evidenceIds), ...metadata };
    throw new AppError("Invalid conversation turn.");
  });
  return { message, history, language: responseLanguage };
}
export async function readJson(request: Request) {
  return JSON.parse(await readBody(request, 64 * 1024));
}
export async function readBody(request: Request, limit: number): Promise<string> {
  const bytes = await readBytes(request, limit);
  return new TextDecoder().decode(bytes);
}
export async function readBytes(request: Request, limit: number): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > limit) throw new AppError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Missing request body.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new AppError("Request is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  return Response.json({ error: "The service could not complete this request. Please try again." }, { status: 502 });
}
