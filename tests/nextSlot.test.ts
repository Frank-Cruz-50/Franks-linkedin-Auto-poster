import { describe, expect, it } from "vitest";
import { lastResearchSlot, localInput, nextSlot, fromLocalInput } from "@/lib/time";

const NY = "America/New_York";

describe("nextSlot()", () => {
  it("picks the next Mon/Wed/Fri at 7:52am local", () => {
    // Saturday Nov 21 2026, noon in New York → Monday Nov 23 7:52am EST (12:52Z).
    const d = nextSlot([], new Date("2026-11-21T17:00:00Z"), NY);
    expect(d.toISOString()).toBe("2026-11-23T12:52:00.000Z");
  });
  it("uses today when it's a slot day and 7:52 hasn't passed", () => {
    const d = nextSlot([], new Date("2026-11-23T10:00:00Z"), NY); // Mon 5am NY
    expect(d.toISOString()).toBe("2026-11-23T12:52:00.000Z");
  });
  it("skips today once 7:52 has passed", () => {
    const d = nextSlot([], new Date("2026-11-23T13:00:00Z"), NY); // Mon 8:00am NY
    expect(d.toISOString()).toBe("2026-11-25T12:52:00.000Z");
  });
  it("skips days that already have a post", () => {
    const d = nextSlot(["2026-11-23T17:00:00Z", "2026-11-25T12:52:00Z"], new Date("2026-11-21T17:00:00Z"), NY);
    expect(d.toISOString()).toBe("2026-11-27T12:52:00.000Z");
  });
  it("handles daylight saving (EDT in summer)", () => {
    const d = nextSlot([], new Date("2026-07-04T12:00:00Z"), NY); // Sat → Mon Jul 6, 7:52 EDT = 11:52Z
    expect(d.toISOString()).toBe("2026-07-06T11:52:00.000Z");
  });
  it("respects other time zones", () => {
    const d = nextSlot([], new Date("2026-11-21T17:00:00Z"), "America/Los_Angeles");
    expect(d.toISOString()).toBe("2026-11-23T15:52:00.000Z");
  });
  it("round-trips through datetime-local strings", () => {
    const d = new Date("2026-11-23T12:52:00Z");
    expect(localInput(d, NY)).toBe("2026-11-23T07:52");
    expect(fromLocalInput("2026-11-23T07:52", NY)!.toISOString()).toBe(d.toISOString());
  });
});

describe("lastResearchSlot()", () => {
  it("finds the most recent Mon/Wed/Fri 5:47am", () => {
    expect(lastResearchSlot(new Date("2026-11-21T17:00:00Z"), NY).toISOString()).toBe("2026-11-20T10:47:00.000Z");
    expect(lastResearchSlot(new Date("2026-11-23T10:00:00Z"), NY).toISOString()).toBe("2026-11-20T10:47:00.000Z");
    expect(lastResearchSlot(new Date("2026-11-23T11:00:00Z"), NY).toISOString()).toBe("2026-11-23T10:47:00.000Z");
  });
});
