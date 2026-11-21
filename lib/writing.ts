// Server side of the Generate tab: angles, versions, long-form, photo queries.
import { write } from "./ai";
import { readVoiceGuide } from "./files";
import { anglesPrompt, buildSystemPrompt, longPrompt, photoQueriesPrompt, versionsPrompt } from "./prompts";
import { AnglesOut, LongOut, QueriesOut, VersionsOut } from "./schemas";
import { getAllDrafts, getPlaybook, latestTrend } from "./state";
import { AiOutputError } from "./ai/errors";
import { VERS } from "./track";
import type { Angle, Article, Provider, Version } from "./types";

export async function systemPrompt(): Promise<string> {
  const [playbook, trend, drafts] = await Promise.all([getPlaybook(), latestTrend(), getAllDrafts()]);
  return buildSystemPrompt({ playbook, voiceGuide: readVoiceGuide(), trend, drafts });
}

export async function writeAngles(a: Article, provider?: Provider, trigger?: string) {
  const r = await write({ kind: "angles", system: await systemPrompt(), prompt: anglesPrompt(a), schema: AnglesOut, provider, trigger });
  return { angles: r.data.angles.slice(0, 3).map((x) => ({ ...x, model: r.model })) as Angle[], provider: r.provider, model: r.model };
}

export async function writeVersions(a: Article, ang: Angle, provider?: Provider, trigger?: string) {
  const r = await write({ kind: "versions", system: await systemPrompt(), prompt: versionsPrompt(a, ang), schema: VersionsOut, provider, trigger });
  const byKey = new Map(r.data.versions.map((v) => [v.key, v]));
  const versions: Version[] = VERS.map((v) => byKey.get(v.k)).filter(Boolean).map((v) => ({
    key: v!.key, hooks: v!.hooks.slice(0, 5), body: v!.body, model: r.model,
  }));
  if (versions.length < 4) throw new AiOutputError("came back incomplete, try again");
  return { versions, photo: r.data.photo || "", carousel: r.data.carousel || [], provider: r.provider, model: r.model };
}

export async function writeLong(a: Article, ang: Angle | null, provider?: Provider) {
  const r = await write({ kind: "long", system: await systemPrompt(), prompt: longPrompt(a, ang), schema: LongOut, provider });
  return { long: { title: r.data.title, body: r.data.body, model: r.model }, provider: r.provider, model: r.model };
}

export async function photoQueries(
  a: Pick<Article, "title" | "summary" | "topic">,
  opts: { post?: string; photoIdea?: string | null; count?: 2 | 3; provider?: Provider } = {},
): Promise<string[]> {
  try {
    const r = await write({
      kind: "photoQueries",
      system: "You suggest stock photo searches. Reply with JSON only.",
      prompt: photoQueriesPrompt(a, opts),
      schema: QueriesOut,
      provider: opts.provider,
    });
    const qs = r.data.queries.map((q) => q.trim()).filter(Boolean).slice(0, opts.count ?? 3);
    if (qs.length) return qs;
  } catch {
    /* fall back to the lane name */
  }
  return [a.topic || "supply chain logistics"];
}
