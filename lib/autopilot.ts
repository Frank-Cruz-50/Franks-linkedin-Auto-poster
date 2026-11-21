// Autopilot (off by default). Runs only after a Mon/Wed/Fri research job, only when
// Frank has turned it on AND his suggested-pick rate hit 85% over 30 picks.
import { prisma, newId, nowIso } from "./db";
import { readVoiceGuide } from "./files";
import { lintPost } from "./lint";
import { publishToTypefully } from "./publish";
import { getAllPosts, getPlaybook, getSettings, toArticle } from "./state";
import { nextSlot, serverTz } from "./time";
import { track } from "./track";
import { writeAngles, writeVersions } from "./writing";
import { logRun } from "./ai/log";

export type AutopilotOutcome =
  | { done: false; reason: string }
  | { done: true; scheduled: boolean; postId: string; draftId?: string; issues: string[] };

export async function runAutopilot(batchId: string): Promise<AutopilotOutcome> {
  const settings = await getSettings();
  if (!settings.autopilot) return { done: false, reason: "Autopilot is off." };
  if (!settings.ready85) return { done: false, reason: "Suggested-pick rate hasn't reached 85% over 30 picks." };
  const startedAt = nowIso();
  const posts = await getAllPosts();
  const t = track(posts);
  if (!t.sug) return { done: false, reason: "No suggested version yet." };

  const used = new Set(posts.map((p) => p.articleId));
  const rows = await prisma.article.findMany({ where: { batchId } });
  const article = rows.map(toArticle).filter((a) => !used.has(a.id)).sort((a, b) => (b.trendScore ?? -1) - (a.trendScore ?? -1))[0];
  if (!article) return { done: false, reason: "Every article in the new batch is already written." };

  const { angles } = await writeAngles(article, "claude", "autopilot");
  const angle = angles[0];
  const v = await writeVersions(article, angle, "claude", "autopilot");
  const V = v.versions.find((x) => x.key === t.sug) || v.versions[0];
  const text = (V.hooks[0] + "\n\n" + V.body).trim();

  const playbook = await getPlaybook();
  const issues = lintPost(text, { playbookBanned: playbook.banned, voiceGuide: readVoiceGuide(), article }).map((i) => i.message);

  const now = nowIso();
  const postId = newId();
  const base = {
    id: postId, articleId: article.id, articleTitle: article.title, articleUrl: article.url, source: article.source,
    topic: article.topic, tag: article.tag, createdAt: now, angle: angle as any, versions: v.versions as any,
    photo: v.photo, carousel: v.carousel as any, finalText: text, chosenVersion: V.key, chosenHook: 0,
    suggestedAtPick: t.sug, pickedAt: now, autopilot: true,
  };

  if (issues.length) {
    const draftId = newId();
    await prisma.post.create({ data: { ...base, status: "idea", draftId } });
    await prisma.draft.create({
      data: {
        id: draftId, text, learn: false, status: "banked", version: V.key, hook: 0, articleId: article.id,
        articleTitle: article.title, articleUrl: article.url, source: article.source, topic: article.topic, tag: article.tag,
        suggestedAtPick: t.sug, postId, createdAt: now, updatedAt: now,
      },
    });
    await logRun({ kind: "autopilot", trigger: "scheduled", provider: "claude", status: "ok", error: "Banked: " + issues.join(" "), startedAt });
    return { done: true, scheduled: false, postId, draftId, issues };
  }

  const when = nextSlot(posts.map((p) => p.scheduledFor), new Date(), serverTz()).toISOString();
  const r = await publishToTypefully({ mode: "schedule", text, title: article.title, articleUrl: article.url, when });
  await prisma.post.create({ data: { ...base, status: "scheduled", scheduledFor: when, typefullyId: r.typefullyId, photoAttached: false } });
  await logRun({ kind: "autopilot", trigger: "scheduled", provider: "claude", status: "ok", startedAt, resultRef: postId });
  return { done: true, scheduled: true, postId, issues };
}
