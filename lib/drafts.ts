import { prisma, newId, nowIso } from "./db";
import { toDraft } from "./state";

export const DRAFT_KEYS = [
  "text", "learn", "status", "version", "hook", "articleId", "articleTitle", "articleUrl", "source", "topic", "tag",
  "suggestedAtPick", "postId", "typefullyId", "scheduledFor", "photo",
];

export async function bankDraft(src: Record<string, any>) {
  const now = nowIso();
  const d = await prisma.draft.create({
    data: {
      id: newId(), learn: true, status: "banked", articleTitle: "", articleUrl: "", source: "", topic: "", tag: "",
      ...src, text: String(src.text || "").trim(), createdAt: now, updatedAt: now,
    },
  });
  return toDraft(d);
}
