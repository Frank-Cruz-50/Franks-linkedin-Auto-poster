import { describe, expect, it } from "vitest";
import { isLimitText, parseLimitReset } from "@/lib/ai/limit";
import { extractJson } from "@/lib/ai/json";

describe("usage-limit parsing", () => {
  const now = new Date("2026-11-21T17:00:00Z"); // noon NY
  it("reads epoch-style messages", () => {
    expect(parseLimitReset("Claude AI usage limit reached|1795000000", now)!.getTime()).toBe(1795000000 * 1000);
  });
  it("reads 'resets 3pm' in the given zone", () => {
    expect(parseLimitReset("You've hit your limit · resets 3pm (America/New_York)", now)!.toISOString()).toBe("2026-11-21T20:00:00.000Z");
  });
  it("rolls to tomorrow when the time already passed", () => {
    expect(parseLimitReset("5-hour limit reached ∙ resets 9am", now, "America/New_York")!.toISOString()).toBe("2026-11-22T14:00:00.000Z");
  });
  it("detects limit text", () => {
    expect(isLimitText("Claude AI usage limit reached")).toBe(true);
    expect(isLimitText("Quota exceeded for quota metric")).toBe(true);
    expect(isLimitText("all good")).toBe(false);
  });
});

describe("extractJson()", () => {
  it("handles fences and chatter", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('blah {"a":2} blah')).toEqual({ a: 2 });
  });
});
