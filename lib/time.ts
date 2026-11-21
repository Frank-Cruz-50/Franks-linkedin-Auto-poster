// Time-zone-aware helpers. Everything takes an IANA zone so the server (cron,
// autopilot) and the browser agree on "Mon/Wed/Fri at 7:52am".

export interface ZParts { y: number; m: number; d: number; h: number; mi: number; s: number; wd: number }

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", weekday: "short",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function zonedParts(date: Date, tz: string): ZParts {
  const o: Record<string, string> = {};
  for (const p of fmt(tz).formatToParts(date)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd: WD[o.weekday] };
}

/** Wall-clock time in `tz` → the real instant. */
export function zonedToUtc(y: number, m: number, d: number, h: number, mi: number, tz: string): Date {
  const want = Date.UTC(y, m - 1, d, h, mi);
  let t = want;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(t), tz);
    const got = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
    if (got === want) break;
    t += want - got;
  }
  return new Date(t);
}

export const dayKey = (date: Date, tz: string) => {
  const p = zonedParts(date, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
};

/** "YYYY-MM-DDTHH:mm" for a datetime-local input, in `tz`. */
export function localInput(date: Date, tz: string): string {
  const p = zonedParts(date, tz), z = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${z(p.m)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`;
}

/** Parse a datetime-local value as wall-clock time in `tz`. */
export function fromLocalInput(v: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || "");
  if (!m) return null;
  return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], tz);
}

function addDays(y: number, m: number, d: number, n: number) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
}

/**
 * Port of the artifact's nextSlot(): the next Mon/Wed/Fri at 7:52am that is in the
 * future and has no post scheduled that day.
 */
export function nextSlot(
  scheduled: (string | null | undefined)[],
  now: Date,
  tz: string,
  opts: { hour?: number; minute?: number; days?: number[] } = {},
): Date {
  const { hour = 7, minute = 52, days = [1, 3, 5] } = opts;
  const taken = new Set(scheduled.filter(Boolean).map((s) => dayKey(new Date(s!), tz)));
  const p = zonedParts(now, tz);
  let last: Date = now;
  for (let i = 0; i < 60; i++) {
    const c = addDays(p.y, p.m, p.d, i);
    const slot = zonedToUtc(c.y, c.m, c.d, hour, minute, tz);
    last = slot;
    if (days.includes(c.wd) && slot > now && !taken.has(dayKey(slot, tz))) return slot;
  }
  return last;
}

/** The most recent Mon/Wed/Fri research slot (5:47am) at or before `now`. */
export function lastResearchSlot(now: Date, tz: string, hour = 5, minute = 47, days = [1, 3, 5]): Date {
  const p = zonedParts(now, tz);
  for (let i = 0; i <= 7; i++) {
    const c = addDays(p.y, p.m, p.d, -i);
    if (!days.includes(c.wd)) continue;
    const slot = zonedToUtc(c.y, c.m, c.d, hour, minute, tz);
    if (slot <= now) return slot;
  }
  return new Date(0);
}

export const serverTz = () => (process.env.TZ || "America/New_York").trim();
