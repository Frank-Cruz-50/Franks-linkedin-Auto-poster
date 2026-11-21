// Section 4 rules for a research batch. Used before saving and in the tests.
import { laneOf } from "./lanes";

export interface BatchArticleLike {
  tag: string;
  topic: string;
  date: string;
  url: string;
  trendScore?: number | null;
}

export interface BatchRuleOpts {
  now: Date;
  existingUrls?: Iterable<string>;
}

export const normUrl = (u: string) =>
  String(u || "")
    .trim()
    .replace(/#.*$/, "")
    .replace(/[?&](utm_[^=]+|cmpid|ref)=[^&]*/g, "")
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/+$/, "")
    .toLowerCase();

const DAY = 864e5;
/** Age in whole days of a YYYY-MM-DD publish date, measured from noon UTC that day. */
export const ageDays = (date: string, now: Date) => Math.floor((now.getTime() - Date.parse(date + "T12:00:00Z")) / DAY);

/** Returns a list of broken rules; empty means the batch is valid. */
export function validateBatch(arts: BatchArticleLike[], opts: BatchRuleOpts): string[] {
  const errs: string[] = [];
  if (arts.length !== 10) errs.push(`Batch has ${arts.length} articles; it needs exactly 10.`);

  const ages = arts.map((a) => ({ a, age: /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? ageDays(a.date, opts.now) : NaN }));
  for (const { a, age } of ages) {
    if (Number.isNaN(age)) errs.push(`No valid publish date on ${a.url}.`);
    else if (age > 30) errs.push(`${a.url} is ${age} days old; nothing older than 30 days.`);
    else if (age < -1) errs.push(`${a.url} has a publish date in the future (${a.date}).`);
  }
  const fresh = ages.filter(({ age }) => age <= 14).length;
  if (fresh < 8) errs.push(`Only ${fresh} of ${arts.length} are within 14 days; at least 8 must be.`);

  const lanes: Record<string, number> = {};
  for (const a of arts) {
    const l = laneOf(a.topic);
    if (!l) errs.push(`"${a.topic}" isn't one of the 10 lanes.`);
    else lanes[l] = (lanes[l] || 0) + 1;
  }
  if (Object.keys(lanes).length < 5) errs.push(`Only ${Object.keys(lanes).length} lanes; at least 5 are needed.`);
  for (const [l, n] of Object.entries(lanes)) if (n > 3) errs.push(`${n} articles from "${l}"; no more than 3 per lane.`);

  const ever = arts.filter((a) => a.tag === "evergreen").length;
  if (ever < 2 || ever > 3) errs.push(`${ever} evergreen picks; it needs 2–3.`);

  const seen = new Set<string>();
  const existing = new Set([...(opts.existingUrls || [])].map(normUrl));
  for (const a of arts) {
    const u = normUrl(a.url);
    if (seen.has(u)) errs.push(`${a.url} appears twice in the batch.`);
    if (existing.has(u)) errs.push(`${a.url} was already used in an earlier batch.`);
    seen.add(u);
  }
  for (const a of arts)
    if (a.trendScore == null || a.trendScore < 0 || a.trendScore > 100) errs.push(`${a.url} needs a trendScore from 0 to 100.`);
  return errs;
}
