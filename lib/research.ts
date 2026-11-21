// The research job (Find new articles + Mon/Wed/Fri 5:47am). One Claude Agent SDK
// run with only WebSearch and WebFetch, JSON validated with zod and the section 4
// rules, saved in one transaction. Never falls back to Gemini.
import { prisma, newId, nowIso } from "./db";
import { runClaude } from "./ai/claude";
import { AiLimitError, AiOutputError, ApiKeyError } from "./ai/errors";
import { extractJson } from "./ai/json";
import { ResearchOut, zodMessage, type ResearchOutT } from "./schemas";
import { validateBatch } from "./batchRules";
import { LANES, laneOf } from "./lanes";
import { getPlaybook, getSettings, latestTrend } from "./state";
import { zonedParts, serverTz } from "./time";
import type { JobRun } from "./types";

export type ResearchTrigger = "manual" | "scheduled" | "catchup";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STALE_MS = 45 * 60_000;

export const RESEARCH_SYSTEM = `You are the research desk for Frank Cruz's supply chain LinkedIn content engine. You find real, recent news with the WebSearch and WebFetch tools, read each article yourself, and return one JSON object. You never invent articles, dates, numbers or URLs. You stay politically neutral on trade: explain effects, never cheer or attack a politician or party.`;

export interface ResearchInputs {
  today: Date;
  tz: string;
  researchRules: string;
  existingUrls: string[];
  exclude: string[];
  trendTopics: string[];
  bestTopics: { topic: string; impressions: number }[];
}

