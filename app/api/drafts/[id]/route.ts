import { prisma, nowIso } from "@/lib/db";
import { DRAFT_KEYS } from "@/lib/drafts";
import { body, ok, only, route, type Ctx } from "@/lib/http";

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const patch: Record<string, any> = only(await body(req), DRAFT_KEYS);
  if (typeof patch.text === "string") patch.text = patch.text.trim();
  await prisma.draft.update({ where: { id }, data: { ...patch, updatedAt: nowIso() } });
  return ok();
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await prisma.draft.delete({ where: { id } });
  return ok();
});
