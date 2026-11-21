import { heicToJpeg, localStore, MAX_UPLOAD, sniff } from "@/lib/storage";
import { BadRequest, ok, route } from "@/lib/http";
import type { Photo } from "@/lib/types";

/** Frank's own photo: JPEG/PNG/WebP/HEIC up to 20 MB. HEIC is converted to JPEG. */
export const POST = route(async (req: Request) => {
  const form = await req.formData().catch(() => null);
  const f = form?.get("file");
  if (!f || typeof f === "string") throw new BadRequest("No file received.");
  if (f.size > MAX_UPLOAD) throw new BadRequest("That photo is over 20 MB. Pick a smaller one.");
  let bytes: Buffer = Buffer.from(await f.arrayBuffer());
  let kind = sniff(bytes);
  if (!kind) throw new BadRequest("Use a JPEG, PNG, WebP or HEIC photo.");
  if (kind === "heic") {
    try {
      bytes = await heicToJpeg(bytes);
      kind = "jpg";
    } catch {
      throw new BadRequest("Couldn't convert that HEIC photo. Export it as JPEG and try again.");
    }
  }
  const name = await localStore.save(bytes, kind);
  const photo: Photo = { id: name.replace(/\.\w+$/, ""), own: true, alt: "Your photo", author: "You", url: `/api/uploads/${name}`, file: name };
  return ok({ photo });
});
