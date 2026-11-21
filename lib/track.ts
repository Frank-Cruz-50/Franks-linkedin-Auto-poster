import type { Post, VersionKey } from "./types";

export const VERS: { k: VersionKey; l: string }[] = [
  { k: "safe_straight", l: "Safe · straight" },
  { k: "safe_funny", l: "Safe · funny" },
  { k: "contra_straight", l: "Contrarian · straight" },
  { k: "contra_funny", l: "Contrarian · funny" },
];
export const VL = (k?: string | null) => VERS.find((v) => v.k === k)?.l ?? "—";

export interface TrackResult {
  sug: string | null;
  n: number;
  hits: number;
  rate: number;
  ready: boolean;
  picks: number;
}

type TrackPost = Partial<Pick<Post, "chosenVersion" | "autopilot" | "pickedAt" | "suggestedAtPick">>;

/**
 * Port of the artifact's track(): last 30 manual picks, suggested = most-picked
 * version (ties go to the most recent pick), rate = hits / picks that had a suggestion.
 */
export function track(posts: TrackPost[]): TrackResult {
  const picked = posts
    .filter((p) => p.chosenVersion && !p.autopilot)
    .sort((a, b) => String(b.pickedAt || "").localeCompare(String(a.pickedAt || "")))
    .slice(0, 30);
  const c: Record<string, number> = {};
  picked.forEach((p) => (c[p.chosenVersion!] = (c[p.chosenVersion!] || 0) + 1));
  let sug: string | null = null;
  if (picked.length >= 3) {
    sug = Object.keys(c).sort(
      (a, b) =>
        c[b] - c[a] ||
        picked.findIndex((p) => p.chosenVersion === a) - picked.findIndex((p) => p.chosenVersion === b),
    )[0];
  }
  const w = picked.filter((p) => p.suggestedAtPick);
  const hits = w.filter((p) => p.suggestedAtPick === p.chosenVersion).length;
  const rate = w.length ? hits / w.length : 0;
  return { sug, n: w.length, hits, rate, ready: w.length >= 30 && rate >= 0.85, picks: picked.length };
}
