import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bannedPhrases, lintPost, numbersIn } from "@/lib/lint";

const voiceGuide = readFileSync(new URL("./fixtures/voice.md", import.meta.url), "utf8");
const playbookBanned = "game-changer, delve, landscape, leverage, it's not just X it's Y, Agree?, emoji bullets, more than 3 hashtags";
const article = { stats: ["Revenue grew 42% to $4.1B (Cirrus)", "Tonnage rose 13% (Cirrus)"], extra: "Q3 2026 results", summary: "Expeditors had a big quarter." };

const pad = (s: string, n = 1100) => s + "\n\n" + "Freight moves when nobody is looking. ".repeat(40).slice(0, n - s.length - 30) + "\n\nWhat are you seeing?";
const rules = (t: string, ctx: any = { playbookBanned, voiceGuide, article }) => lintPost(t, ctx).map((i) => i.rule);

describe("lintPost()", () => {
  it("passes a clean post", () => {
    expect(rules(pad("Revenue grew 42% while tonnage rose 13%."))).toEqual([]);
  });
  it("flags opening with I, but not words like If or In", () => {
    expect(rules(pad("I think freight is back."))).toContain("starts-with-i");
    expect(rules(pad("I'm sure freight is back."))).toContain("starts-with-i");
    expect(rules(pad("If freight is back, watch air."))).not.toContain("starts-with-i");
  });
  it("flags emoji and URLs", () => {
    expect(rules(pad("Freight is back 🚚"))).toContain("emoji");
    expect(rules(pad("Read more at https://example.com/x"))).toContain("url");
    expect(rules(pad("See supplychaindive.com for more"))).toContain("url");
  });
  it("flags banned phrases from the playbook and FRANK_VOICE.md", () => {
    expect(rules(pad("This is a game-changer for ports."))).toContain("banned");
    expect(rules(pad("Let that sink in for a second."))).toContain("banned");
    expect(rules(pad("We leveraged the network."))).toContain("banned");
    expect(rules(pad("It's not just freight, it's people."))).toContain("banned");
    expect(rules(pad("In today’s fast-paced world, ports matter."))).toContain("banned");
    expect(rules(pad("The landscaping crew showed up."))).not.toContain("banned");
  });
  it("parses the voice guide's Never use list", () => {
    const b = bannedPhrases({ voiceGuide });
    expect(b).toEqual(expect.arrayContaining(["synergy", "game-changer", "humbled", "let that sink in", "in today's fast-paced world", "here's the thing nobody tells you"]));
    expect(b.some((x) => x.startsWith("anything"))).toBe(false);
  });
  it("flags length outside 1,000–1,500", () => {
    expect(rules("Short post?")).toContain("length");
    expect(rules(pad("Long.", 1600))).toContain("length");
  });
  it("flags a missing closing question", () => {
    expect(rules(pad("Freight is back.").replace(/\?$/, "."))).toContain("question");
  });
  it("flags more than one honestly", () => {
    expect(rules(pad("Honestly, freight is back. Honestly."))).toContain("honestly");
    expect(rules(pad("Honestly, freight is back."))).not.toContain("honestly");
  });
  it("flags numbers that aren't in the article, ignoring list markers", () => {
    expect(rules(pad("Revenue jumped 57% this quarter."))).toContain("numbers");
    expect(rules(pad("1. **Watch buyers.** Revenue grew 42%.\n2. **Plan air.** $4.1B in Q3 2026."))).not.toContain("numbers");
  });
  it("normalizes number formats", () => {
    expect(numbersIn("1,000 and 4.10 and $60B")).toEqual(["1000", "4.1", "60"]);
  });
});
