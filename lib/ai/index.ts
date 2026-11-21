// One interface for the rest of the app: ai.write() and ai.research().
// Writing runs on Claude (Agent SDK, no tools) or Gemini CLI; research runs on Claude only.
import type { z } from "zod";
import { nowIso } from "../db";
import { logRun } from "./log";
import type { Provider } from "../types";
import { runClaude, assertNoApiKey } from "./claude";
import { runGemini } from "./gemini";
import { AiLimitError, AiOutputError, ApiKeyError } from "./errors";
import { extractJson } from "./json";
import { zodMessage } from "../schemas";

export { AiLimitError, AiOutputError, ApiKeyError, assertNoApiKey, logRun };

export const primaryProvider = (): Provider => ((process.env.AI_PRIMARY || "claude").trim() === "gemini" ? "gemini" : "claude");

export interface WriteResult<T> { data: T; provider: Provider; model: string }

/**
 * Run a writing prompt and validate the JSON reply with `schema`.
 * No automatic fallback: on a Claude limit the caller shows the reset time and offers Gemini.
 */
export async function write<T>(opts: {
  kind: string; system: string; prompt: string; schema: z.ZodType<T>; provider?: Provider; trigger?: string;
}): Promise<WriteResult<T>> {
  const provider = opts.provider || primaryProvider();
  const startedAt = nowIso();
  try {
    let text: string, model: string, turns: number, durationMs: number;
    if (provider === "claude") {
      const r = await runClaude({ system: opts.system, prompt: opts.prompt, tools: [], maxTurns: 2 });
      ({ text, model, turns, durationMs } = r);
    } else {
      const r = await runGemini(`${opts.system}\n\n${opts.prompt}`);
      ({ text, model, turns, durationMs } = r);
    }
    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      throw new AiOutputError("The reply came back incomplete (not JSON). Try again.");
    }
    const v = opts.schema.safeParse(parsed);
    if (!v.success) throw new AiOutputError("The reply came back incomplete: " + zodMessage(v.error));
    await logRun({ kind: opts.kind, trigger: opts.trigger, provider, model, status: "ok", turns, durationMs, startedAt });
    return { data: v.data, provider, model };
  } catch (e: any) {
    await logRun({
      kind: opts.kind, trigger: opts.trigger, provider, status: e instanceof AiLimitError ? "limit" : "error",
      error: String(e?.message || e).slice(0, 500), limitResetsAt: e instanceof AiLimitError ? e.resetsAt : null, startedAt,
    });
    throw e;
  }
}

export { runResearch as research } from "../research";
