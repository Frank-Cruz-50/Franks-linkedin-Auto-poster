// npm run seed — loads seed/seed.json. Safe to run twice: every row is upserted by id.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();
const path = join(process.cwd(), "seed", "seed.json");

const pick = <T extends Record<string, any>>(o: T, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const str = (v: any) => (v == null ? null : String(v));
const int = (v: any) => (v == null || v === "" || Number.isNaN(+v) ? null : Math.round(+v));
const json = (v: any) => (v == null ? undefined : v);

async function main() {
  if (!existsSync(path)) {
    console.error("seed/seed.json not found. Copy it in from the starter zip (see README).");
    process.exit(1);
  }
  const d = JSON.parse(readFileSync(path, "utf8"));
  const n: Record<string, number> = {};
  const up = async (model: any, name: string, rows: any[], map: (r: any) => any) => {
    for (const r of rows || []) {
      const data = map(r);
      await model.upsert({ where: { id: r.id }, update: data, create: { id: r.id, ...data } });
    }
    n[name] = (rows || []).length;
  };

  await up(prisma.batch, "batches", d.batches, (b) => ({ createdAt: b.createdAt, note: b.note || "", mix: json(b.mix) }));
  await up(prisma.article, "articles", d.articles, (a) => ({
    ...pick(a, ["batchId", "createdAt", "tag", "topic", "title", "source", "date", "url", "summary", "why", "trendWhy", "trendSource", "trendCheckedAt"]),
    extra: str(a.extra), stats: json(a.stats || []), photos: json(a.photos), trendScore: int(a.trendScore),
  }));
  await up(prisma.trend, "trends", d.trends, (t) => ({ checkedAt: t.checkedAt, source: t.source || "news", topics: json(t.topics || []), formats: json(t.formats || []) }));
  await up(prisma.post, "posts", d.posts, (p) => ({
    ...pick(p, ["articleId", "articleTitle", "articleUrl", "source", "topic", "tag", "createdAt", "status", "photo", "finalText",
      "chosenVersion", "suggestedAtPick", "pickedAt", "scheduledFor", "photoAttached", "draftId"]),
    angle: json(p.angle), versions: json(p.versions), carousel: json(p.carousel), long: json(p.long), photoPick: json(p.photoPick),
    chosenHook: int(p.chosenHook), typefullyId: str(p.typefullyId), impressions: int(p.impressions),
    followersGained: int(p.followersGained), autopilot: !!p.autopilot,
  }));
  await up(prisma.draft, "drafts", d.drafts, (x) => ({
    ...pick(x, ["text", "status", "version", "articleId", "articleTitle", "articleUrl", "source", "topic", "tag", "suggestedAtPick",
      "postId", "scheduledFor", "createdAt", "updatedAt"]),
    learn: x.learn !== false, hook: int(x.hook), typefullyId: str(x.typefullyId), photo: json(x.photo),
    updatedAt: x.updatedAt || x.createdAt, articleTitle: x.articleTitle || "", articleUrl: x.articleUrl || "",
  }));
  const pbRow = Array.isArray(d.playbook) ? d.playbook[0] : d.playbook;
  if (pbRow) await up(prisma.playbook, "playbook", [{ ...pbRow, id: "main" }], (p) =>
    pick(p, ["voice", "structure", "guardrails", "hooks", "loves", "banned", "research", "updatedAt"]));
  const stRow = Array.isArray(d.settings) ? d.settings[0] : d.settings;
  if (stRow) await up(prisma.settings, "settings", [{ ...stRow, id: "main" }], (s) => ({
    ...pick(s, ["autoResearch", "autopilot", "ready85", "ready85At", "followersAt", "searchRequestedAt", "searchHandledAt"]),
    followers: int(s.followers), searchExclude: json(s.searchExclude || []),
  }));
  console.log("Seeded:", Object.entries(n).map(([k, v]) => `${v} ${k}`).join(", "));
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
