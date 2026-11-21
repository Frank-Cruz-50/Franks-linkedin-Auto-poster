import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { anglesPrompt, artBlock, buildSystemPrompt, OPENING, versionsPrompt } from "@/lib/prompts";
import type { Article, Draft, Playbook } from "@/lib/types";

const voiceGuide = readFileSync(new URL("./fixtures/voice.md", import.meta.url), "utf8");
const playbook: Playbook = { voice: "V1", structure: "S1", guardrails: "G1", hooks: "H1", loves: "juxtaposition", banned: "synergy", research: "R1" };
const draft = (i: number, learn = true): Draft => ({
  id: "d" + i, text: `Draft text ${i}`, learn, status: "banked", articleTitle: "", articleUrl: "", source: "", topic: "", tag: "",
  createdAt: `2026-11-0${i}T00:00:00Z`, updatedAt: `2026-11-0${i}T00:00:00Z`,
});
const article = { id: "a1", title: "Ports jam", source: "Reuters", date: "2026-11-20", url: "https://x.test/a", summary: "Ports jammed.", stats: ["12% (Reuters)"], extra: "More" } as Article;

describe("buildSystemPrompt()", () => {
  const s = buildSystemPrompt({
    playbook, voiceGuide, drafts: [1, 2, 3, 4, 5, 6, 7].map((i) => draft(i, i !== 7)),
    trend: { id: "t", checkedAt: "", source: "news", topics: [], formats: [{ format: "Text posts", note: "5x link posts" }] },
  });
  it("includes FRANK_VOICE.md in full", () => {
    expect(s).toContain("FRANK'S VOICE GUIDE (follow every rule; run the Final check before returning):");
    expect(s).toContain(voiceGuide.trim());
    expect(s).toContain("UNIQUE-VOICE-MARKER-7781");
  });
  it("starts with the rules() opening line and has every playbook field", () => {
    expect(s.startsWith(OPENING)).toBe(true);
    for (const x of ["VOICE: V1", "STRUCTURE: S1", "GUARDRAILS: G1", "HOOKS: H1", "WORDS HE LOVES (use naturally, not every post): juxtaposition", "NEVER USE: synergy"])
      expect(s).toContain(x);
  });
  it("puts the guide before the playbook fields", () => {
    expect(s.indexOf("UNIQUE-VOICE-MARKER-7781")).toBeLessThan(s.indexOf("VOICE: V1"));
  });
  it("adds trend formats and the newest 5 learning drafts only", () => {
    expect(s).toContain("FORMATS TAKING OFF ON LINKEDIN NOW (lean into these when they fit): Text posts (5x link posts)");
    expect(s).toContain("FRANK'S BANKED DRAFTS");
    expect(s).toContain("Draft text 6");
    expect(s).toContain("Draft text 2");
    expect(s).not.toContain("Draft text 1");
    expect(s).not.toContain("Draft text 7");
  });
});

describe("task prompts", () => {
  it("carry the article block with its facts", () => {
    expect(artBlock(article)).toContain("Facts you may use (only these numbers): 12% (Reuters)");
    expect(anglesPrompt(article)).toContain("propose 3 distinct angles");
    expect(versionsPrompt(article, { title: "T", take: "K", story: "news" })).toContain("ANGLE: T — K (story type: news)");
  });
});
