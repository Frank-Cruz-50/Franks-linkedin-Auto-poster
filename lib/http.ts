import { NextResponse } from "next/server";
import { AiLimitError, AiOutputError, ApiKeyError } from "./ai/errors";
import { TypefullyError } from "./typefully";
import { MissingVoiceGuide } from "./files";

export const ok = (data: unknown = { ok: true }) => NextResponse.json(data);

/** Wrap a route so every known failure turns into a clear message for the UI. */
export function route<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A): Promise<Response> => {
    try {
      return await fn(...a);
    } catch (e: any) {
      if (e instanceof AiLimitError)
        return NextResponse.json(
          { error: e.message, limit: { provider: e.provider, resetsAt: e.resetsAt ? e.resetsAt.toISOString() : null } },
          { status: 429 },
        );
      if (e instanceof ApiKeyError) return NextResponse.json({ error: e.message, apiKey: true }, { status: 403 });
      if (e instanceof TypefullyError) return NextResponse.json({ error: e.message, unclear: e.unclear }, { status: 502 });
      if (e instanceof AiOutputError || e instanceof MissingVoiceGuide || e instanceof BadRequest)
        return NextResponse.json({ error: e.message }, { status: e instanceof BadRequest ? 400 : 502 });
      console.error(e);
      return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
  };
}

export class BadRequest extends Error {}

export async function body<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new BadRequest("Expected a JSON body.");
  }
}

/** Keep only the listed keys. */
export const only = (o: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(Object.entries(o || {}).filter(([k]) => keys.includes(k)));

export type Ctx = { params: Promise<{ id: string }> };
