// Post linter. Each rule returns a warning; the UI shows them, autopilot banks
// any post that has one instead of scheduling it. Nothing here auto-blocks Frank.

export interface LintIssue { rule: string; message: string }

export interface LintContext {
  /** Comma-separated banned list from the playbook. */
  playbookBanned?: string;
  /** Full text of FRANK_VOICE.md (its "Never use:" line is parsed). */
  voiceGuide?: string;
  /** Article facts: numbers are allowed only if they appear here. */
  article?: { stats?: string[] | null; extra?: string | null; summary?: string | null };
}

const META = /^(emoji|emojis|emoji bullets|more than \d+ hashtags|anything\b)/i;
const clean = (s: string) =>
  s.replace(/[“”"]/g, "").replace(/[’]/g, "'").replace(/^\s*(or|and)\s+/i, "").replace(/[.,;:]+$/, "").trim();

/** Phrases from the playbook's banned field and FRANK_VOICE.md's "Never use" line. */
export function bannedPhrases(ctx: LintContext): string[] {
  const out = new Set<string>();
  for (const part of (ctx.playbookBanned || "").split(",")) {
    const p = clean(part);
    if (p && !META.test(p)) out.add(p.toLowerCase());
  }
  const m = /\*\*Never use:\*\*(.+)/i.exec(ctx.voiceGuide || "");
  if (m) {
    const line = m[1];
    const quoted = [...line.matchAll(/["“]([^"”]+)["”]/g)].map((x) => x[1]);
    const rest = line.replace(/["“][^"”]+["”]/g, ",").split(",");
    for (const part of [...quoted, ...rest]) {
      const p = clean(part);
      if (p && !META.test(p)) out.add(p.toLowerCase());
    }
  }
  return [...out];
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function phraseRegex(phrase: string): RegExp {
  // "it's not just X it's Y" is a pattern, not a literal.
  if (/not just x.*it'?s y/i.test(phrase)) return /\bit'?s not just\b[^.!?\n]{1,60}\bit'?s\b/i;
  const body = escRe(phrase).replace(/'/g, "['’]").replace(/\s+/g, "\\s+");
  const start = /^\w/.test(phrase) ? "\\b" : "";
  const end = /\w$/.test(phrase) ? (phrase.includes(" ") ? "\\b" : "(?:s|d|ed|ing)?\\b") : "";
  return new RegExp(start + body + end, "i");
}

/** Numbers as normalized strings: "1,000" → "1000", "4.10" → "4.1". */
export function numbersIn(s: string): string[] {
  return (String(s || "").match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => {
    const v = n.replace(/,(?=\d{3}\b)/g, "").replace(/,/g, "");
    return String(parseFloat(v));
  });
}

/** Strip numbered-list markers ("1. ", "2) ") so they don't count as facts. */
const stripListMarkers = (s: string) => s.replace(/^\s*\d+[.)]\s+/gm, "");

export function lintPost(text: string, ctx: LintContext = {}): LintIssue[] {
  const t = String(text || "");
  const trimmed = t.trim();
  const out: LintIssue[] = [];

  if (/^I\b/.test(trimmed)) out.push({ rule: "starts-with-i", message: "Starts with “I”." });
  if (/\p{Extended_Pictographic}/u.test(t)) out.push({ rule: "emoji", message: "Contains an emoji." });
  if (/https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|org|net|io|gov|co|ai|us|uk)(\/|\b)/i.test(t))
    out.push({ rule: "url", message: "Contains a link." });

  const hits = bannedPhrases(ctx).filter((p) => phraseRegex(p).test(t));
  if (hits.length) out.push({ rule: "banned", message: `Banned phrase: ${hits.map((h) => `“${h}”`).join(", ")}.` });
  if ((t.match(/#\w/g) || []).length > 3) out.push({ rule: "hashtags", message: "More than 3 hashtags." });

  const n = t.length;
  if (n < 1000 || n > 1500) out.push({ rule: "length", message: `${n.toLocaleString("en-US")} characters; target 1,000–1,500.` });
  if (!trimmed.endsWith("?")) out.push({ rule: "question", message: "Doesn't end with a question." });
  if ((t.match(/\bhonestly\b/gi) || []).length > 1) out.push({ rule: "honestly", message: "Uses “honestly” more than once." });

  if (ctx.article) {
    const a = ctx.article;
    const allowed = new Set(numbersIn([...(a.stats || []), a.extra || "", a.summary || ""].join(" \n ")));
    const bad = [...new Set(numbersIn(stripListMarkers(t)).filter((x) => !allowed.has(x)))];
    if (bad.length) out.push({ rule: "numbers", message: `Number not in the article: ${bad.join(", ")}.` });
  }
  return out;
}
