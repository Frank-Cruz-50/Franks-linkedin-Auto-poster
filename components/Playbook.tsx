"use client";
import { useEffect, useState } from "react";
import { PB_FIELDS, type Playbook as PB } from "@/lib/types";
import type { Shared } from "./App";
import { api } from "./client";

export default function Playbook({ s, reload, toast }: Shared) {
  const [pb, setPb] = useState<PB>(s.playbook);
  const [voice, setVoice] = useState<{ html?: string; missing?: boolean } | null>(null);
  useEffect(() => {
    api("/api/voice").then(setVoice).catch(() => setVoice({ missing: true }));
  }, []);

  return (
    <>
      <h2 className="wide">Playbook</h2>
      <p className="meta">Every angle, version and article is written from these rules. The Mon/Wed/Fri research runs read them too.</p>
      {PB_FIELDS.map(([k, l]) => (
        <div key={k}>
          <label className="f" htmlFor={"pb_" + k}>
            {l}
          </label>
          <textarea id={"pb_" + k} style={{ minHeight: k === "loves" ? 70 : 110 }} value={pb[k] || ""} onChange={(e) => setPb({ ...pb, [k]: e.target.value })} />
        </div>
      ))}
      <div className="acts">
        <button
          className="btn red"
          onClick={async () => {
            try {
              await api("/api/playbook", { method: "PUT", body: pb });
              toast("Playbook saved.");
              await reload();
            } catch (e: any) {
              toast("Couldn't save: " + e.message);
            }
          }}
        >
          Save playbook
        </button>
        <button
          className="btn ghost"
          onClick={async () => {
            try {
              setPb(await api<PB>("/api/playbook/defaults"));
              toast("Defaults restored. Tap Save to keep them.");
            } catch (e: any) {
              toast(e.message);
            }
          }}
        >
          Restore defaults
        </button>
      </div>

      <div className="card pbfoot">
        <span className="step">Read-only</span>
        <h3>Voice guide</h3>
        <p className="note">
          This is <b>FRANK_VOICE.md</b>, sent in full with every writing prompt. Edit it in the file in the app folder, not here. Changes apply on the next write.
        </p>
        {voice?.missing ? (
          <p className="note red">FRANK_VOICE.md is missing from the app folder.</p>
        ) : voice?.html ? (
          <div className="voice" dangerouslySetInnerHTML={{ __html: voice.html }} />
        ) : (
          <p className="meta">Loading…</p>
        )}
      </div>
    </>
  );
}
