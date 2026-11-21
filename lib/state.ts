// Read everything the UI needs, as plain objects.
import { prisma } from "./db";
import { defaultPlaybook } from "./files";
import type { AppState, Article, Batch, Draft, JobRun, Playbook, Post, Settings, Trend } from "./types";

const strip = <T extends object>(o: T): T => {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) if (v !== null) out[k] = v;
  return out;
};

export async function getPlaybook(): Promise<Playbook> {
  const p = await prisma.playbook.findUnique({ where: { id: "main" } });
  if (!p) return defaultPlaybook();
  const { id: _id, ...rest } = p;
  return rest;
}

export async function getSettings(): Promise<Settings> {
  const s = (await prisma.settings.findUnique({ where: { id: "main" } })) ||
    (await prisma.settings.create({ data: { id: "main" } }));
  const { id: _id, searchExclude, ...rest } = s;
  return { ...rest, searchExclude: (searchExclude as string[]) || [] };
}

export const toArticle = (a: any): Article => strip({ ...a, stats: a.stats || [], photos: a.photos ?? null });
export const toPost = (p: any): Post => strip(p);
export const toDraft = (d: any): Draft => strip(d);

export async function getAllPosts(): Promise<Post[]> {
  return (await prisma.post.findMany()).map(toPost);
}
export async function getAllDrafts(): Promise<Draft[]> {
  return (await prisma.draft.findMany()).map(toDraft);
}
export async function latestTrend(): Promise<Trend | null> {
  const t = await prisma.trend.findFirst({ orderBy: { checkedAt: "desc" } });
  return t ? ({ ...t, topics: (t.topics as any) || [], formats: (t.formats as any) || [] } as Trend) : null;
}

export async function claudeLimit(): Promise<{ resetsAt: string | null } | null> {
  const r = await prisma.jobRun.findFirst({ where: { provider: "claude" }, orderBy: { startedAt: "desc" } });
  if (!r || r.status !== "limit") return null;
  if (r.limitResetsAt && new Date(r.limitResetsAt) < new Date()) return null;
  // Without a reset time, assume a 5-hour window from the hit.
  if (!r.limitResetsAt && Date.now() - new Date(r.startedAt).getTime() > 5 * 36e5) return null;
  return { resetsAt: r.limitResetsAt };
}

export async function latestResearchJob(): Promise<JobRun | null> {
  const r = await prisma.jobRun.findFirst({ where: { kind: "research" }, orderBy: { startedAt: "desc" } });
  return r ? (strip(r) as JobRun) : null;
}

export async function getState(): Promise<AppState> {
  const [articles, batches, trends, posts, drafts, playbook, settings, research, limit] = await Promise.all([
    prisma.article.findMany(),
    prisma.batch.findMany(),
    prisma.trend.findMany(),
    getAllPosts(),
    getAllDrafts(),
    getPlaybook(),
    getSettings(),
    latestResearchJob(),
    claudeLimit(),
  ]);
  return {
    articles: articles.map(toArticle),
    batches: batches.map((b) => strip(b) as Batch),
    trends: trends.map((t) => ({ ...t, topics: (t.topics as any) || [], formats: (t.formats as any) || [] }) as Trend),
    posts,
    drafts,
    playbook,
    settings,
    research,
    claudeLimit: limit,
    aiPrimary: (process.env.AI_PRIMARY || "claude").trim() === "gemini" ? "gemini" : "claude",
    apiKeyBlocked: !!(process.env.ANTHROPIC_API_KEY || "").trim(),
    config: {
      typefully: !!(process.env.TYPEFULLY_API_KEY || "").trim(),
      unsplash: !!(process.env.UNSPLASH_ACCESS_KEY || "").trim(),
      socialSetId: (process.env.TYPEFULLY_SOCIAL_SET_ID || "365181").trim(),
      tz: (process.env.TZ || "America/New_York").trim(),
    },
  };
}
