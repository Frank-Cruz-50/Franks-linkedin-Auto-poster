import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __prisma?: PrismaClient };
export const prisma = g.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;

export const nowIso = () => new Date().toISOString();

/** Short random id, like the artifact's Firestore-style ids. */
export function newId(prefix = ""): string {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  for (const b of bytes) s += a[b % a.length];
  return prefix + s;
}
