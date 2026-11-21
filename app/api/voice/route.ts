import { marked } from "marked";
import { voiceGuideOrNull } from "@/lib/files";
import { ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";
// Read-only render of FRANK_VOICE.md. It's edited in the file, never from the app.
export const GET = route(async () => {
  const md = voiceGuideOrNull();
  return ok(md == null ? { missing: true } : { html: await marked.parse(md.replace(/<[^>]*>/g, "")) });
});
