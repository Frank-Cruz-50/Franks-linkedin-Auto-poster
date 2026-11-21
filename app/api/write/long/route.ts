import { resolveArticle, savePost } from "@/lib/posts";
import { writeLong } from "@/lib/writing";
import { body, ok, route } from "@/lib/http";

export const POST = route(async (req: Request) => {
  const b = await body(req);
  const a = await resolveArticle(b);
  const r = await writeLong(a, b.angle || null, b.provider === "gemini" ? "gemini" : "claude");
  const postId = await savePost(b.postId, a, { long: r.long });
  return ok({ ...r, postId });
});
