import { bankDraft, DRAFT_KEYS } from "@/lib/drafts";
import { BadRequest, body, ok, only, route } from "@/lib/http";

export const POST = route(async (req: Request) => {
  const b = only(await body(req), DRAFT_KEYS);
  if (!String(b.text || "").trim()) throw new BadRequest("Paste a post first.");
  return ok(await bankDraft(b));
});
