import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/state";
import { body, ok, only, route } from "@/lib/http";

const KEYS = ["autoResearch", "autopilot", "ready85", "ready85At", "followers", "followersAt", "searchExclude"];

export const PATCH = route(async (req: Request) => {
  const patch = only(await body(req), KEYS);
  await prisma.settings.upsert({ where: { id: "main" }, update: patch, create: { id: "main", ...patch } });
  return ok(await getSettings());
});
