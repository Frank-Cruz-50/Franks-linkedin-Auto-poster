// npm run cron — the Mon/Wed/Fri 5:47am research job (and autopilot, if Frank turned it on).
// Scheduled runs only fire while the computer is on, so on startup we catch up on
// any run missed in the last 24 hours.
import "dotenv/config";
import cron from "node-cron";
import { prisma } from "../lib/db";
import { startResearch } from "../lib/research";
import { runAutopilot } from "../lib/autopilot";
import { getSettings } from "../lib/state";
import { lastResearchSlot, serverTz } from "../lib/time";

const tz = serverTz();
const log = (...a: unknown[]) => console.log(new Date().toLocaleString("en-US", { timeZone: tz }), "·", ...a);

async function waitForJob(id: string) {
  for (;;) {
    const j = await prisma.jobRun.findUnique({ where: { id } });
    if (!j || j.status !== "running") return j;
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function runScheduled(trigger: "scheduled" | "catchup") {
  const settings = await getSettings();
  if (!settings.autoResearch) return log("Auto-load is off; skipping research.");
  if ((process.env.ANTHROPIC_API_KEY || "").trim())
    return log("ANTHROPIC_API_KEY is set, so AI jobs are off (it would bill the API, not your Pro plan). Remove it and restart.");
  log(`Research starting (${trigger})…`);
  const { jobId, already } = await startResearch(trigger);
  if (already) log("A research run was already going; following it.");
  const job = await waitForJob(jobId);
  if (job?.status !== "ok") return log(`Research ended: ${job?.status} ${job?.error || ""}`.trim());
  log(`New batch ${job.resultRef} saved (${job.turns} turns, ${Math.round((job.durationMs || 0) / 1000)}s).`);
  try {
    const r = await runAutopilot(job.resultRef!);
    log(r.done ? (r.scheduled ? `Autopilot scheduled post ${r.postId}.` : `Autopilot banked a draft (lint): ${r.issues.join(" ")}`) : `Autopilot: ${r.reason}`);
  } catch (e: any) {
    log("Autopilot failed:", e?.message || e);
  }
}

async function catchUp() {
  const slot = lastResearchSlot(new Date(), tz);
  if (Date.now() - slot.getTime() > 24 * 36e5) return;
  const ran = await prisma.jobRun.findFirst({
    where: { kind: "research", trigger: { in: ["scheduled", "catchup"] }, startedAt: { gte: slot.toISOString() } },
  });
  if (ran) return;
  log(`Missed the ${slot.toLocaleString("en-US", { timeZone: tz })} run; catching up now.`);
  await runScheduled("catchup");
}

// 5:47am Mon, Wed, Fri in Frank's time zone.
cron.schedule("47 5 * * 1,3,5", () => void runScheduled("scheduled").catch((e) => log("Run failed:", e)), { timezone: tz });
log(`Cron running. Research fires Mon/Wed/Fri 5:47am (${tz}). Leave this window open, or start it at login (README).`);
void catchUp().catch((e) => log("Catch-up failed:", e));
