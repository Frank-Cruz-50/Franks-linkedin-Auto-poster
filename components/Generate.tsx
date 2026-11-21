"use client";
import { useMemo, useRef } from "react";
import { bold, mdPreview } from "@/lib/bold";
import { lintPost } from "@/lib/lint";
import { fromLocalInput, localInput, nextSlot } from "@/lib/time";
import { track, VERS } from "@/lib/track";
import type { Article, Photo, Provider } from "@/lib/types";
import type { Shared } from "./App";
import { api, ApiError, badLen, charCount, copyText, fmtReset, type GenState } from "./client";
import { Credit, Img, SeePhoto } from "./Photo";

export default function Generate({ s, reload, toast, go, gen: g, setGen }: Shared) {
  const t = useMemo(() => track(s.posts), [s.posts]);
  const fileRef = useRef<HTMLInputElement>(null);
  const tz = s.config.tz;
  const provider: Provider = g.provider || s.aiPrimary;
  const up = (patch: Partial<GenState>) => setGen((x) => ({ ...x, ...patch }));
  const a = g.article;
  const lintCtx = { playbookBanned: s.playbook.banned, voiceGuide: s.voiceGuide || "", article: a };

  if (!a) {
    const latest = [...s.articles].sort((x, y) => String(y.createdAt || "").localeCompare(String(x.createdAt || ""))).slice(0, 10);
    return (
      <>
        <h2 className="wide">Pick an article</h2>
        <p className="meta">Choose from the feed, or tap one below.</p>
        {latest.length ? (
          latest.map((x) => (
            <div className="opt" key={x.id} onClick={() => setGen({ article: x })} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setGen({ article: x })}>
              <span className={"pill " + (x.tag === "headline" ? "red" : "")}>{x.tag === "headline" ? "Headline" : "Evergreen"}</span>
              <span>
                {x.title}
                <br />
                <span className="meta">{x.source}</span>
              </span>
            </div>
          ))
        ) : (
          <p className="note">No articles yet.</p>
        )}
      </>
    );
  }

  const can = !s.apiKeyBlocked && !!s.voiceGuide;
  const failed = (e: any, retry: "ang" | "ver" | "long") => {
    if (e instanceof ApiError && e.status === 429 && e.data?.limit?.provider === "claude") {
      up({ loading: null, limit: { resetsAt: e.data.limit.resetsAt, retry } });
      void reload();
      return;
    }
    up({ loading: null });
    toast(e.message || "Writing failed.", 6000);
  };

  const doAngles = async (p: Provider = provider) => {
    up({ loading: "ang", limit: null, provider: p });
    try {
      const r = await api("/api/write/angles", { body: { article: a, articleId: a.id, provider: p } });
      up({ angles: r.angles, angle: 0, versions: null, final: null, loading: null });
    } catch (e) {
      failed(e, "ang");
    }
  };
  const doVersions = async (p: Provider = provider) => {
    const ang = g.angles?.[g.angle ?? 0];
    if (!ang) return;
    up({ loading: "ver", limit: null, provider: p });
    try {
      const r = await api("/api/write/versions", { body: { article: a, articleId: a.id, angle: ang, provider: p, postId: g.postId } });
      up({ versions: r.versions, photo: r.photo, carousel: r.carousel, postId: r.postId, v: t.sug || "safe_straight", hk: 0, final: null, loading: null });
      void reload();
    } catch (e) {
      failed(e, "ver");
    }
  };
  const doLong = async (p: Provider = provider) => {
    const ang = g.angles?.[g.angle ?? 0] || null;
    up({ loading: "long", limit: null, provider: p });
    try {
      const r = await api("/api/write/long", { body: { article: a, articleId: a.id, angle: ang, provider: p, postId: g.postId } });
      up({ long: r.long, postId: r.postId, loading: null });
    } catch (e) {
      failed(e, "long");
    }
  };
  const retryWithGemini = () => {
    const r = g.limit?.retry;
    setGen((x) => ({ ...x, provider: "gemini", limit: null }));
    if (r === "ang") void doAngles("gemini");
    else if (r === "ver") void doVersions("gemini");
    else if (r === "long") void doLong("gemini");
  };

  const cur = g.v || t.sug || "safe_straight";
  const V = g.versions?.find((v) => v.key === cur) || g.versions?.[0];
  const setBody = (body: string) =>
    setGen((x) => ({ ...x, versions: x.versions?.map((v) => (v.key === (x.v || t.sug || "safe_straight") ? { ...v, body } : v)) }));
  const useVersion = () => {
    if (!V) return;
    up({ chosen: V.key, final: V.hooks[g.hk ?? 0] + "\n\n" + V.body });
    setTimeout(() => document.getElementById("compose")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  // Photos
  const pool: Photo[] = (() => {
    const seen = new Set<string>();
    return [...(a.photos || []), ...(g.photos || []), ...(g.photoPick ? [g.photoPick] : [])].filter((p) => p && p.id && !seen.has(p.id) && !!seen.add(p.id));
  })();
  const doPhotos = async () => {
    up({ loading: "ph" });
    try {
      const r = await api<{ photos: Photo[] }>("/api/photos/search", { body: { article: a, articleId: a.id, post: g.final || "", photoIdea: g.photo, provider } });
      setGen((x) => ({ ...x, loading: null, photos: [...r.photos, ...(x.photos || [])].slice(0, 15) }));
      if (!r.photos.length) toast("No photos found. Try again for new searches.");
    } catch (e: any) {
      up({ loading: null });
      toast(e.message, 6000);
    }
  };
  const addOwn = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 20 * 1048576) return toast("That photo is over 20 MB. Pick a smaller one.");
    up({ loading: "own" });
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api<{ photo: Photo }>("/api/uploads", { form });
      setGen((x) => ({ ...x, loading: null, photos: [r.photo, ...(x.photos || [])], photoPick: r.photo }));
    } catch (e: any) {
      up({ loading: null });
      toast("Couldn't add that photo: " + e.message, 5000);
    }
  };

  const whenVal = g.when || localInput(nextSlot(s.posts.map((p) => p.scheduledFor), new Date(), tz), tz);
  const finish = async (mode: "schedule" | "draft" | "cal") => {
    const text = (g.final || "").trim();
    if (!text) return toast("The post is empty.");
    if (mode !== "draft" && !whenVal) return toast("Pick a date and time.");
    const iso = whenVal ? fromLocalInput(whenVal, tz)?.toISOString() || null : null;
    const pick = { finalText: text, chosenVersion: g.chosen, chosenHook: g.hk ?? 0, suggestedAtPick: t.sug || null, pickedAt: new Date().toISOString(), scheduledFor: iso, photoPick: g.photoPick || null };
    try {
      if (mode === "cal" || !g.postId) {
        if (mode !== "cal") throw new Error("Write the versions first so the post is saved.");
        await api("/api/posts", { body: { postId: g.postId, article: a, articleId: a.id, patch: { ...pick, status: "planned" } } });
        toast("Saved to your calendar.");
      } else {
        up({ loading: "send" });
        const r = await api(`/api/posts/${g.postId}/publish`, {
          body: { mode, text, when: iso, photoPick: g.photoPick || null, chosenVersion: g.chosen, chosenHook: g.hk ?? 0, suggestedAtPick: t.sug || null },
        });
        toast((mode === "schedule" ? "Scheduled in Typefully." : "Saved in Typefully as a draft.") + (g.photoPick ? (r.photoAttached ? " Photo attached." : " Photo didn't attach; add it in Typefully.") : ""), 5000);
      }
      setGen({});
      await reload();
      go("cal");
    } catch (e: any) {
      up({ loading: null });
      toast(e.message, e?.data?.unclear ? 9000 : 6000);
    }
  };
  const bank = async () => {
    const text = (g.final || "").trim();
    if (!text) return toast("The post is empty.");
    try {
      await api("/api/drafts", {
        body: { text, articleId: a.id || null, articleTitle: a.title, articleUrl: a.url, source: a.source, topic: a.topic || "", tag: a.tag || "", version: g.chosen || null, hook: g.hk ?? 0, suggestedAtPick: t.sug || null, postId: g.postId || null, photo: g.photoPick || null },
      });
      toast("Banked in Drafts. Writing now learns from it.");
      setGen({});
      await reload();
      go("drafts");
    } catch (e: any) {
      toast("Couldn't bank: " + e.message, 5000);
    }
  };

  const spin = (label: string) => (
    <>
      <span className="spin" />
      {label}
    </>
  );
  const vLint = V ? lintPost(V.hooks[g.hk ?? 0] + "\n\n" + V.body, lintCtx) : [];
  const fLint = g.final != null ? lintPost(g.final, lintCtx) : [];
  const n = (g.final || "").length;

  return (
    <>
      <div className="card">
        <span className={"pill " + (a.tag === "headline" ? "red" : "")}>{a.tag === "headline" ? "This week's headline" : "Evergreen"}</span>
        <h2 className="wide">{a.title}</h2>
        <p className="meta">
          <a href={a.url} target="_blank" rel="noopener">
            {a.source} ↗
          </a>{" "}
          · {a.summary}
        </p>
        <div className="writer">
          <label htmlFor="writer" className="meta">
            Writer
          </label>
          <select id="writer" value={provider} onChange={(e) => up({ provider: e.target.value as Provider })}>
            <option value="claude">Claude (your Pro plan)</option>
            <option value="gemini">Gemini (your Google AI Pro)</option>
          </select>
          <button className="btn ghost" onClick={() => setGen({})}>
            Change article
          </button>
        </div>
      </div>
      {!can && <p className="note red">{s.apiKeyBlocked ? "Writing is off while ANTHROPIC_API_KEY is set." : "Writing needs FRANK_VOICE.md in the app folder."}</p>}
      {g.limit && (
        <div className="note red">
          Claude limit reached, resets at {fmtReset(g.limit.resetsAt, tz)}.
          <div className="acts" style={{ marginTop: 10 }}>
            <button className="btn" onClick={retryWithGemini}>
              Write with Gemini instead
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <span className="step">Step 1</span>
        <h3>Angles</h3>
        {g.angles?.map((x, i) => (
          <label className="opt" key={i}>
            <input type="radio" name="ang" checked={(g.angle ?? 0) === i} onChange={() => up({ angle: i })} />
            <span>
              <b>{x.title}</b> <span className="pill">{x.story === "picture-this" ? "Picture this" : "News story"}</span>
              <br />
              {x.take}
              <br />
              <span className="meta">{x.why || ""}</span>
            </span>
          </label>
        ))}
        {g.angles?.[0]?.model && <p className="by">Written by {g.angles[0].model}</p>}
        <div className="acts">
          <button className={"btn " + (g.angles ? "ghost" : "")} onClick={() => doAngles()} disabled={!can || !!g.loading}>
            {g.loading === "ang" ? spin("Finding angles…") : g.angles ? "New angles" : "Find 3 angles"}
          </button>
        </div>
      </div>

      {(g.angles || g.versions) && (
        <div className="card">
          <span className="step">Step 2</span>
          <h3>Four versions, five hooks each</h3>
          <div className="acts">
            <button className={"btn " + (g.versions ? "ghost" : "")} onClick={() => doVersions()} disabled={!can || !g.angles || g.angle == null || !!g.loading}>
              {g.loading === "ver" ? spin("Writing 4 versions…") : g.versions ? "Rewrite versions" : "Write 4 versions"}
            </button>
          </div>
          {V && (
            <>
              <div className="seg">
                {VERS.map((v) => {
                  const vv = g.versions!.find((x) => x.key === v.k);
                  const bad = vv ? lintPost(vv.hooks[0] + "\n\n" + vv.body, lintCtx).length : 0;
                  return (
                    <button key={v.k} aria-pressed={v.k === V.key} onClick={() => up({ v: v.k, hk: 0 })}>
                      {t.sug === v.k && <em>Suggested</em>}
                      {v.l}
                      {bad > 0 && <em style={{ color: "var(--mut)", fontWeight: 600 }}>{bad} warning{bad > 1 ? "s" : ""}</em>}
                    </button>
                  );
                })}
              </div>
              {V.model && <p className="by">Written by {V.model}</p>}
              <label className="f">Hooks</label>
              {V.hooks.map((x, i) => (
                <label className="opt" key={i}>
                  <input type="radio" name="hk" checked={(g.hk ?? 0) === i} onChange={() => up({ hk: i })} />
                  <span>{x}</span>
                </label>
              ))}
              <label className="f" htmlFor="vBody">
                Body (after the hook)
              </label>
              <textarea id="vBody" style={{ minHeight: 260 }} value={V.body} onChange={(e) => setBody(e.target.value)} />
              <LintList issues={vLint} />
              {g.photo && (
                <details>
                  <summary>Photo idea</summary>
                  <p>{g.photo}</p>
                </details>
              )}
              {!!g.carousel?.length && (
                <details>
                  <summary>Carousel outline ({g.carousel.length} slides)</summary>
                  {g.carousel.map((sl, i) => (
                    <p key={i}>
                      <b>
                        Slide {i + 1}: {sl.h}
                      </b>
                      <br />
                      {sl.t}
                    </p>
                  ))}
                  <button className="btn ghost" onClick={() => copyText(g.carousel!.map((sl, i) => `Slide ${i + 1}: ${sl.h}\n${sl.t}`).join("\n\n"), toast)}>
                    Copy outline
                  </button>
                </details>
              )}
              <div className="acts">
                <button className="btn red" onClick={useVersion}>
                  Use this version
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {g.versions && (
        <div className="card">
          <span className="step">Step 3</span>
          <h3>Long-form article · 800–1,000 words</h3>
          {g.long && (
            <>
              <input type="text" aria-label="Article title" value={g.long.title} onChange={(e) => up({ long: { ...g.long!, title: e.target.value } })} />
              <label className="f" htmlFor="lBody">
                Body · {(g.long.body || "").split(/\s+/).filter(Boolean).length} words
              </label>
              <textarea id="lBody" style={{ minHeight: 360 }} value={g.long.body} onChange={(e) => up({ long: { ...g.long!, body: e.target.value } })} />
              {g.long.model && <p className="by">Written by {g.long.model}</p>}
              <div className="acts">
                <button className="btn ghost" onClick={() => copyText(g.long!.title + "\n\n" + g.long!.body, toast)}>
                  Copy article
                </button>
                <button
                  className="btn ghost"
                  onClick={async () => {
                    try {
                      const r = await api("/api/posts", { body: { postId: g.postId, article: a, articleId: a.id, patch: { long: g.long } } });
                      up({ postId: r.postId });
                      toast("Article saved.");
                    } catch (e: any) {
                      toast("Couldn't save: " + e.message);
                    }
                  }}
                >
                  Save edits
                </button>
              </div>
            </>
          )}
          <div className="acts">
            <button className={"btn " + (g.long ? "ghost" : "")} onClick={() => doLong()} disabled={!can || !!g.loading}>
              {g.loading === "long" ? spin("Writing article…") : g.long ? "Rewrite article" : "Write the article"}
            </button>
          </div>
        </div>
      )}

      {g.final != null && (
        <div className="card" id="compose">
          <span className="step">Step 4</span>
          <h3>Final post</h3>
          <textarea style={{ minHeight: 320 }} value={g.final} onChange={(e) => up({ final: e.target.value })} aria-label="Final post" />
          <div className={"count " + (badLen(n) ? "bad" : "")}>{charCount(n)}</div>
          <LintList issues={fLint} />
          <details>
            <summary>Preview with bold lead-ins</summary>
            <div className="prev" dangerouslySetInnerHTML={{ __html: mdPreview(g.final) }} />
          </details>

          <label className="f">Photo</label>
          {g.photoPick ? (
            <>
              <div className="thumb">
                <Img p={g.photoPick} />
              </div>
              <div className="meta phc">
                <Credit p={g.photoPick} />
                {!g.photoPick.own && (
                  <>
                    {" "}· <SeePhoto p={g.photoPick} />
                  </>
                )}{" "}
                ·{" "}
                <button className="lnk" onClick={() => up({ photoPick: null })}>
                  Remove
                </button>
              </div>
            </>
          ) : (
            <p className="meta" style={{ margin: 0 }}>
              Pick one, or use your own. When you schedule, the engine attaches it in Typefully for you.
            </p>
          )}
          {!!pool.length && (
            <div className="grid">
              {pool.map((p) => (
                <div className="phc" key={p.id}>
                  <button className="ph" aria-pressed={g.photoPick?.id === p.id} aria-label={p.alt || "Photo"} onClick={() => up({ photoPick: g.photoPick?.id === p.id ? null : p })}>
                    <Img p={p} />
                  </button>
                  <SeePhoto p={p} />
                </div>
              ))}
            </div>
          )}
          <div className="acts" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={doPhotos} disabled={!s.config.unsplash || !!g.loading} title={s.config.unsplash ? "" : "Add UNSPLASH_ACCESS_KEY to .env"}>
              {g.loading === "ph" ? spin("Searching Unsplash…") : pool.length ? "Find more photos" : "Find photos"}
            </button>
            <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={!!g.loading}>
              {g.loading === "own" ? spin("Adding photo…") : "Use my own photo"}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" hidden onChange={(e) => addOwn(e.target.files?.[0])} />
          </div>

          <label className="f" htmlFor="fWhen">
            Post on <span className="meta">({tz})</span>
          </label>
          <input type="datetime-local" id="fWhen" value={whenVal} onChange={(e) => up({ when: e.target.value })} />
          <div className="acts">
            <button className="btn red" onClick={() => finish("schedule")} disabled={!!g.loading || !s.config.typefully}>
              {g.loading === "send" ? spin(g.photoPick ? "Attaching photo…" : "Sending…") : "Schedule in Typefully"}
            </button>
            <button className="btn" onClick={bank} disabled={!!g.loading}>
              Bank in Drafts
            </button>
            <button className="btn ghost" onClick={() => finish("draft")} disabled={!!g.loading || !s.config.typefully}>
              Save as Typefully draft
            </button>
            <button className="btn ghost" onClick={() => finish("cal")} disabled={!!g.loading}>
              Calendar only
            </button>
            <button className="btn ghost" onClick={() => copyText(bold(g.final || ""), toast)}>
              Copy text
            </button>
          </div>
          <p className="meta">
            Typefully free plan: 10 posts a month. Bold lead-ins are converted to bold letters LinkedIn can show.
            {!s.config.typefully && " Add TYPEFULLY_API_KEY to .env to schedule from here."}
          </p>
        </div>
      )}
    </>
  );
}

export function LintList({ issues }: { issues: { rule: string; message: string }[] }) {
  if (!issues.length)
    return (
      <ul className="warn okk">
        <li>Passes the post checks.</li>
      </ul>
    );
  return (
    <ul className="warn" aria-label="Post checks">
      {issues.map((i) => (
        <li key={i.rule}>{i.message}</li>
      ))}
    </ul>
  );
}

export type { Article };
