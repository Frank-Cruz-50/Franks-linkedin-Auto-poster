import { defaultPlaybook } from "@/lib/files";
import { ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";
export const GET = route(async () => ok(defaultPlaybook()));
