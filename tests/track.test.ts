import { describe, expect, it } from "vitest";
import { track } from "@/lib/track";

const p = (chosenVersion: string, pickedAt: string, suggestedAtPick: string | null = null, autopilot = false) =>
  ({ chosenVersion, pickedAt, suggestedAtPick, autopilot });

describe("track()", () => {
  it("has no suggestion before 3 picks", () => {
    const t = track([p("safe_funny", "2026-01-01"), p("safe_funny", "2026-01-02")]);
    expect(t.sug).toBeNull();
    expect(t.picks).toBe(2);
  });
  it("suggests the most-picked version", () => {
    const t = track([p("safe_funny", "2026-01-01"), p("contra_straight", "2026-01-02"), p("safe_funny", "2026-01-03")]);
    expect(t.sug).toBe("safe_funny");
  });
  it("breaks ties toward the most recent pick", () => {
    const t = track([p("safe_funny", "2026-01-01"), p("contra_straight", "2026-01-04"), p("safe_funny", "2026-01-02"), p("contra_straight", "2026-01-03")]);
    expect(t.sug).toBe("contra_straight");
  });
  it("ignores autopilot posts and posts with no pick", () => {
    const t = track([p("a", "1"), p("a", "2"), p("b", "3", null, true), p("b", "4", null, true), p("b", "5", null, true), { chosenVersion: null } as any]);
    expect(t.picks).toBe(2);
    expect(t.sug).toBeNull();
  });
  it("only looks at the last 30 picks", () => {
    const old = Array.from({ length: 40 }, (_, i) => p("old", `2025-01-${String(i).padStart(2, "0")}`));
    const fresh = Array.from({ length: 30 }, (_, i) => p("new", `2026-02-${String(i).padStart(2, "0")}`));
    const t = track([...old, ...fresh]);
    expect(t.picks).toBe(30);
    expect(t.sug).toBe("new");
  });
  it("rate = hits / picks that had a suggestion; ready at ≥85% over 30", () => {
    const hits = Array.from({ length: 26 }, (_, i) => p("x", `2026-03-${String(i + 10).padStart(2, "0")}`, "x"));
    const misses = Array.from({ length: 4 }, (_, i) => p("y", `2026-03-0${i + 1}`, "x"));
    const t = track([...hits, ...misses]);
    expect(t.n).toBe(30);
    expect(t.hits).toBe(26);
    expect(t.rate).toBeCloseTo(26 / 30);
    expect(t.ready).toBe(true);
    const t2 = track([...hits.slice(0, 25), ...misses, p("y", "2026-03-05", "x")]);
    expect(t2.ready).toBe(false);
  });
  it("is not ready with fewer than 30 suggested picks even at 100%", () => {
    const t = track(Array.from({ length: 10 }, (_, i) => p("x", String(i), "x")));
    expect(t.rate).toBe(1);
    expect(t.ready).toBe(false);
  });
});
