import { prisma, nowIso } from "@/lib/db";
import { body, ok, route } from "@/lib/http";
import { PB_FIELDS } from "@/lib/types";

export const PUT = route(async (req: Request) => {
  const b = await body(req);
  const data: Record<string, string> = { updatedAt: nowIso() };
  for (const [k] of PB_FIELDS) data[k] = String(b[k] ?? "").trim();
  await prisma.playbook.upsert({ where: { id: "main" }, update: data, create: { id: "main", ...data } });
  return ok(data);
});
