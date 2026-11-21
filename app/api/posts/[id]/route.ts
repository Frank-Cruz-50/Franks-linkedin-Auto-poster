import { prisma } from "@/lib/db";
import { POST_KEYS, getPost } from "@/lib/posts";
import { deleteDraft } from "@/lib/typefully";
import { BadRequest, body, ok, only, route, type Ctx } from "@/lib/http";

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const patch: Record<string, any> = only(await body(req), POST_KEYS);
  for (const k of ["impressions", "followersGained"])
    if (k in patch) patch[k] = patch[k] === "" || patch[k] == null ? null : Math.round(+patch[k]);
  await prisma.post.update({ where: { id }, data: patch });
  return ok(await getPost(id));
});

/** Delete here and the Typefully draft too (unless it already posted). */
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const p = await getPost(id);
  if (!p) throw new BadRequest("That post is already gone.");
  if (p.typefullyId && p.status !== "posted") await deleteDraft(p.typefullyId);
  await prisma.post.delete({ where: { id } });
  return ok();
});
