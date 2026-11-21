import { prisma } from "@/lib/db";
import { getPost } from "@/lib/posts";
import { publishToTypefully } from "@/lib/publish";
import { BadRequest, body, ok, route, type Ctx } from "@/lib/http";

/** Generate → Schedule in Typefully / Save as Typefully draft. create_draft is never retried. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body(req);
  const p = await getPost(id);
  if (!p) throw new BadRequest("Write the versions first so the post is saved.");
  const text = String(b.text || "").trim();
  if (!text) throw new BadRequest("The post is empty.");
  const mode = b.mode === "schedule" ? "schedule" : "draft";
  if (mode === "schedule" && !b.when) throw new BadRequest("Pick a date and time.");
  if (mode === "schedule" && new Date(b.when) <= new Date()) throw new BadRequest("Pick a time in the future.");
  const r = await publishToTypefully({ mode, text, title: p.articleTitle || text.split("\n")[0], articleUrl: p.articleUrl, photo: b.photoPick || null, when: b.when || null });
  await prisma.post.update({
    where: { id },
    data: {
      finalText: text, chosenVersion: b.chosenVersion ?? null, chosenHook: b.chosenHook ?? 0, suggestedAtPick: b.suggestedAtPick ?? null,
      pickedAt: new Date().toISOString(), scheduledFor: b.when || null, photoPick: b.photoPick ?? undefined,
      status: mode === "schedule" ? "scheduled" : "draft", typefullyId: r.typefullyId, photoAttached: r.photoAttached,
    },
  });
  return ok(r);
});
