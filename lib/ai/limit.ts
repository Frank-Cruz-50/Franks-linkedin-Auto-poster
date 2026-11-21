// Reads "you hit your usage limit" messages from Claude Code / Gemini CLI.
import { zonedParts, zonedToUtc } from "../time";

export const LIMIT_RE =
  /usage limit|limit reached|hit your (usage )?limit|out of (extra )?usage|rate[_ ]limit|quota exceeded|resource_exhausted|exceeded your current quota|429/i;

export const isLimitText = (s: string) => LIMIT_RE.test(String(s || ""));

/** Best-effort reset time from a limit message. */
export function parseLimitReset(text: string, now = new Date(), tz = process.env.TZ || "America/New_York"): Date | null {
  const s = String(text || "");
  const epoch = /\|(\d{10,13})\b/.exec(s);
  if (epoch) {
    const n = +epoch[1];
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  const m = /resets?(?:\s+at)?\s+(?:(\w{3}\s+\d{1,2},?\s+))?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s*\(([^)]+)\))?/i.exec(s);
  if (!m) return null;
  let h = +m[2];
  const mi = m[3] ? +m[3] : 0;
  const ap = (m[4] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  const zone = (m[5] || tz).trim();
  let p;
  try {
    p = zonedParts(now, zone);
  } catch {
    p = zonedParts(now, tz.trim());
  }
  let d = zonedToUtc(p.y, p.m, p.d, h, mi, zone);
  if (d <= now) d = new Date(d.getTime() + 864e5);
  return d;
}
