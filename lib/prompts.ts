// Writing prompts. Task text is copied word for word from the artifact's doAngles,
// doVersions and doLong. The shared system prompt is the artifact's rules() plus
// FRANK_VOICE.md in full.
import type { Angle, Article, Draft, Playbook, Trend } from "./types";
import { VL } from "./track";

export const OPENING =
  "You ghostwrite LinkedIn posts for Frank Cruz, who is building a supply chain thought-leadership presence for executives and a general business audience. He should read as competent, plugged-in and likeable.";

export interface PromptContext {
  playbook: Playbook;
  voiceGuide: string;
  trend?: Trend | null;
  drafts?: Draft[];
}

export function trendFormats(t?: Trend | null): string {
  const f = (t && t.formats) || [];
  return f.length
    ? `\nFORMATS TAKING OFF ON LINKEDIN NOW (lean into these when they fit): ${f
        .slice(0, 3)
        .map((x) => x.format + (x.note ? " (" + x.note + ")" : ""))
        .join("; ")}`
    : "";
}

/** Newest 5 drafts marked "learn from this". */
export function learningDrafts(drafts: Draft[] = []): Draft[] {
  return drafts
    .filter((x) => x.learn !== false && x.text)
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
    .slice(0, 5);
}

export function examples(drafts: Draft[] = []): string {
  const d = learningDrafts(drafts);
  if (!d.length) return "";
  return (
    `

FRANK'S BANKED DRAFTS: finished posts he approved. Study them for his voice, rhythm, hook style, takeaway format and closing questions, and write like this. Never copy their sentences, facts or numbers into a new post; facts come only from the ARTICLE.
` +
    d
      .map(
        (x, i) => `--- Example ${i + 1}${x.version ? " (" + VL(x.version) + ")" : ""} ---
${String(x.text).slice(0, 1700)}`,
      )
      .join("\n")
  );
}

/** The shared system prompt for every writing call. */
export function buildSystemPrompt(ctx: PromptContext): string {
  const p = ctx.playbook;
  return `${OPENING}

FRANK'S VOICE GUIDE (follow every rule; run the Final check before returning):
${ctx.voiceGuide.trim()}

VOICE: ${p.voice}
STRUCTURE: ${p.structure}
GUARDRAILS: ${p.guardrails}
HOOKS: ${p.hooks}
WORDS HE LOVES (use naturally, not every post): ${p.loves}
NEVER USE: ${p.banned}${trendFormats(ctx.trend)}${examples(ctx.drafts)}`;
}

export function artBlock(a: Pick<Article, "title" | "source" | "date" | "url" | "summary" | "stats" | "extra">): string {
  return `ARTICLE
Title: ${a.title}
Source: ${a.source} (${a.date || ""})
URL: ${a.url}
Summary: ${a.summary}
Facts you may use (only these numbers): ${(a.stats || []).join(" | ")}
${a.extra ? "More facts: " + a.extra : ""}`;
}

export function anglesPrompt(a: Article): string {
  return `${artBlock(a)}

Task: propose 3 distinct angles for a LinkedIn post on this article. At least one must be contrarian. Mix story types: "news" (tell the real story from the article) or "picture-this" (a clearly hypothetical scene a reader could live through). Each angle needs a sharp take an exec would stop for.
Return JSON only: {"angles":[{"title":"3-7 words","take":"1-2 sentences","story":"news"|"picture-this","why":"why this lands now, 1 sentence"}]}`;
}

export function versionsPrompt(a: Article, ang: Angle): string {
  return `${artBlock(a)}

ANGLE: ${ang.title} — ${ang.take} (story type: ${ang.story})

Task: write this post in 4 versions:
- safe_straight: safe and insightful, no jokes.
- safe_funny: safe and insightful, with 1-2 lines of dry, smart humor.
- contra_straight: a contrarian take, argued with the facts, no jokes.
- contra_funny: the contrarian take with 1-2 lines of dry humor.
For EACH version give 5 different hooks (the first line) and the body that follows the hook. Body is 850-1,350 characters so hook+body lands at 1,000-1,500. Use **double asterisks** only around the bold lead-in of each numbered takeaway. Credit numbers to the source by name in the text, never a link. End with a question to the reader.
Also give one photo idea Frank could shoot or source (no real people's faces, no logos), and a 6-8 slide carousel outline.
Return JSON only: {"versions":[{"key":"safe_straight","hooks":["","","","",""],"body":""},{"key":"safe_funny",...},{"key":"contra_straight",...},{"key":"contra_funny",...}],"photo":"","carousel":[{"h":"slide headline","t":"slide text, under 25 words"}]}`;
}

export function longPrompt(a: Article, ang?: Angle | null): string {
  return `${artBlock(a)}
${ang ? `ANGLE: ${ang.title} — ${ang.take}` : ""}

Task: write a LinkedIn article (newsletter style) of 800-1,000 words, never under 600. Same voice and guardrails, but longer paragraphs are fine (2-4 sentences). Shape: a title, a one-line subtitle, an opening scene (the real news or a clearly hypothetical 'picture this'), 3-4 sections with short plain headings, numbers credited to their source by name, a practical "what to do Monday" section with 3 moves, and a closing question. End with a "Sources" list with the article URL. Use markdown headings (##) and **bold** sparingly.
Return JSON only: {"title":"","subtitle":"","body":"markdown, starting with the subtitle in italics"}`;
}

/** Photo search queries for the Generate tab (3) or a feed card (2). */
export function photoQueriesPrompt(
  a: Pick<Article, "title" | "summary">,
  opts: { post?: string; photoIdea?: string | null; count?: 2 | 3 } = {},
): string {
  if ((opts.count ?? 3) === 2) {
    return `Suggest 2 short Unsplash photo search queries (2-4 words each) for a photo to pair with a LinkedIn post about this news. Literal, visual subjects: ships, ports, trucks, planes, warehouses, factories, servers, screens, packages. No people's faces, no brand logos, no politicians.
TITLE: ${a.title}
SUMMARY: ${a.summary || ""}
Return JSON only: {"queries":["",""]}`;
  }
  return `Suggest 3 short Unsplash photo search queries (2-4 words each) for an image to pair with a LinkedIn post. Literal, visual subjects someone could photograph: ships, ports, trucks, planes, warehouses, factories, servers, screens, packages. No people's faces, no brand logos, no politicians. Each query a different visual idea.
ARTICLE: ${a.title || ""}
POST:
${(opts.post || "").slice(0, 1600)}
${opts.photoIdea ? "PHOTO IDEA: " + opts.photoIdea : ""}
Return JSON only: {"queries":["","",""]}`;
}
