import { prisma } from "@/lib/db";
import { bold } from "@/lib/bold";
import { getPost } from "@/lib/posts";
import { editDraft, type DraftBody } from "@/lib/typefully";
import { BadRequest, body, ok, route, type Ctx } from "@/lib/http";

/** Calendar → Save changes. Edits here and in Typefully (edit_draft). */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body(req);
  const p = await getPost(id);
  if (!p) throw new BadRequest("That post is gone.");
  const text = String(b.text || "").trim();
  if (!text) throw new BadRequest("The post is empty.");
  const iso = b.when ? new Date(b.when).toISOString() : null;
  if (p.typefullyId && p.status !== "posted") {
    const rb: Partial<DraftBody> = { platforms: { linkedin: { enabled: true, posts: [{ text: bold(text) }] } } };
    if (iso) {
      if (p.status === "scheduled") rb.publish_at = iso;
      else rb.plan_at = iso;
    }
    await editDraft(p.typefullyId, rb);
  }
  await prisma.post.update({ where: { id }, data: { finalText: text, scheduledFor: iso } });
  return ok({ synced: !!p.typefullyId && p.status !== "posted" });
});
