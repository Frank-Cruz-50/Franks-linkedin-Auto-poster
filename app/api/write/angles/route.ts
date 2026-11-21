import { resolveArticle } from "@/lib/posts";
import { writeAngles } from "@/lib/writing";
import { body, ok, route } from "@/lib/http";

export const POST = route(async (req: Request) => {
  const b = await body(req);
  const a = await resolveArticle(b);
  return ok(await writeAngles(a, b.provider === "gemini" ? "gemini" : "claude"));
});
