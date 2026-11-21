import { prisma } from "@/lib/db";
import { resolveArticle } from "@/lib/posts";
import { photoQueries } from "@/lib/writing";
import { searchPhotos } from "@/lib/unsplash";
import { ok, route, type Ctx } from "@/lib/http";
import type { Photo } from "@/lib/types";

/** Feed card "Find photos": 2 queries, up to 3 photos saved on the article. */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await resolveArticle({ articleId: id });
  const qs = await photoQueries(a, { count: 2 });
  const out: Photo[] = [];
  for (const q of qs) {
    if (out.length >= 3) break;
    for (const p of await searchPhotos(q, 3)) if (out.length < 3 && !out.some((o) => o.id === p.id)) out.push(p);
  }
  if (out.length) await prisma.article.update({ where: { id }, data: { photos: out as any } });
  return ok({ photos: out });
});
