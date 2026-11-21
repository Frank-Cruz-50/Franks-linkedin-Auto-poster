// Fallback writer: Gemini CLI in headless mode, signed in with Google AI Pro.
// The prompt goes in on stdin so long prompts and quotes are safe on every OS.
import { spawn } from "node:child_process";
import { AiLimitError, AiOutputError } from "./errors";
import { isLimitText, parseLimitReset } from "./limit";

export interface GeminiResult { text: string; model: string; durationMs: number; turns: number }

export function runGemini(prompt: string, timeoutMs = 5 * 60_000): Promise<GeminiResult> {
  const started = Date.now();
  const win = process.platform === "win32";
  return new Promise((resolve, reject) => {
    let out = "", err = "";
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    const child = spawn("gemini", ["-p", " ", "--output-format", "json"], {
      env, shell: win, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new AiOutputError("Gemini took longer than 5 minutes. Try again."));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e: any) => {
      clearTimeout(timer);
      reject(
        new AiOutputError(
          e?.code === "ENOENT"
            ? "Gemini CLI isn't installed. Run `npm install -g @google/gemini-cli`, then `gemini` once to sign in."
            : "Couldn't start Gemini CLI: " + e?.message,
        ),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      let j: any = null;
      try {
        j = JSON.parse(out);
      } catch {
        const a = out.indexOf("{");
        try { j = a >= 0 ? JSON.parse(out.slice(a)) : null; } catch { j = null; }
      }
      const errText = [j?.error?.message, err, code !== 0 ? out : ""].filter(Boolean).join(" ");
      if (!j || j.error || code !== 0) {
        if (isLimitText(errText)) return reject(new AiLimitError("gemini", parseLimitReset(errText), "Try again later."));
        if (/auth|login|credential/i.test(errText))
          return reject(new AiOutputError("Gemini CLI isn't signed in. Run `gemini` once in a terminal and sign in with your Google AI Pro account."));
        return reject(new AiOutputError("Gemini failed: " + (errText || `exit ${code}`).slice(0, 300)));
      }
      const models = Object.keys(j?.stats?.models || {});
      resolve({ text: String(j.response ?? ""), model: models[0] ? models[0] : "gemini", durationMs: Date.now() - started, turns: 1 });
    });
    child.stdin.end(prompt);
  });
}
