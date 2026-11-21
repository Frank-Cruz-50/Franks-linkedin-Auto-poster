import { describe, expect, it } from "vitest";
import { validateBatch } from "@/lib/batchRules";
import { checkReply } from "@/lib/research";
import { LANES } from "@/lib/lanes";

const now = new Date("2026-11-21T15:00:00Z");
const day = (n: number) => new Date(now.getTime() - n * 864e5).toISOString().slice(0, 10);

function good() {
  // 6 lanes, max 2 per lane, 2 evergreen, 9 within 14 days, 1 at 25 days.
  const lanes = [0, 0, 1, 1, 2, 2, 3, 4, 5, 9];
  return lanes.map((l, i) => ({
    tag: i < 2 ? "evergreen" : "headline", topic: LANES[l] as string, title: `Story ${i}`, source: "Reuters",
    date: day(i === 9 ? 25 : i), url: `https://news.test/story-${i}`, summary: "Short. Plain.", stats: ["5% (Reuters)"],
    why: "It matters.", trendScore: 90 - i, trendWhy: "Top story.",
  }));
}

describe("validateBatch()", () => {
  it("accepts a batch that meets every rule", () => {
    expect(validateBatch(good(), { now })).toEqual([]);
  });
  it("needs exactly 10 articles", () => {
    expect(validateBatch(good().slice(0, 9), { now }).join()).toMatch(/exactly 10/);
  });
  it("rejects anything older than 30 days", () => {
    const b = good(); b[9].date = day(31);
    expect(validateBatch(b, { now }).join()).toMatch(/older than 30/);
  });
  it("needs at least 8 within 14 days", () => {
    const b = good(); b[7].date = day(20); b[8].date = day(21);
    expect(validateBatch(b, { now }).join()).toMatch(/at least 8/);
  });
  it("needs at least 5 lanes and no more than 3 per lane", () => {
    const b = good().map((a, i) => ({ ...a, topic: LANES[i % 3] }));
    const e = validateBatch(b, { now }).join();
    expect(e).toMatch(/at least 5 are needed/);
    expect(e).toMatch(/no more than 3 per lane/);
  });
  it("rejects topics that aren't lanes", () => {
    const b = good(); b[0].topic = "Random stuff";
    expect(validateBatch(b, { now }).join()).toMatch(/isn't one of the 10 lanes/);
  });
  it("needs 2–3 evergreen", () => {
    const b1 = good(); b1[1].tag = "headline";
    expect(validateBatch(b1, { now }).join()).toMatch(/1 evergreen/);
    const b4 = good(); b4[2].tag = "evergreen"; b4[3].tag = "evergreen";
    expect(validateBatch(b4, { now }).join()).toMatch(/4 evergreen/);
  });
  it("rejects repeated URLs inside the batch and from earlier batches", () => {
    const b = good(); b[3].url = "https://www.news.test/story-2/";
    expect(validateBatch(b, { now }).join()).toMatch(/appears twice/);
    expect(validateBatch(good(), { now, existingUrls: ["http://news.test/story-4?utm_source=x"] }).join()).toMatch(/already used/);
  });
  it("rejects bad or missing dates", () => {
    const b = good(); b[0].date = "Nov 20";
    expect(validateBatch(b, { now }).join()).toMatch(/No valid publish date/);
  });
});

describe("checkReply()", () => {
  const reply = (articles: unknown) => "Here you go:\n```json\n" + JSON.stringify({ note: "Fresh", articles, trends: { topics: [{ topic: "Ports", heat: 80, why: "x" }], formats: [] } }) + "\n```";
  it("parses and validates a good reply", () => {
    const r = checkReply(reply(good()), { now, existingUrls: [] });
    expect(r.ok).toBe(true);
  });
  it("reports schema problems", () => {
    const b = good() as any[]; delete b[0].url;
    const r = checkReply(reply(b), { now, existingUrls: [] });
    expect(r.ok).toBe(false);
  });
  it("reports non-JSON replies", () => {
    expect(checkReply("sorry, no", { now, existingUrls: [] }).ok).toBe(false);
  });
});
