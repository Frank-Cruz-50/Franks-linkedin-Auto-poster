// Claude through the Agent SDK, signed in with Frank's Claude Pro plan.
// Never uses ANTHROPIC_API_KEY: if it's set, we refuse to run.
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AiLimitError, AiOutputError, ApiKeyError } from "./errors";
import { isLimitText, parseLimitReset } from "./limit";

export function assertNoApiKey() {
  if ((process.env.ANTHROPIC_API_KEY || "").trim()) throw new ApiKeyError();
}

/** Environment for the Claude Code child: no API keys, so it can only use the plan login. */
function planEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  env.CLAUDE_AGENT_SDK_CLIENT_APP = "supply-chain-content-engine/1.0";
  return env;
}

/** An empty working folder so Claude never sees the repo's files. */
function sandboxDir() {
  const d = join(tmpdir(), "content-engine-claude");
  mkdirSync(d, { recursive: true });
  return d;
}

export interface ClaudeRun {
  system: string;
  prompt: string;
  /** [] for writing; ["WebSearch","WebFetch"] for research. */
  tools: string[];
  maxTurns: number;
  resume?: string;
  onToolUse?: (name: string, input: Record<string, unknown>) => void;
  onText?: (text: string) => void;
  signal?: AbortSignal;
}

export interface ClaudeResult {
  text: string;
  sessionId: string | null;
  turns: number;
  durationMs: number;
  model: string;
}

export async function runClaude(r: ClaudeRun): Promise<ClaudeResult> {
  assertNoApiKey();
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const started = Date.now();
  const abort = new AbortController();
  r.signal?.addEventListener("abort", () => abort.abort());

  let model = "claude";
  let sessionId: string | null = null;
  let limitAt: Date | null = null;
  let limited = false;
  let lastText = "";

  const q = query({
    prompt: r.prompt,
    options: {
      systemPrompt: r.system,
      tools: r.tools,
      allowedTools: r.tools,
      permissionMode: "dontAsk",
      maxTurns: r.maxTurns,
      settingSources: [],
      cwd: sandboxDir(),
      env: planEnv(),
      abortController: abort,
      ...(r.resume ? { resume: r.resume } : {}),
    },
  });

  try {
    for await (const m of q as AsyncIterable<any>) {
      if (m.session_id) sessionId = m.session_id;
      if (m.type === "system" && m.subtype === "init") {
        model = m.model || model;
        if (m.apiKeySource === "ANTHROPIC_API_KEY" || m.apiKeySource === "apiKeyHelper") {
          abort.abort();
          throw new ApiKeyError();
        }
      } else if (m.type === "rate_limit_event") {
        const info = m.rate_limit_info || {};
        if (info.status === "rejected") {
          limited = true;
          if (info.resetsAt) limitAt = new Date(info.resetsAt * (info.resetsAt < 1e12 ? 1000 : 1));
        }
      } else if (m.type === "assistant") {
        if (m.error === "rate_limit") limited = true;
        for (const b of m.message?.content || []) {
          if (b.type === "tool_use") r.onToolUse?.(b.name, b.input || {});
          if (b.type === "text" && b.text) {
            lastText = b.text;
            r.onText?.(b.text);
            if (m.error === "rate_limit" && !limitAt) limitAt = parseLimitReset(b.text);
          }
        }
      } else if (m.type === "result") {
        const turns = m.num_turns ?? 0;
        const durationMs = m.duration_ms ?? Date.now() - started;
        const text = typeof m.result === "string" ? m.result : lastText;
        if (m.subtype === "success" && !m.is_error) return { text, sessionId, turns, durationMs, model };
        if (limited || isLimitText(text)) throw new AiLimitError("claude", limitAt || parseLimitReset(text));
        if (m.subtype === "error_max_turns") throw new AiOutputError(`Claude ran out of turns (${turns}) before finishing.`);
        throw new AiOutputError("Claude stopped with an error: " + (text || m.subtype).slice(0, 300));
      }
    }
  } catch (e: any) {
    if (e instanceof AiLimitError || e instanceof ApiKeyError || e instanceof AiOutputError) throw e;
    const msg = String(e?.message || e);
    if (limited || isLimitText(msg)) throw new AiLimitError("claude", limitAt || parseLimitReset(msg));
    if (/not logged in|login|authenticat|\/login/i.test(msg))
      throw new AiOutputError("Claude Code isn't signed in. Run `claude` in a terminal once and sign in with your Pro account.");
    if (/ENOENT|spawn/i.test(msg)) throw new AiOutputError("Couldn't start Claude Code. Install it (see README) and run `claude` once to sign in.");
    throw new AiOutputError("Claude failed: " + msg.slice(0, 300));
  }
  if (limited) throw new AiLimitError("claude", limitAt);
  throw new AiOutputError("Claude ended without a result.");
}
