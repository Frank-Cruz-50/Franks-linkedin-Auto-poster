import { resolveArticle } from "@/lib/posts";
import { photoQueries } from "@/lib/writing";
import { searchPhotos } from "@/lib/unsplash";
import { body, ok, route } from "@/lib/http";
import type { Photo } from "@/lib/types";

/** Generate tab: Claude suggests 3 literal visual queries, then Unsplash search. */
export const POST = route(async (req: Request) => {
  const b = await body(req);
  const a = await resolveArticle(b);
  const qs = await photoQueries(a, { post: b.post, photoIdea: b.photoIdea, count: 3, provider: b.provider === "gemini" ? "gemini" : "claude" });
  const out: Photo[] = [];
  for (const q of qs) for (const p of await searchPhotos(q, 4)) if (!out.some((o) => o.id === p.id)) out.push(p);
  return ok({ photos: out, queries: qs });
});
