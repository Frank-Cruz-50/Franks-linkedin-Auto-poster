"use client";
import { useState } from "react";
import { bold, mdPreview } from "@/lib/bold";
import { lintPost } from "@/lib/lint";
import { fromLocalInput, localInput, nextSlot } from "@/lib/time";
import { VL } from "@/lib/track";
import type { Draft } from "@/lib/types";
import type { Shared } from "./App";
import { api, badLen, charCount, copyText } from "./client";
import { LintList } from "./Generate";
import { Credit, Img } from "./Photo";

export default function Drafts({ s, reload, toast, go }: Shared) {
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [newText, setNewText] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tz = s.config.tz;

  const ds = [...s.drafts].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  const learnN = ds.filter((d) => d.learn !== false && d.text).length;
  const patch = async (id: string, body: Partial<Draft>, msg?: string) => {
    try {
      await api(`/api/drafts/${id}`, { method: "PATCH", body });
      if (msg) toast(msg);
      await reload();
    } catch (e: any) {
      toast("Couldn't save: " + e.message);
    }
  };
  const openDraft = (d: Draft) => {
    setOpen(d.id);
    setText(d.text);
    setWhen(localInput(nextSlot(s.posts.map((p) => p.scheduledFor), new Date(), tz), tz));
    setConfirmDel(null);
  };
  const schedule = async (d: Draft) => {
    if (!text.trim()) return toast("The post is empty.");
    const iso = fromLocalInput(when, tz)?.toISOString();
    if (!iso) return toast("Pick a date and time.");
    setBusy(true);
    try {
      const r = await api(`/api/drafts/${d.id}/schedule`, { body: { text, when: iso } });
      toast("Scheduled in Typefully." + (d.photo ? (r.photoAttached ? " Photo attached." : " Photo didn't attach; add it in Typefully.") : "") + " The draft stays banked for learning.", 5000);
      setOpen(null);
      await reload();
      go("cal");
    } catch (e: any) {
      toast(e.message, e?.data?.unclear ? 9000 : 6000);
    }
    setBusy(false);
  };

  const row = (d: Draft) => {
    const dt = new Date(d.updatedAt || d.createdAt || Date.now());
    const ed = open === d.id;
    const sch = d.status === "scheduled";
    const n = text.length;
    return (
      <div className="row" key={d.id}>
        <div className="num wide">
          {dt.toLocaleDateString("en-US", { day: "numeric", timeZone: tz })}
          <small>{dt.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: tz })}</small>
        </div>
        <div>
          <div className="top">
            <span className={"pill " + (sch ? "red" : "")}>{sch ? "Scheduled" : "Banked"}</span>
            {d.version && <span className="meta">{VL(d.version)}</span>}
            <span className="meta">{d.learn !== false ? "· learning from this" : "· not used for learning"}</span>
          </div>
          <h3>{(d.text || "").split("\n")[0] || "Untitled draft"}</h3>
          {d.photo && (
            <>
              <div className="thumb sm">
                <Img p={d.photo} />
              </div>
              <div className="meta">
                <Credit p={d.photo} />
                {ed && (
                  <>
                    {" "}·{" "}
                    <button className="lnk" onClick={() => patch(d.id, { photo: null }, "Photo removed.")}>
                      Remove photo
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          {d.articleTitle && (
            <p className="meta">
              {d.articleUrl ? (
                <a href={d.articleUrl} target="_blank" rel="noopener">
                  {d.articleTitle} ↗
                </a>
              ) : (
                d.articleTitle
              )}
            </p>
          )}
          {ed ? (
            <>
              <textarea style={{ minHeight: 300 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Draft text" />
              <div className={"count " + (badLen(n) ? "bad" : "")}>{charCount(n)}</div>
              <LintList issues={lintPost(text, { playbookBanned: s.playbook.banned, voiceGuide: s.voiceGuide || "", article: s.articles.find((a) => a.id === d.articleId) })} />
              <details>
                <summary>Preview with bold lead-ins</summary>
                <div className="prev" dangerouslySetInnerHTML={{ __html: mdPreview(text) }} />
              </details>
              <div className="tog">
                <span>
                  Learn from this draft<span className="lbl">Writing studies your newest 5 for voice</span>
                </span>
                <input
                  type="checkbox" className="sw" aria-label="Learn from this draft" checked={d.learn !== false}
                  onChange={(e) => patch(d.id, { learn: e.target.checked }, e.target.checked ? "Writing will learn from this draft." : "This draft won't be used for learning.")}
                />
              </div>
              {!sch && (
                <>
                  <label className="f" htmlFor="dWhen">
                    Post on <span className="meta">({tz})</span>
                  </label>
                  <input type="datetime-local" id="dWhen" value={when} onChange={(e) => setWhen(e.target.value)} />
                </>
              )}
              <div className="acts">
                <button className="btn" onClick={() => patch(d.id, { text }, "Draft saved.")}>
                  Save
                </button>
                {!sch && (
                  <button className="btn red" onClick={() => schedule(d)} disabled={busy || !s.config.typefully}>
                    {busy ? (
                      <>
                        <span className="spin" />
                        Sending…
                      </>
                    ) : (
                      "Schedule in Typefully"
                    )}
                  </button>
                )}
                <button className="btn ghost" onClick={() => copyText(bold(text), toast)}>
                  Copy text
                </button>
                <button className="btn ghost" onClick={() => setOpen(null)}>
                  Close
                </button>
                <button
                  className={"btn " + (confirmDel === d.id ? "red" : "ghost")}
                  onClick={async () => {
                    if (confirmDel !== d.id) return setConfirmDel(d.id);
                    try {
                      await api(`/api/drafts/${d.id}`, { method: "DELETE" });
                      setOpen(null);
                      toast("Draft deleted.");
                      await reload();
                    } catch (e: any) {
                      toast("Couldn't delete: " + e.message);
                    }
                  }}
                >
                  {confirmDel === d.id ? "Tap again to delete" : "Delete"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="prev" style={{ maxHeight: "9.6em", overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: mdPreview(d.text) }} />
              <div className="acts">
                <button className="btn ghost" onClick={() => openDraft(d)}>
                  Open
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <h2 className="wide">Drafts</h2>
      <p className="meta">
        Your bank of finished posts. Every angle, version and article the engine writes studies the newest 5 marked “learn from this” to match your voice
        {learnN ? ` (${Math.min(5, learnN)} in use now)` : ""}. It never reuses their facts.
      </p>
      <details open={!ds.length}>
        <summary>Add a draft by hand</summary>
        <label className="f" htmlFor="dNew" style={{ marginTop: 0 }}>
          Paste a finished post
        </label>
        <textarea id="dNew" placeholder="Hook line, then the body…" value={newText} onChange={(e) => setNewText(e.target.value)} />
        <div className="acts">
          <button
            className="btn"
            onClick={async () => {
              if (!newText.trim()) return toast("Paste a post first.");
              try {
                await api("/api/drafts", { body: { text: newText } });
                setNewText("");
                toast("Banked in Drafts. Writing now learns from it.");
                await reload();
              } catch (e: any) {
                toast("Couldn't bank: " + e.message, 5000);
              }
            }}
          >
            Bank it
          </button>
        </div>
      </details>
      {ds.length ? ds.map(row) : <p className="note">Nothing banked yet. Finish a post in Generate and tap “Bank in Drafts”.</p>}
    </>
  );
}
