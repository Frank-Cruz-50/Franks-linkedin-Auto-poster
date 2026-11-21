"use client";
import { useState } from "react";
import { fromLocalInput, localInput } from "@/lib/time";
import { VL } from "@/lib/track";
import type { Post } from "@/lib/types";
import type { Shared } from "./App";
import { api } from "./client";
import { Img } from "./Photo";

const STATUS: Record<string, string> = { scheduled: "Scheduled", draft: "Typefully draft", planned: "Planned", posted: "Posted", idea: "Idea" };

export default function Calendar({ s, reload, toast, go }: Shared) {
  const [edit, setEdit] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const tz = s.config.tz;

  const items = s.posts.filter((p) => p.finalText).sort((a, b) => String(a.scheduledFor || "9").localeCompare(String(b.scheduledFor || "9")));
  const now = new Date().toISOString();
  const up = items.filter((p) => !p.scheduledFor || p.scheduledFor >= now || p.status !== "posted");
  const past = items.filter((p) => !up.includes(p)).reverse();

  const start = (p: Post) => {
    setEdit(p.id);
    setText(p.finalText || "");
    setWhen(p.scheduledFor ? localInput(new Date(p.scheduledFor), tz) : "");
    setConfirmDel(null);
  };
  const save = async (p: Post) => {
    setBusy(true);
    try {
      const iso = when ? fromLocalInput(when, tz)?.toISOString() : null;
      const r = await api(`/api/posts/${p.id}/sync`, { body: { text, when: iso } });
      setEdit(null);
      toast(r.synced ? "Updated here and in Typefully." : "Updated.");
      await reload();
    } catch (e: any) {
      toast(e.message, 6000);
    }
    setBusy(false);
  };
  const del = async (p: Post) => {
    if (confirmDel !== p.id) return setConfirmDel(p.id);
    try {
      await api(`/api/posts/${p.id}`, { method: "DELETE" });
      setEdit(null);
      toast(p.typefullyId && p.status !== "posted" ? "Deleted here and in Typefully." : "Deleted.");
      await reload();
    } catch (e: any) {
      toast(e.message, 6000);
    }
  };
  const bankIt = async (p: Post) => {
    setBusy(true);
    try {
      await api("/api/drafts", {
        body: {
          text: text.trim() || p.finalText, articleId: p.articleId || null, articleTitle: p.articleTitle || "", articleUrl: p.articleUrl || "", source: p.source || "",
          topic: p.topic || "", tag: p.tag || "", version: p.chosenVersion || null, hook: p.chosenHook ?? 0, suggestedAtPick: p.suggestedAtPick || null,
          postId: p.id, status: p.typefullyId || p.status === "posted" ? "scheduled" : "banked",
        },
      });
      toast("Banked in Drafts. Writing now learns from it.");
      setEdit(null);
      await reload();
      go("drafts");
    } catch (e: any) {
      toast("Couldn't bank: " + e.message, 5000);
    }
    setBusy(false);
  };

  const row = (p: Post) => {
    const d = p.scheduledFor ? new Date(p.scheduledFor) : null;
    const ed = edit === p.id;
    return (
      <div className="row" key={p.id}>
        <div className="num wide">
          {d ? d.toLocaleDateString("en-US", { day: "numeric", timeZone: tz }) : "—"}
          <small>
            {d
              ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", timeZone: tz }) + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })
              : "No date"}
          </small>
        </div>
        <div>
          <div>
            <span className={"pill " + (p.status === "scheduled" ? "red" : "")}>{STATUS[p.status] || p.status}</span> <span className="meta">{VL(p.chosenVersion)}</span>
            {p.autopilot && <span className="meta"> · autopilot</span>}
          </div>
          <h3 style={{ marginTop: 8 }}>{(p.finalText || "").split("\n")[0]}</h3>
          <p className="meta">{p.articleTitle || ""}</p>
          {p.photoPick && (
            <>
              <div className="thumb sm">
                <Img p={p.photoPick} />
              </div>
              <div className="meta">{p.photoAttached ? "Photo attached in Typefully" : "Photo not attached yet · details are in the Typefully post's notes"}</div>
            </>
          )}
          {ed ? (
            <>
              <textarea style={{ minHeight: 300 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Post text" />
              <label className="f" htmlFor="eWhen">
                Post on <span className="meta">({tz})</span>
              </label>
              <input type="datetime-local" id="eWhen" value={when} onChange={(e) => setWhen(e.target.value)} />
              <div className="acts">
                <button className="btn red" onClick={() => save(p)} disabled={busy}>
                  Save changes
                </button>
                <button className="btn ghost" onClick={() => bankIt(p)} disabled={busy}>
                  Bank in Drafts
                </button>
                <button className="btn ghost" onClick={() => setEdit(null)}>
                  Cancel
                </button>
                {p.status !== "posted" && (
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      await api(`/api/posts/${p.id}`, { method: "PATCH", body: { status: "posted" } }).catch((e) => toast(e.message));
                      setEdit(null);
                      toast("Marked posted. Add impressions in the Library.");
                      await reload();
                    }}
                  >
                    Mark posted
                  </button>
                )}
                <button className={"btn " + (confirmDel === p.id ? "red" : "ghost")} onClick={() => del(p)}>
                  {confirmDel === p.id ? "Tap again to delete" : "Delete"}
                </button>
              </div>
            </>
          ) : (
            <div className="acts">
              <button className="btn ghost" onClick={() => start(p)}>
                Edit
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <h2 className="wide">Upcoming</h2>
      {up.length ? up.map(row) : <p className="note">Nothing on the calendar yet. Write a post from the feed.</p>}
      {!!past.length && (
        <details>
          <summary>Posted ({past.length})</summary>
          {past.map(row)}
        </details>
      )}
    </>
  );
}
