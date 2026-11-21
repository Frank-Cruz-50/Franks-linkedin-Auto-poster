import type { Provider } from "../types";

export class AiLimitError extends Error {
  constructor(public provider: Provider, public resetsAt: Date | null, detail = "") {
    super(
      provider === "claude"
        ? `Claude limit reached${resetsAt ? `, resets at ${fmtReset(resetsAt)}` : ""}.`
        : `Gemini limit reached${resetsAt ? `, resets at ${fmtReset(resetsAt)}` : ""}.${detail ? " " + detail : ""}`,
    );
  }
}

export class ApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is set, so Claude Code would bill the paid API instead of your Claude Pro plan. " +
        "AI jobs are off until you remove it from .env and your shell, then restart the app.",
    );
  }
}

export class AiOutputError extends Error {}

export function fmtReset(d: Date, tz = process.env.TZ || "America/New_York"): string {
  try {
    return d.toLocaleString("en-US", { timeZone: tz.trim(), weekday: "short", hour: "numeric", minute: "2-digit" });
  } catch {
    return d.toISOString();
  }
}
