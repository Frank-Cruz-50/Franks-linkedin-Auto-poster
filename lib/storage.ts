// Frank's own photos, stored on local disk under /uploads. Kept behind a tiny
// interface so another store could replace it later.
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { randomBytes } from "node:crypto";

export interface PhotoStore {
  save(bytes: Buffer, ext: string): Promise<string>;
  read(name: string): Promise<Buffer | null>;
}

const DIR = join(process.cwd(), "uploads");
const safe = (name: string) => /^[a-z0-9-]+\.(jpg|png|webp)$/i.test(name) ? basename(name) : null;

export const localStore: PhotoStore = {
  async save(bytes, ext) {
    await mkdir(DIR, { recursive: true });
    const name = `own-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.${ext}`;
    await writeFile(join(DIR, name), bytes);
    return name;
  },
  async read(name) {
    const n = safe(name);
    if (!n) return null;
    try {
      await stat(join(DIR, n));
      return await readFile(join(DIR, n));
    } catch {
      return null;
    }
  },
};

export const MAX_UPLOAD = 20 * 1024 * 1024;

export function sniff(bytes: Buffer): "jpg" | "png" | "webp" | "heic" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "webp";
  const brand = bytes.subarray(4, 12).toString();
  if (/^ftyp(heic|heix|hevc|heim|heis|mif1|msf1)/.test(brand)) return "heic";
  return null;
}

/** HEIC → JPEG with the pure-JS heic-convert package (no paid service, no native deps). */
export async function heicToJpeg(bytes: Buffer): Promise<Buffer> {
  const convert = (await import("heic-convert")).default as any;
  const out = await convert({ buffer: bytes, format: "JPEG", quality: 0.9 });
  return Buffer.from(out);
}