export function buildResearchPrompt(i: ResearchInputs): string {
  const p = zonedParts(i.today, i.tz);
  const iso = `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  const month = `${MONTHS[p.m - 1]} ${p.y}`;
  return `Today is ${iso}. Build the next batch of 10 articles for Frank's research feed.

RESEARCH RULES (from Frank's playbook):
${i.researchRules}

THE 10 LANES. Set each article's "topic" to exactly one of these names:
${LANES.map((l, n) => `${n + 1}) ${l}`).join("\n")}

STEPS
1. Research about 20 candidates across all 10 lanes. Run at least one separate web search per lane, and at least one search for the week's biggest national and global news (outages, ground stops, cyberattacks, big storms, strikes, shutdowns), even if supply chain outlets haven't covered it yet. Put "${month}" in your queries.
2. Fetch each candidate article with WebFetch and confirm its publish date on the page. Skip any article that shows no date. Every pick must be published within 30 days of ${iso}, and at least 8 of the 10 within 14 days. Use only numbers you read on the page.
3. Score each candidate 0-100:
   - 35 points: LinkedIn-wide heat (major outlets like Reuters, AP, CNBC, Bloomberg, WSJ, NYT, CNN, Axios, Fortune, Business Insider; a top general-news story; or a hot topic in the trend data below)
   - 25 points: breadth (distinct outlets covering it in the last 72 hours)
   - 15 points: velocity
   - 15 points: supply chain and business voices
   - 10 points: Frank's own results (topics near his best impressions below; otherwise give 5)
4. Pick the top 10 with these limits: at least 5 different lanes, no more than 3 from one lane, and 2-3 evergreen. "Evergreen" means a recent report or analysis (still inside 30 days) whose point stays true for months; everything else is "headline".
5. Run one more search for what's trending on LinkedIn and in business news right now: list the top 5 topics, and up to 3 LinkedIn post formats taking off, each with a short note on the evidence.

DO NOT REPEAT. These URLs are already in the feed; pick different stories, not just different links to the same story:
${i.existingUrls.length ? i.existingUrls.map((u) => "- " + u).join("\n") : "- (none)"}

FRANK REJECTED THESE TITLES. Find different stories:
${i.exclude.length ? i.exclude.map((t) => "- " + t).join("\n") : "- (none)"}

LATEST TREND DATA: ${i.trendTopics.length ? i.trendTopics.join("; ") : "(none yet)"}

FRANK'S BEST POSTS BY IMPRESSIONS: ${i.bestTopics.length ? i.bestTopics.map((b) => `${b.topic} (${b.impressions.toLocaleString("en-US")})`).join("; ") : "(no results logged yet; give every article 5 of the 10 points)"}

WRITING RULES FOR EACH ARTICLE
- "title": the source's own headline, as published.
- "summary": 2-4 sentences in plain grade-5 English, in your own words. Never copy sentences from the article.
- "stats": 2-4 hard numbers read on the page, each with its source in parentheses, e.g. "Spot rates rose 12% in October (DAT)".
- "why": one line on why it matters to an exec audience.
- "extra": optional, more facts or a second source.
- "trendWhy": one plain sentence naming the signal behind the score.
- "date": the publish date shown on the page, YYYY-MM-DD.

When you're done, reply with ONLY this JSON (no other text):
{"note":"one line on what's different about this batch","articles":[{"tag":"headline"|"evergreen","topic":"<lane name>","title":"","source":"","date":"YYYY-MM-DD","url":"","summary":"","stats":[""],"why":"","extra":"","trendScore":0,"trendWhy":""}],"trends":{"topics":[{"topic":"","heat":0,"why":""}],"formats":[{"format":"","note":""}]}}`;
}

export function fixPrompt(problems: string): string {
  return `That batch can't be saved yet. Fix these problems, researching replacements with WebSearch and WebFetch if you need to, and keep every other rule:
${problems}

Reply with the complete corrected JSON object only, in the same shape as before.`;
}

/** Parse + validate a reply. Returns the batch or a list of problems. */
export function checkReply(text: string, ctx: { now: Date; existingUrls: string[] }): { ok: true; data: ResearchOutT } | { ok: false; problems: string } {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch {
    return { ok: false, problems: "- The reply wasn't valid JSON." };
  }
  const v = ResearchOut.safeParse(raw);
  if (!v.success) return { ok: false, problems: "- " + zodMessage(v.error) };
  const errs = validateBatch(v.data.articles, { now: ctx.now, existingUrls: ctx.existingUrls });
  if (errs.length) return { ok: false, problems: errs.map((e) => "- " + e).join("\n") };
  return { ok: true, data: v.data };
}

async function setProgress(id: string, progress: string) {
  await prisma.jobRun.update({ where: { id }, data: { progress } }).catch(() => {});
}

/** Start research unless one is already running. Returns the job row id. */
export async function startResearch(trigger: ResearchTrigger, exclude?: string[]): Promise<{ jobId: string; already: boolean }> {
  const running = await prisma.jobRun.findFirst({ where: { kind: "research", status: "running" }, orderBy: { startedAt: "desc" } });
  if (running) {
    if (Date.now() - new Date(running.startedAt).getTime() < STALE_MS) return { jobId: running.id, already: true };
    await prisma.jobRun.update({ where: { id: running.id }, data: { status: "error", error: "Stopped (the app was closed mid-run).", finishedAt: nowIso() } });
  }
  const id = newId("run-");
  await prisma.jobRun.create({ data: { id, kind: "research", trigger, provider: "claude", status: "running", progress: "Starting…", startedAt: nowIso() } });
  const patch: any = { searchRequestedAt: nowIso() };
  if (exclude) patch.searchExclude = exclude;
  await prisma.settings.upsert({ where: { id: "main" }, update: patch, create: { id: "main", ...patch } });
  // Runs in the background; the UI polls the job row.
  void runResearch(id, trigger).catch((e) => console.error("research failed", e));
  return { jobId: id, already: false };
}

export async function runResearch(jobId: string, trigger: ResearchTrigger): Promise<{ batchId: string } | null> {
  const started = Date.now();
  const tz = serverTz();
  let turns = 0;
  try {
    const [playbook, settings, trend, articles, posts] = await Promise.all([
      getPlaybook(), getSettings(), latestTrend(), prisma.article.findMany({ select: { url: true } }),
      prisma.post.findMany({ where: { impressions: { not: null } }, select: { topic: true, impressions: true } }),
    ]);
    const existingUrls = [...new Set(articles.map((a) => a.url).filter(Boolean))];
    const bestTopics = posts
      .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
      .slice(0, 5)
      .map((p) => ({ topic: p.topic || "(no topic)", impressions: p.impressions || 0 }));
    const prompt = buildResearchPrompt({
      today: new Date(), tz, researchRules: playbook.research, existingUrls,
      exclude: settings.searchExclude || [], trendTopics: (trend?.topics || []).map((t) => t.topic), bestTopics,
    });

    let searches = 0, reads = 0;
    const onToolUse = (name: string) => {
      if (name === "WebSearch") searches++;
      if (name === "WebFetch") reads++;
      void setProgress(jobId, reads ? `Reading articles… (${reads} read, ${searches} searches)` : `Searching 10 lanes… (${searches} searches)`);
    };
    const onText = (t: string) => {
      if (/scor/i.test(t)) void setProgress(jobId, `Scoring… (${reads} articles read)`);
    };

    await setProgress(jobId, "Searching 10 lanes…");
    const first = await runClaude({ system: RESEARCH_SYSTEM, prompt, tools: ["WebSearch", "WebFetch"], maxTurns: 80, onToolUse, onText });
    turns += first.turns;
    await setProgress(jobId, "Checking the batch…");
    const now = new Date();
    let check = checkReply(first.text, { now, existingUrls });
    if (!check.ok) {
      await setProgress(jobId, "Fixing the batch…");
      if (!first.sessionId) throw new AiOutputError("Batch failed checks and couldn't be fixed: " + check.problems);
      const second = await runClaude({
        system: RESEARCH_SYSTEM, prompt: fixPrompt(check.problems), tools: ["WebSearch", "WebFetch"], maxTurns: 30,
        resume: first.sessionId, onToolUse, onText,
      });
      turns += second.turns;
      check = checkReply(second.text, { now: new Date(), existingUrls });
      if (!check.ok) throw new AiOutputError("The batch still broke the rules, so nothing was saved:\n" + check.problems);
    }

    await setProgress(jobId, "Saving…");
    const batchId = await saveBatch(check.data, trigger, first.model);
    await prisma.jobRun.update({
      where: { id: jobId },
      data: { status: "ok", progress: "Done", model: first.model, turns, durationMs: Date.now() - started, finishedAt: nowIso(), resultRef: batchId },
    });
    return { batchId };
  } catch (e: any) {
    const limit = e instanceof AiLimitError;
    await prisma.jobRun.update({
      where: { id: jobId },
      data: {
        status: limit ? "limit" : "error",
        error: String(e?.message || e).slice(0, 2000),
        limitResetsAt: limit && e.resetsAt ? e.resetsAt.toISOString() : null,
        turns, durationMs: Date.now() - started, finishedAt: nowIso(),
      },
    }).catch(() => {});
    if (!(limit || e instanceof ApiKeyError || e instanceof AiOutputError)) console.error(e);
    return null;
  }
}

const stamp = (d: Date) => d.toISOString().replace(/\D/g, "").slice(0, 12);

export async function saveBatch(out: ResearchOutT, trigger: ResearchTrigger, model = "claude"): Promise<string> {
  const now = new Date();
  const s = stamp(now);
  const batchId = `b-${now.toISOString().slice(0, 10)}-${s.slice(8, 12)}`;
  const prefix = trigger === "manual" ? "On request" : "Scheduled";
  const headline = out.articles.filter((a) => a.tag === "headline").length;
  const checkedAt = now.toISOString();
  await prisma.$transaction(async (tx) => {
    await tx.batch.create({
      data: {
        id: batchId, createdAt: checkedAt, note: `${prefix}. ${out.note}`.trim(),
        mix: { headline, evergreen: out.articles.length - headline },
      },
    });
    for (const [i, a] of out.articles.entries()) {
      await tx.article.create({
        data: {
          id: `a-${s}-${i + 1}`, batchId, createdAt: new Date(now.getTime() + i * 1000).toISOString(),
          tag: a.tag, topic: laneOf(a.topic) || a.topic, title: a.title, source: a.source, date: a.date, url: a.url,
          summary: a.summary, stats: a.stats, why: a.why, extra: a.extra || null, trendScore: a.trendScore,
          trendWhy: a.trendWhy, trendSource: "news", trendCheckedAt: checkedAt,
        },
      });
    }
    await tx.trend.create({
      data: { id: `t-${s}`, checkedAt, source: "news", topics: out.trends.topics.slice(0, 5), formats: out.trends.formats.slice(0, 3) },
    });
    await tx.settings.upsert({ where: { id: "main" }, update: { searchHandledAt: checkedAt }, create: { id: "main", searchHandledAt: checkedAt } });
  });
  void model;
  return batchId;
}

export type { JobRun };
