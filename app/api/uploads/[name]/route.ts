import { localStore } from "@/lib/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const b = await localStore.read(name);
  if (!b) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(b), {
    headers: { "Content-Type": TYPES[name.split(".").pop()!.toLowerCase()] || "application/octet-stream", "Cache-Control": "private, max-age=31536000" },
  });
}
