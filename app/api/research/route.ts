import { startResearch } from "@/lib/research";
import { latestResearchJob } from "@/lib/state";
import { assertNoApiKey } from "@/lib/ai/claude";
import { body, ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Find new articles now. `exclude` = titles in the current batch Frank wants replaced. */
export const POST = route(async (req: Request) => {
  assertNoApiKey();
  const b = await body<{ exclude?: string[] }>(req).catch(() => ({}) as { exclude?: string[] });
  const r = await startResearch("manual", Array.isArray(b.exclude) ? b.exclude.map(String).slice(0, 20) : undefined);
  return ok(r);
});

export const GET = route(async () => ok({ job: await latestResearchJob() }));
