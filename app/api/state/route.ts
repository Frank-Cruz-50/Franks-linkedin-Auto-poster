import { getState } from "@/lib/state";
import { voiceGuideOrNull } from "@/lib/files";
import { ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";
export const GET = route(async () => ok({ ...(await getState()), voiceGuide: voiceGuideOrNull() }));
