// Send a finished post to Typefully: attach the photo if we can, bold the lead-ins,
// and put photo instructions in the scratchpad like the artifact's photoNote().
import { bold } from "./bold";
import { createDraft, uploadMedia, type DraftBody } from "./typefully";
import { trackDownload, withUtm } from "./unsplash";
import { localStore } from "./storage";
import type { Photo } from "./types";

export type PublishMode = "schedule" | "draft";

async function photoBytes(p: Photo): Promise<{ bytes: Buffer; ext: string; fullUrl: string | null } | null> {
  if (p.own) {
    const name = p.file || (p.url || "").split("/").pop() || "";
    const b = await localStore.read(name);
    return b ? { bytes: b, ext: name.split(".").pop() || "jpg", fullUrl: null } : null;
  }
  const dl = await trackDownload(p); // required by Unsplash whenever a photo is used
  const u = dl ? dl + (dl.includes("?") ? "&" : "?") + "w=2000" : p.regular;
  if (!u) return null;
  const r = await fetch(u, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) return null;
  const type = r.headers.get("content-type") || "";
  return { bytes: Buffer.from(await r.arrayBuffer()), ext: /png/.test(type) ? "png" : /webp/.test(type) ? "webp" : "jpg", fullUrl: dl };
}

export function photoNote(p: Photo | null | undefined, articleUrl: string | undefined, attached: boolean, fullUrl?: string | null): string {
  const src = articleUrl ? "Source: " + articleUrl : "";
  if (!p) return src;
  if (p.own)
    return (attached ? "PHOTO: your own photo is attached." : "PHOTO: your own photo didn't attach automatically. Add it from your camera roll.") + (src ? "\n\n" + src : "");
  const url = fullUrl || p.pageUrl || "";
  return `${attached ? "PHOTO (already attached)" : "PHOTO (tap, save, attach)"}:\n${url}\n\nCredit: Photo by ${p.author} on Unsplash ${withUtm(p.authorUrl || "")}${src ? "\n\n" + src : ""}`;
}

export async function attachPhoto(p: Photo | null | undefined): Promise<{ mediaId: string | null; fullUrl: string | null }> {
  if (!p) return { mediaId: null, fullUrl: null };
  try {
    const got = await photoBytes(p);
    if (!got) return { mediaId: null, fullUrl: null };
    const file = (p.own ? "my-photo-" : "unsplash-") + String(p.id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) + "." + got.ext;
    const mediaId = await uploadMedia(got.bytes, file, String(p.alt || "Photo"));
    return { mediaId, fullUrl: got.fullUrl };
  } catch {
    return { mediaId: null, fullUrl: null };
  }
}

export interface PublishInput {
  mode: PublishMode;
  text: string;
  title: string;
  articleUrl?: string;
  photo?: Photo | null;
  /** ISO time. Required for schedule; optional "planned" time for a draft. */
  when?: string | null;
}

export async function publishToTypefully(i: PublishInput): Promise<{ typefullyId: string; photoAttached: boolean }> {
  const { mediaId, fullUrl } = await attachPhoto(i.photo);
  const post: { text: string; media_ids?: string[] } = { text: bold(i.text) };
  if (mediaId) post.media_ids = [mediaId];
  const body: DraftBody = { platforms: { linkedin: { enabled: true, posts: [post] } }, draft_title: (i.title || i.text.split("\n")[0]).slice(0, 200) };
  const note = photoNote(i.photo, i.articleUrl, !!mediaId, fullUrl);
  if (note) body.scratchpad_text = note;
  if (i.mode === "schedule") body.publish_at = i.when!;
  else if (i.when) body.plan_at = i.when;
  const typefullyId = await createDraft(body);
  return { typefullyId, photoAttached: !!mediaId };
}
