import { timed } from "@/lib/telemetry";
import { transcribe } from "@/lib/providers";
import { AppError, errorResponse, language, readBytes } from "@/lib/schemas";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data")) throw new AppError("Send audio as a multipart form upload.");
    const bytes = await readBytes(request, 6 * 1024 * 1024);
    let form: FormData;
    try { form = await new Response(bytes as BodyInit, { headers: { "Content-Type": contentType } }).formData(); }
    catch { throw new AppError("Invalid audio upload form."); }
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024 || !["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/x-wav"].includes(file.type.split(";")[0])) throw new AppError("Send a supported audio recording under 5 MB.");
    const duration = Number(form.get("duration"));
    if (!Number.isFinite(duration) || duration <= 0 || duration > 30.5) throw new AppError("Record for no more than 30 seconds.");
    const recordingLanguage = language(form.get("language") ?? undefined);
    return Response.json({ text: await timed("transcribe", () => transcribe(file, recordingLanguage)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
