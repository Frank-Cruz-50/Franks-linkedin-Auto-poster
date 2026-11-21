"use client";
// Small client helpers shared by every tab.
import type { AppState, Article, Photo, Provider, Version } from "@/lib/types";

export type State = AppState & { voiceGuide: string | null };

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: any) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const r = await fetch(path, {
    method: opts.method || (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.form ? undefined : opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j?.error || `Request failed (${r.status})`, r.status, j);
  return j as T;
}

export interface GenState {
  article?: Article;
  postId?: string | null;
  angles?: { title: string; take: string; story: string; why?: string; model?: string }[] | null;
  angle?: number | null;
  versions?: Version[] | null;
  v?: string | null;
  hk?: number;
  photo?: string | null;
  carousel?: { h: string; t: string }[] | null;
  long?: { title: string; body: string; model?: string } | null;
  final?: string | null;
  chosen?: string | null;
  photoPick?: Photo | null;
  photos?: Photo[];
  when?: string;
  loading?: null | "ang" | "ver" | "long" | "ph" | "own" | "send";
  provider?: Provider;
  limit?: { resetsAt: string | null; retry: "ang" | "ver" | "long" } | null;
}

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function fmtD(iso?: string | null, tz?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz });
}

export function ago(d?: string | null) {
  if (!d) return "";
  const n = Math.floor((Date.now() - new Date(d + "T12:00").getTime()) / 864e5);
  return n <= 0 ? "today" : n === 1 ? "1 day ago" : n + " days ago";
}

export function agoTs(iso?: string | null) {
  if (!iso) return "";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  return h < 1 ? "just now" : h < 24 ? h + "h ago" : Math.floor(h / 24) + "d ago";
}

export function fmtReset(iso?: string | null, tz?: string) {
  if (!iso) return "later";
  return new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: tz });
}

export const byTrend = (x: Article, y: Article) =>
  (y.trendScore ?? -1) - (x.trendScore ?? -1) || String(x.createdAt).localeCompare(String(y.createdAt));

export async function copyText(t: string, toast: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(t);
    toast("Copied.");
  } catch {
    toast("Copy blocked here. Long-press the text to copy.");
  }
}

export const charCount = (n: number) => `${n.toLocaleString("en-US")} characters · target 1,000–1,500`;
export const badLen = (n: number) => n < 1000 || n > 1500;
