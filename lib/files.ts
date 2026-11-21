// Frank's own files on disk: the voice guide and the seed data.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Playbook } from "./types";

export const ROOT = process.cwd();
export const VOICE_PATH = join(ROOT, "FRANK_VOICE.md");
export const SEED_PATH = join(ROOT, "seed", "seed.json");

export class MissingVoiceGuide extends Error {
  constructor() {
    super("FRANK_VOICE.md is missing from the app folder. Copy it in from the starter zip; every writing prompt needs it.");
  }
}

/** FRANK_VOICE.md, read fresh each time so edits to the file apply right away. */
export function readVoiceGuide(): string {
  if (!existsSync(VOICE_PATH)) throw new MissingVoiceGuide();
  return readFileSync(VOICE_PATH, "utf8");
}

export function voiceGuideOrNull(): string | null {
  try {
    return readVoiceGuide();
  } catch {
    return null;
  }
}

export function readSeed(): any | null {
  if (!existsSync(SEED_PATH)) return null;
  return JSON.parse(readFileSync(SEED_PATH, "utf8"));
}

const EMPTY_PB: Playbook = { voice: "", structure: "", guardrails: "", hooks: "", loves: "", banned: "", research: "" };

/** "Restore defaults" = the playbook as it was seeded. */
export function defaultPlaybook(): Playbook {
  const s = readSeed();
  const p = s?.playbook?.[0] || s?.playbook || {};
  return { ...EMPTY_PB, ...Object.fromEntries(Object.keys(EMPTY_PB).map((k) => [k, String(p[k] ?? "")])) } as Playbook;
}
