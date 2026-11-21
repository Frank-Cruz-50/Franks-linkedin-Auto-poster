"use client";
import { VL } from "@/lib/track";
import type { Post } from "@/lib/types";
import type { Shared } from "./App";
import { api, fmtD } from "./client";

const STATUS: Record<string, string> = { idea: "Idea", scheduled: "Scheduled", draft: "Typefully draft", planned: "Planned", posted: "Posted" };

export default function Library({ s, reload, toast, go, setGen }: Shared) {
  const tz = s.config.tz;
  const posts = [...s.posts].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const fol = +(s.settings.followers || 0);
  const now = Date.now();
  const imp = posts.reduce((x, p) => x + (+(p.impressions || 0)), 0);
  const gained = posts.reduce((x, p) => x + (+(p.followersGained || 0)), 0);

  const goal = (n: number, date: string, label: string) => {
    const wk = Math.max(1, (new Date(date + "T23:59:59").getTime() - now) / 6048e5);
    const need = Math.max(0, n - fol);
    const pc = Math.min(100, (fol / n) * 100);
    return (
      <div>
        <div className="lbl">{label}</div>
        <div className="big wide">{Math.round(pc)}%</div>
        <div className="meter">
          <i style={{ width: pc + "%" }} />
        </div>
        <div className="lbl">
          {need.toLocaleString("en-US")} to go · about {Math.ceil(need / wk).toLocaleString("en-US")} a week
        </div>
      </div>
    );
  };

  const setMetric = async (p: Post, k: "impressions" | "followersGained", v: string) => {
    try {
      await api(`/api/posts/${p.id}`, { method: "PATCH", body: { [k]: v === "" ? null : +v } });
      await reload();
    } catch (e: any) {
      toast("Couldn't save: " + e.message);
    }
  };
  const openPost = (p: Post) => {
    const a = s.articles.find((x) => x.id === p.articleId) || {
      id: p.articleId || "", batchId: "", createdAt: "", title: p.articleTitle, url: p.articleUrl, source: p.source, tag: (p.tag as any) || "headline",
      topic: p.topic, date: "", summary: "", stats: [], why: "",
    };
    setGen({
      article: a, postId: p.id, angles: p.angle ? [p.angle] : null, angle: 0, versions: p.versions || null, photo: p.photo, carousel: p.carousel,
      long: p.long, v: p.chosenVersion, hk: p.chosenHook || 0, final: p.finalText && p.status === "idea" ? p.finalText : null, chosen: p.chosenVersion,
      photoPick: p.photoPick || null,
    });
    go("gen");
  };

  return (
    <>
      <h2 className="wide">Library</h2>
      <div className="goal">
        <div>
          <label className="f" htmlFor="folN" style={{ marginTop: 0 }}>
            Followers today
          </label>
          <input
            type="number" id="folN" inputMode="numeric" defaultValue={fol || ""} placeholder="e.g. 480"
            onBlur={async (e) => {
              const v = +e.target.value || 0;
              if (v === fol) return;
              await api("/api/settings", { method: "PATCH", body: { followers: v, followersAt: new Date().toISOString() } }).catch((er) => toast(er.message));
              await reload();
            }}
          />
          <div className="lbl" style={{ marginTop: 6 }}>
            {imp.toLocaleString("en-US")} impressions and {gained.toLocaleString("en-US")} followers logged across {posts.filter((p) => p.status === "posted").length} posted
          </div>
        </div>
        {goal(30000, "2028-06-30", "30K by 2028-06-30")}
        {goal(100000, "2030-12-31", "100K by 2030-12-31")}
      </div>
      {posts.length ? (
        <table className="stack">
          <thead>
            <tr>
              <th>Date</th>
              <th>Post</th>
              <th>Version</th>
              <th>Suggested hit</th>
              <th>Status</th>
              <th className="n">Impressions</th>
              <th className="n">New followers</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td data-l="Date">{fmtD(p.scheduledFor || p.createdAt, tz)}</td>
                <td data-l="Post">{(p.finalText || "").split("\n")[0] || p.articleTitle}</td>
                <td data-l="Version">{p.chosenVersion ? VL(p.chosenVersion) : "Not picked"}</td>
                <td data-l="Suggested hit">{p.suggestedAtPick ? (p.suggestedAtPick === p.chosenVersion ? "Yes" : "No · was " + VL(p.suggestedAtPick)) : "—"}</td>
                <td data-l="Status">{STATUS[p.status] || p.status}{p.autopilot ? " · autopilot" : ""}</td>
                <td className="n" data-l="Impressions">
                  <input type="number" inputMode="numeric" aria-label="Impressions" defaultValue={p.impressions ?? ""} onBlur={(e) => e.target.value !== String(p.impressions ?? "") && setMetric(p, "impressions", e.target.value)} />
                </td>
                <td className="n" data-l="New followers">
                  <input type="number" inputMode="numeric" aria-label="New followers" defaultValue={p.followersGained ?? ""} onBlur={(e) => e.target.value !== String(p.followersGained ?? "") && setMetric(p, "followersGained", e.target.value)} />
                </td>
                <td data-l="">
                  {p.versions && (
                    <button className="btn ghost" onClick={() => openPost(p)}>
                      Open
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="note">Every post you write lands here with its version, hook and results.</p>
      )}
    </>
  );
}
