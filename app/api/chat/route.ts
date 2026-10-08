import { timed } from "@/lib/telemetry";
import { chat } from "@/lib/chat";
import { evidenceIds } from "@/lib/manuscript";
import { errorResponse, readJson, validateChat } from "@/lib/schemas";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { message, history } = validateChat(await readJson(request), evidenceIds);
    return Response.json(await timed("chat", () => chat(message, history)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
