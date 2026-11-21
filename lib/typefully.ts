// Typefully REST API v2. Matches the calls the artifact made through the connector:
// create_draft, edit_draft, delete_draft, create_media_upload, get_media_status.
const BASE = "https://api.typefully.com/v2";

export class TypefullyError extends Error {
  constructor(message: string, public unclear = false, public status?: number) {
    super(message);
  }
}

export const UNCLEAR =
  "No clear answer from Typefully. Check its queue before trying again so you don't double-post.";

const key = () => (process.env.TYPEFULLY_API_KEY || "").trim();
export const socialSetId = () => (process.env.TYPEFULLY_SOCIAL_SET_ID || "365181").trim();
export const typefullyConfigured = () => !!key();

export interface DraftBody {
  platforms: { linkedin: { enabled: true; posts: { text: string; media_ids?: string[] }[] } };
  draft_title?: string;
  scratchpad_text?: string;
  publish_at?: string | null;
  plan_at?: string | null;
}

async function call(method: string, path: string, body?: unknown, timeoutMs = 30_000): Promise<any> {
  if (!key()) throw new TypefullyError("Add TYPEFULLY_API_KEY to .env (Typefully → Settings → API), then restart the app.");
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    // Timeout or network drop: the draft may or may not exist. Never retry automatically.
    throw new TypefullyError(UNCLEAR, true);
  }
  const text = await res.text();
  let j: any = null;
  try { j = text ? JSON.parse(text) : null; } catch { j = null; }
  if (res.status >= 500) throw new TypefullyError(UNCLEAR, true, res.status);
  if (!res.ok) {
    const detail = j?.detail || j?.message || j?.error?.message || j?.error || text.slice(0, 200);
    if (res.status === 401 || res.status === 403)
      throw new TypefullyError("Typefully refused the API key (" + res.status + "). Check TYPEFULLY_API_KEY in .env.", false, res.status);
    throw new TypefullyError("Typefully said: " + (typeof detail === "string" ? detail : JSON.stringify(detail)), false, res.status);
  }
  return j;
}

const ss = () => encodeURIComponent(socialSetId());

/** POST /social-sets/{id}/drafts. Never retried. Returns the draft id. */
export async function createDraft(body: DraftBody): Promise<string> {
  const r = await call("POST", `/social-sets/${ss()}/drafts`, body);
  const id = r?.id ?? r?.draft?.id;
  if (id == null) throw new TypefullyError(UNCLEAR, true);
  return String(id);
}

export async function editDraft(draftId: string, body: Partial<DraftBody>): Promise<void> {
  await call("PATCH", `/social-sets/${ss()}/drafts/${encodeURIComponent(draftId)}`, body);
}

export async function deleteDraft(draftId: string): Promise<void> {
  try {
    await call("DELETE", `/social-sets/${ss()}/drafts/${encodeURIComponent(draftId)}`);
  } catch (e) {
    if (e instanceof TypefullyError && e.status === 404) return; // already gone
    throw e;
  }
}

export async function createMediaUpload(fileName: string, altText: string): Promise<{ upload_url: string; media_id: string }> {
  return call("POST", `/social-sets/${ss()}/media/upload`, { file_name: fileName, alt_text: altText.slice(0, 1000) });
}

export async function getMediaStatus(mediaId: string): Promise<string> {
  const r = await call("GET", `/social-sets/${ss()}/media/${encodeURIComponent(mediaId)}`);
  return String(r?.status || r?.state || "").toLowerCase();
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Upload image bytes and wait until Typefully has processed them (every 1.5s, up to 30s).
 * Returns the media id, or null if anything failed (the post still goes out without it).
 */
export async function uploadMedia(bytes: Buffer, fileName: string, altText: string): Promise<string | null> {
  try {
    const up = await createMediaUpload(fileName, altText);
    if (!up?.upload_url || !up?.media_id) return null;
    // Plain PUT, raw bytes, no extra headers: the presigned URL was signed without them.
    const put = await fetch(up.upload_url, { method: "PUT", body: new Uint8Array(bytes), signal: AbortSignal.timeout(60_000) });
    if (!put.ok) return null;
    for (let i = 0; i < 20; i++) {
      await wait(1500);
      let st = "";
      try { st = await getMediaStatus(up.media_id); } catch { /* keep polling */ }
      if (/ready|processed|complete|success|done/.test(st)) return up.media_id;
      if (/fail|error/.test(st)) return null;
    }
    return null;
  } catch {
    return null;
  }
}
