// zod schemas for everything the AI returns. Nothing is written to the database
// until it passes these.
import { z } from "zod";

const str = z.string().trim();

export const AnglesOut = z.object({
  angles: z
    .array(z.object({ title: str.min(1), take: str.min(1), story: str.default("news"), why: str.optional().default("") }))
    .min(1),
});

export const VersionsOut = z.object({
  versions: z.array(
    z.object({
      key: str,
      hooks: z.array(z.string()).min(1),
      body: z.string().default(""),
    }),
  ),
  photo: z.string().optional().default(""),
  carousel: z.array(z.object({ h: z.string(), t: z.string() })).optional().default([]),
});

export const LongOut = z.object({ title: z.string().default(""), subtitle: z.string().optional(), body: z.string().min(1) });

export const QueriesOut = z.object({ queries: z.array(z.string()).default([]) });

const score = z.coerce.number().transform((n) => Math.max(0, Math.min(100, Math.round(n))));

export const ResearchArticle = z.object({
  tag: z.enum(["headline", "evergreen"]),
  topic: str.min(1),
  title: str.min(1),
  source: str.min(1),
  date: str.regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  url: str.url(),
  summary: str.min(1),
  stats: z.array(str).default([]),
  why: str.default(""),
  extra: str.optional(),
  trendScore: score,
  trendWhy: str.default(""),
});

export const ResearchOut = z.object({
  note: str.default(""),
  articles: z.array(ResearchArticle),
  trends: z.object({
    topics: z.array(z.object({ topic: str, heat: score.optional(), why: str.default("") })).default([]),
    formats: z.array(z.object({ format: str, note: str.default("") })).default([]),
  }),
});
export type ResearchOutT = z.infer<typeof ResearchOut>;

/** One-line, human-readable summary of a zod error. */
export function zodMessage(e: z.ZodError): string {
  return e.issues
    .slice(0, 8)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}
