"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { track, VL } from "@/lib/track";
import { api, fmtReset, type GenState, type State } from "./client";
import Feed from "./Feed";
import Generate from "./Generate";
import Drafts from "./Drafts";
import Calendar from "./Calendar";
import Library from "./Library";
import Playbook from "./Playbook";

const TABS = [
  ["feed", "Research feed"],
  ["gen", "Generate"],
  ["drafts", "Drafts"],
  ["cal", "Calendar"],
  ["lib", "Library"],
  ["pb", "Playbook"],
] as const;
export type Tab = (typeof TABS)[number][0];

export interface Shared {
  s: State;
  reload: () => Promise<void>;
  toast: (m: string, ms?: number) => void;
  go: (t: Tab) => void;
  gen: GenState;
  setGen: (g: GenState | ((g: GenState) => GenState)) => void;
}

export default function App() {
  const [s, setS] = useState<State | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("feed");
  const [gen, setGen] = useState<GenState>({});
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string, ms = 3200) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), ms);
  }, []);

  const reload = useCallback(async () => {
    try {
      setS(await api<State>("/api/state"));
      setErr(null);
    } catch (e: any) {
      setErr(e.message || "Couldn't load your data.");
    }
  }, []);

  useEffect(() => {
    void reload();
    const fromHash = () => {
      const h = location.hash.slice(1);
      if (TABS.some(([k]) => k === h)) setTab(h as Tab);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [reload]);

  const go = useCallback((t: Tab) => {
    setTab(t);
    if (location.hash !== "#" + t) history.replaceState(null, "", "#" + t);
    window.scrollTo({ top: 0 });
  }, []);

  const t = useMemo(() => track(s?.posts || []), [s?.posts]);

  // Remember when 85% is first reached.
  useEffect(() => {
    if (s && t.ready && !s.settings.ready85)
      void api("/api/settings", { method: "PATCH", body: { ready85: true, ready85At: new Date().toISOString() } }).then(reload);
  }, [s, t.ready, reload]);

  const saveSettings = async (patch: Record<string, unknown>) => {
    try {
      await api("/api/settings", { method: "PATCH", body: patch });
      await reload();
    } catch (e: any) {
      toast("Couldn't save settings: " + e.message);
    }
  };

  const shared: Shared | null = s ? { s, reload, toast, go, gen, setGen } : null;
  const pct = Math.round(t.rate * 100);

  return (
    <>
      <header>
        <h1 className="wide">Supply chain content engine</h1>
        <p className="sub">Research → angles → 4 versions → bank or schedule. Every post stays off your job and on the data.</p>
        <div className="strip">
          <div className="cell">
            <div className="lbl">Suggested version</div>
            <div className="big wide">{t.sug ? VL(t.sug) : "—"}</div>
            <div className="lbl">{t.sug ? `Your most-picked in the last ${t.picks}` : `Builds after 3 picks (${t.picks} so far)`}</div>
          </div>
          <div className="cell">
            <div className="lbl">Suggested-pick rate, last 30</div>
            <div className="big wide">{pct}%</div>
            <div className="meter">
              <i style={{ width: pct + "%" }} />
              <b title="85% goal" />
            </div>
            <div className="lbl">
              {t.n} of 30 picks logged · goal 85%{t.ready ? " · reached" : ""}
            </div>
          </div>
        </div>
        <div className="togs">
          <div className="tog">
            <span>
              Auto-load 10 articles<span className="lbl">Mon · Wed · Fri, 5:47am · needs `npm run cron` running</span>
            </span>
            <input
              type="checkbox" className="sw" aria-label="Auto-load articles" checked={s ? s.settings.autoResearch !== false : true} disabled={!s}
              onChange={(e) => {
                void saveSettings({ autoResearch: e.target.checked });
                toast(e.target.checked ? "New articles will load Mon, Wed and Fri." : "Auto-load off. Tap Find new articles when you want a batch.");
              }}
            />
          </div>
          <div className="tog">
            <span>
              Autopilot posting
              <span className="lbl">
                {t.ready ? (s?.settings.autopilot ? "Live: writes + schedules M/W/F" : "Ready — 85% reached") : "Runs once 85% is hit"}
              </span>
            </span>
            <input
              type="checkbox" className="sw" aria-label="Autopilot posting" checked={!!s?.settings.autopilot} disabled={!s}
              onChange={(e) => {
                void saveSettings({ autopilot: e.target.checked });
                toast(
                  e.target.checked
                    ? t.ready ? "Autopilot on: suggested version gets written and scheduled M/W/F." : "Autopilot armed. It starts once your picks hit 85% over 30 posts."
                    : "Autopilot off. Nothing posts without you.",
                  4500,
                );
              }}
            />
          </div>
        </div>
      </header>
      <nav>
        {TABS.map(([k, l]) => (
          <button key={k} aria-current={tab === k} onClick={() => go(k)}>
            {l}
          </button>
        ))}
      </nav>
      <main>
        {err && <p className="note red">{err} Is `npm run dev` still running?</p>}
        {s?.apiKeyBlocked && (
          <p className="note red">
            <b>AI is off:</b> ANTHROPIC_API_KEY is set, so Claude Code would bill the paid API instead of your Pro plan. Remove it from .env and your shell, then restart the app.
          </p>
        )}
        {s && !s.voiceGuide && <p className="note red">FRANK_VOICE.md is missing from the app folder. Copy it in from the starter zip; writing needs it.</p>}
        {s?.claudeLimit && (
          <p className="note red">
            Claude limit reached, resets at {fmtReset(s.claudeLimit.resetsAt, s.config.tz)}. Switch the writer to Gemini on the Generate tab to keep going.
          </p>
        )}
        {!shared ? (
          !err && <p className="note">Loading your engine…</p>
        ) : tab === "feed" ? (
          <Feed {...shared} />
        ) : tab === "gen" ? (
          <Generate {...shared} />
        ) : tab === "drafts" ? (
          <Drafts {...shared} />
        ) : tab === "cal" ? (
          <Calendar {...shared} />
        ) : tab === "lib" ? (
          <Library {...shared} />
        ) : (
          <Playbook {...shared} />
        )}
      </main>
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </>
  );
}
