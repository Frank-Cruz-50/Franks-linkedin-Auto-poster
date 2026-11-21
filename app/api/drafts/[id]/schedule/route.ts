import { prisma, newId, nowIso } from "@/lib/db";
import { publishToTypefully } from "@/lib/publish";
import { toDraft } from "@/lib/state";
import { BadRequest, body, ok, route, type Ctx } from "@/lib/http";

/** Drafts → Schedule in Typefully. The draft stays banked for learning. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body(req);
  const row = await prisma.draft.findUnique({ where: { id } });
  if (!row) throw new BadRequest("That draft is gone.");
  const d = toDraft(row);
  const text = String(b.text || "").trim();
  if (!text) throw new BadRequest("The post is empty.");
  if (!b.when) throw new BadRequest("Pick a date and time.");
  const iso = new Date(b.when).toISOString();
  if (new Date(iso) <= new Date()) throw new BadRequest("Pick a time in the future.");
  const now = nowIso();
  const r = await publishToTypefully({ mode: "schedule", text, title: d.articleTitle || text.split("\n")[0], articleUrl: d.articleUrl, photo: d.photo || null, when: iso });
  const pick = {
    finalText: text, chosenVersion: d.version || null, chosenHook: d.hook ?? 0, suggestedAtPick: d.suggestedAtPick || null, pickedAt: now,
    scheduledFor: iso, status: "scheduled", typefullyId: r.typefullyId, draftId: id, photoPick: (d.photo as any) ?? undefined, photoAttached: r.photoAttached,
  };
  let pid = d.postId && (await prisma.post.findUnique({ where: { id: d.postId } })) ? d.postId : null;
  if (pid) await prisma.post.update({ where: { id: pid }, data: pick });
  else {
    pid = newId();
    await prisma.post.create({
      data: { id: pid, articleId: d.articleId || null, articleTitle: d.articleTitle, articleUrl: d.articleUrl, source: d.source, topic: d.topic, tag: d.tag, createdAt: now, ...pick },
    });
  }
  await prisma.draft.update({ where: { id }, data: { text, status: "scheduled", postId: pid, typefullyId: r.typefullyId, scheduledFor: iso, updatedAt: now } });
  return ok({ ...r, postId: pid });
});
