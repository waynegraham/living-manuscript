import { timed } from "@/lib/telemetry";
import { speak } from "@/lib/providers";
import { errorResponse, language, object, readJson, speaker, text } from "@/lib/schemas";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = object(await readJson(request));
    const input = text(body.text); const persona = speaker(body.speaker);
    const responseLanguage = language(body.language);
    const audio = await timed("speak", () => speak(input, persona, responseLanguage));
    return new Response(audio.body, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
