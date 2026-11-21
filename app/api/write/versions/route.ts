import { resolveArticle, savePost } from "@/lib/posts";
import { writeVersions } from "@/lib/writing";
import { BadRequest, body, ok, route } from "@/lib/http";

export const POST = route(async (req: Request) => {
  const b = await body(req);
  if (!b.angle?.title) throw new BadRequest("Pick an angle first.");
  const a = await resolveArticle(b);
  const r = await writeVersions(a, b.angle, b.provider === "gemini" ? "gemini" : "claude");
  // Saved as an idea right away, like the artifact's savePost.
  const postId = await savePost(b.postId, a, { status: "idea", angle: b.angle, versions: r.versions, photo: r.photo, carousel: r.carousel });
  return ok({ ...r, postId });
});
