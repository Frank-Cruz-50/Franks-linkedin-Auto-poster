import { POST_KEYS, resolveArticle, savePost } from "@/lib/posts";
import { body, ok, only, route } from "@/lib/http";

/** Create or update a post from the Generate tab ("Calendar only", long-form edits). */
export const POST = route(async (req: Request) => {
  const b = await body(req);
  const a = await resolveArticle(b);
  const postId = await savePost(b.postId, a, only(b.patch || {}, POST_KEYS));
  return ok({ postId });
});
