import { prisma, newId, nowIso } from "../db";

export async function logRun(data: {
  kind: string; trigger?: string; provider?: string; model?: string; status: string;
  error?: string; limitResetsAt?: Date | null; turns?: number; durationMs?: number; startedAt: string; resultRef?: string;
}) {
  try {
    await prisma.jobRun.create({
      data: {
        id: newId("run-"), kind: data.kind, trigger: data.trigger || "manual", provider: data.provider, model: data.model,
        status: data.status, error: data.error, limitResetsAt: data.limitResetsAt ? data.limitResetsAt.toISOString() : null,
        turns: data.turns, durationMs: data.durationMs, startedAt: data.startedAt, finishedAt: nowIso(), resultRef: data.resultRef,
      },
    });
  } catch (e) {
    console.error("Couldn't log AI run", e);
  }
}

