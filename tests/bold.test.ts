import { describe, expect, it } from "vitest";
import { bold, mdPreview } from "@/lib/bold";

describe("bold()", () => {
  it("converts **text** to Unicode sans-serif bold", () => {
    expect(bold("**AZ09**")).toBe("\u{1D5D4}\u{1D5ED}\u{1D7EC}\u{1D7F5}");
    expect(bold("**a**")).toBe("\u{1D5EE}");
  });
  it("keeps punctuation and spaces, drops the asterisks", () => {
    expect(bold("1. **Plan for air.** Then ship.")).toBe("1. \u{1D5E3}\u{1D5F9}\u{1D5EE}\u{1D5FB} \u{1D5F3}\u{1D5FC}\u{1D5FF} \u{1D5EE}\u{1D5F6}\u{1D5FF}. Then ship.");
  });
  it("handles several bold runs and leaves plain text alone", () => {
    const out = bold("**A** and **B**");
    expect(out).toBe("\u{1D5D4} and \u{1D5D5}");
    expect(bold("no bold here")).toBe("no bold here");
  });
  it("preview escapes HTML and uses <b>", () => {
    expect(mdPreview("<x> **hi**")).toBe("&lt;x&gt; <b>hi</b>");
  });
});
