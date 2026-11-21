// Post rows: create on first save (the artifact's savePost), patch afterwards.
import { prisma, newId, nowIso } from "./db";
import { toArticle, toPost } from "./state";
import type { Article } from "./types";

export const POST_KEYS = [
  "status", "angle", "versions", "photo", "carousel", "long", "finalText", "chosenVersion", "chosenHook", "suggestedAtPick",
  "pickedAt", "scheduledFor", "typefullyId", "photoPick", "photoAttached", "impressions", "followersGained", "draftId",
];

export async function resolveArticle(input: { articleId?: string; article?: Partial<Article> }): Promise<Article> {
  const id = input.articleId || input.article?.id;
  if (id) {
    const row = await prisma.article.findUnique({ where: { id } });
    if (row) return toArticle(row);
  }
  const a = input.article || {};
  return {
    id: a.id || "", batchId: "", createdAt: "", tag: (a.tag as any) || "headline", topic: a.topic || "", title: a.title || "",
    source: a.source || "", date: a.date || "", url: a.url || "", summary: a.summary || "", stats: a.stats || [], why: a.why || "",
    extra: a.extra ?? null,
  };
}

/** Create the post the first time, update it after. Returns the post id. */
export async function savePost(postId: string | null | undefined, a: Article, patch: Record<string, unknown>): Promise<string> {
  if (postId && (await prisma.post.findUnique({ where: { id: postId } }))) {
    await prisma.post.update({ where: { id: postId }, data: patch as any });
    return postId;
  }
  const id = newId();
  await prisma.post.create({
    data: {
      id, articleId: a.id || null, articleTitle: a.title, articleUrl: a.url, source: a.source, topic: a.topic || "",
      tag: a.tag || "", createdAt: nowIso(), status: "idea", ...(patch as any),
    },
  });
  return id;
}

export async function getPost(id: string) {
  const p = await prisma.post.findUnique({ where: { id } });
  return p ? toPost(p) : null;
}
