"use client";
import { useEffect, useRef, useState } from "react";
import type { Article, Batch, JobRun } from "@/lib/types";
import type { Shared } from "./App";
import { ago, agoTs, api, byTrend, fmtD, fmtReset } from "./client";
import { Img, SeePhoto } from "./Photo";

export default function Feed({ s, reload, toast, go, setGen }: Shared) {
  const [job, setJob] = useState<JobRun | null>(s.research);
  const [phBusy, setPhBusy] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const running = job?.status === "running";

  // Poll the research job while it runs; reload the feed when it lands.
  useEffect(() => {
    if (!running) return;
    poll.current = setInterval(async () => {
      try {
        const { job: j } = await api<{ job: JobRun | null }>("/api/research");
        setJob(j);
        if (j && j.status !== "running") {
          if (poll.current) clearInterval(poll.current);
          await reload();
          toast(j.status === "ok" ? "10 new articles are in." : j.status === "limit" ? "Claude hit its usage limit. Nothing was saved." : "Research didn't finish. Nothing was saved.", 5000);
        }
      } catch {
        /* keep polling */
      }
    }, 2500);
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [running, reload, toast]);

  const bs = [...s.batches].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const used = new Set(s.posts.map((p) => p.articleId));
  const tz = s.config.tz;

  const findNew = async () => {
    const latest = bs[0];
    const exclude = s.articles.filter((a) => latest && a.batchId === latest.id).map((a) => a.title);
    try {
      const r = await api<{ jobId: string; already: boolean }>("/api/research", { body: { exclude } });
      setJob({ id: r.jobId, kind: "research", trigger: "manual", status: "running", progress: "Starting…", startedAt: new Date().toISOString() });
      setDismissed(null);
      toast(r.already ? "A research run is already going. Following it." : "Researching 10 new articles. This takes a few minutes; you can leave this page open.", 5000);
    } catch (e: any) {
      toast(e.message, 7000);
    }
  };

  const findPhotos = async (id: string) => {
    if (phBusy) return;
    setPhBusy(id);
    try {
      const r = await api<{ photos: unknown[] }>(`/api/articles/${id}/photos`, { body: {} });
      toast(r.photos.length ? "Photos added." : "No photos found. Try again.");
      await reload();
    } catch (e: any) {
      toast(e.message, 6000);
    }
    setPhBusy(null);
  };

  const finished = job && job.status !== "running" && job.status !== "ok" && job.finishedAt && Date.now() - new Date(job.finishedAt).getTime() < 6 * 36e5 && dismissed !== job.id;

  const head = (
    <>
      <div className="feedhead">
        <div>
          <h2 className="wide" style={{ margin: 0 }}>
            {bs.length ? "Batch · " + fmtD(bs[0].createdAt, tz) : "Research feed"}
          </h2>
        </div>
        <button className="btn red" onClick={findNew} disabled={running || s.apiKeyBlocked}>
          {running ? (
            <>
              <span className="spin" />
              Researching…
            </>
          ) : (
            "Find new articles"
          )}
        </button>
      </div>
      {running && (
        <p className="note">
          <b>{job!.progress || "Working…"}</b>
          <br />
          Claude is searching 10 lanes, reading about 20 articles and scoring them. It usually takes 5–15 minutes and uses your Claude Pro limits. Nothing is saved until the whole batch passes the checks.
        </p>
      )}
      {finished && (
        <div className="note red">
          {job!.status === "limit" ? (
            <>
              Claude limit reached, resets at {fmtReset(job!.limitResetsAt, tz)}. Nothing was saved. Research needs Claude (Gemini's web reading is weaker and the date rules matter), so try again after the reset.
            </>
          ) : (
            <span style={{ whiteSpace: "pre-wrap" }}>{job!.error || "Research stopped."}</span>
          )}{" "}
          <button className="lnk" onClick={() => setDismissed(job!.id)}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );

  if (!bs.length)
    return (
      <>
        {head}
        <p className="note">No batch yet. Tap Find new articles, or wait for Monday, Wednesday or Friday at 5:47am.</p>
      </>
    );

  const card = (a: Article, i: number) => {
    const days = a.date ? Math.floor((Date.now() - new Date(a.date + "T12:00").getTime()) / 864e5) : 0;
    const dt = a.date ? new Date(a.date + "T12:00") : null;
    return (
      <div className="row" key={a.id}>
        <div className="num wide">
          {(a.date || "").slice(8, 10) || "·"}
          <small>{dt ? dt.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""}</small>
        </div>
        <div>
          <div className="top">
            {a.trendScore != null && (
              <span className="pill red">
                #{i + 1} trending · {a.trendScore}
              </span>
            )}
            <span className={"pill " + (a.tag === "headline" && a.trendScore == null ? "red" : "")}>{a.tag === "headline" ? "This week's headline" : "Evergreen"}</span>
            <span className="meta">{a.topic}</span>
            <span className={"meta " + (days > 30 ? "old" : "")}>
              {ago(a.date)}
              {days > 30 ? " · older than a month" : ""}
            </span>
            {used.has(a.id) && <span className="meta">· written</span>}
          </div>
          <h3>
            <a href={a.url} target="_blank" rel="noopener">
              {a.title} ↗
            </a>
          </h3>
          <div className="meta">{a.source}</div>
          {a.trendWhy && (
            <p className="trend">
              <b>Why it&apos;s trending:</b> {a.trendWhy} <span className="meta">({a.trendSource === "linkedin" ? "LinkedIn check" : "news signals"})</span>
            </p>
          )}
          <p>{a.summary}</p>
          {!!a.stats?.length && (
            <ul className="stats">
              {a.stats.map((x, k) => (
                <li key={k}>{x}</li>
              ))}
            </ul>
          )}
          {a.why && <p className="meta why">{a.why}</p>}
          {!!a.photos?.length && (
            <>
              <div className="meta" style={{ marginTop: 14 }}>
                Photo picks · tap one to write with it
              </div>
              <div className="grid">
                {a.photos.slice(0, 3).map((p) => (
                  <div className="phc" key={p.id}>
                    <button className="ph" aria-label={"Write with this photo: " + (p.alt || "")} onClick={() => { setGen({ article: a, photoPick: p }); go("gen"); }}>
                      <Img p={p} />
                    </button>
                    <SeePhoto p={p} />
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="acts">
            <button className="btn" onClick={() => { setGen({ article: a }); go("gen"); }}>
              Write from this
            </button>
            {!a.photos?.length && (
              <button className="btn ghost" onClick={() => findPhotos(a.id)} disabled={!s.config.unsplash || !!phBusy} title={s.config.unsplash ? "" : "Add UNSPLASH_ACCESS_KEY to .env"}>
                {phBusy === a.id ? (
                  <>
                    <span className="spin" />
                    Finding photos…
                  </>
                ) : (
                  "Find photos"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const block = (b: Batch, open: boolean) => {
    const arts = s.articles.filter((a) => a.batchId === b.id).sort(byTrend);
    const h = arts.filter((a) => a.tag === "headline").length;
    const pc = arts.length ? Math.round((h / arts.length) * 100) : 0;
    return open ? (
      <div key={b.id}>
        <div className="mix">
          <i style={{ width: pc + "%" }} />
          <i style={{ width: 100 - pc + "%" }} />
        </div>
        <p className="meta" style={{ margin: "0 0 8px" }}>
          {pc}% this week&apos;s headlines · {100 - pc}% evergreen{b.note ? " · " + b.note : ""}
        </p>
        {arts.map(card)}
      </div>
    ) : (
      <details key={b.id}>
        <summary>
          Batch · {fmtD(b.createdAt, tz)} ({arts.length})
        </summary>
        {arts.map(card)}
      </details>
    );
  };

  return (
    <>
      {head}
      <TrendPanel s={s} />
      {block(bs[0], true)}
      {bs.length > 1 && (
        <>
          <h3 style={{ marginTop: 40 }}>Earlier batches</h3>
          {bs.slice(1).map((b) => block(b, false))}
        </>
      )}
    </>
  );
}

function TrendPanel({ s }: { s: Shared["s"] }) {
  const t = [...s.trends].sort((a, b) => String(b.checkedAt || "").localeCompare(String(a.checkedAt || "")))[0];
  return (
    <div className="trendbox">
      <div className="feedhead">
        <h3 style={{ margin: 0 }}>What&apos;s trending</h3>
      </div>
      {t ? (
        <>
          <p className="meta" style={{ margin: "6px 0" }}>
            {t.source === "linkedin" ? "Read from your LinkedIn" : "From news signals"} · {agoTs(t.checkedAt)}
          </p>
          {!!t.topics?.length && (
            <ol className="tl">
              {t.topics.slice(0, 5).map((x, i) => (
                <li key={i}>
                  <b>{x.topic}</b>
                  {x.heat != null && <span className="meta"> · heat {x.heat}</span>}
                  <br />
                  <span className="meta">{x.why || ""}</span>
                </li>
              ))}
            </ol>
          )}
          {!!t.formats?.length && (
            <>
              <p className="meta" style={{ margin: "14px 0 0" }}>
                <b>Formats taking off</b>
              </p>
              <ul className="tl">
                {t.formats.slice(0, 3).map((f, i) => (
                  <li key={i}>
                    <b>{f.format}</b>
                    <br />
                    <span className="meta">{f.note || ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <p className="meta">No trend check yet. Each research run ranks articles from news signals.</p>
      )}
      <p className="meta" style={{ marginBottom: 0 }}>
        Trends come from news signals gathered by each research run. The engine doesn&apos;t scrape LinkedIn.
      </p>
    </div>
  );
}
