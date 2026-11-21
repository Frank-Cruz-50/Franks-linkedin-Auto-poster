// Unsplash API (free developer app). Search, then trigger the download endpoint
// whenever a photo is actually used, as the API guidelines require.
import type { Photo } from "./types";

const BASE = "https://api.unsplash.com";
const key = () => (process.env.UNSPLASH_ACCESS_KEY || "").trim();
export const unsplashConfigured = () => !!key();
export const UTM = "utm_source=supply_chain_content_engine&utm_medium=referral";
export const withUtm = (u: string) => (u ? u + (u.includes("?") ? "&" : "?") + UTM : `https://unsplash.com/?${UTM}`);

async function get(path: string): Promise<any> {
  if (!key()) throw new Error("Add UNSPLASH_ACCESS_KEY to .env (free app at unsplash.com/developers), then restart.");
  const r = await fetch(BASE + path, {
    headers: { Authorization: `Client-ID ${key()}`, "Accept-Version": "v1" },
    signal: AbortSignal.timeout(20_000),
  });
  if (r.status === 401) throw new Error("Unsplash refused the access key. Check UNSPLASH_ACCESS_KEY in .env.");
  if (r.status === 403) throw new Error("Unsplash rate limit hit (50 searches an hour on a demo app). Try again later.");
  if (!r.ok) throw new Error("Unsplash said: " + r.status);
  return r.json();
}

export function toPhoto(r: any, q: string): Photo {
  return {
    id: r.id,
    thumb: r.urls?.small || "",
    regular: r.urls?.regular || "",
    alt: r.alt_description || r.description || q,
    author: r.user?.name || "Unsplash photographer",
    authorUrl: r.user?.links?.html || "",
    pageUrl: r.links?.html || "",
    downloadLocation: r.links?.download_location || "",
    query: q,
  };
}

export async function searchPhotos(q: string, perPage = 4): Promise<Photo[]> {
  const qs = new URLSearchParams({ query: q, per_page: String(perPage), orientation: "landscape", content_filter: "high" });
  const j = await get(`/search/photos?${qs}`);
  return (j.results || []).filter((r: any) => !r.premium && !r.plus).map((r: any) => toPhoto(r, q));
}

/** Hit the download endpoint (required when a photo is used). Returns the full-size URL. */
export async function trackDownload(p: Photo): Promise<string | null> {
  try {
    const loc = p.downloadLocation || `${BASE}/photos/${encodeURIComponent(p.id)}/download`;
    const path = loc.startsWith(BASE) ? loc.slice(BASE.length) : `/photos/${encodeURIComponent(p.id)}/download`;
    const j = await get(path);
    return j?.url || null;
  } catch {
    return null;
  }
}
