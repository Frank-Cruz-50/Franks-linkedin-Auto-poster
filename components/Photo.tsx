"use client";
import { useState } from "react";
import type { Photo } from "@/lib/types";

const UTM = "utm_source=supply_chain_content_engine&utm_medium=referral";
const utm = (u?: string) => (u ? u + (u.includes("?") ? "&" : "?") + UTM : `https://unsplash.com/?${UTM}`);

/** An image, or the text fallback card when it can't load (e.g. old /_blob/ photos). */
export function Img({ p }: { p: Photo }) {
  const [broken, setBroken] = useState(false);
  const src = p.own ? p.url : p.thumb || p.regular;
  if (!src || broken)
    return (
      <span className="phx">
        <span>{p.alt || (p.own ? "Your photo" : "Photo")}</span>
        <small>{p.own ? "Image not on this computer" : p.author || "Unsplash"}</small>
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={p.alt || "Photo"} onError={() => setBroken(true)} />;
}

export function Credit({ p }: { p: Photo }) {
  if (p.own) return <>Your own photo</>;
  return (
    <>
      Photo by{" "}
      <a href={utm(p.authorUrl)} target="_blank" rel="noopener">
        {p.author || "Unsplash photographer"}
      </a>{" "}
      on{" "}
      <a href={utm("https://unsplash.com/")} target="_blank" rel="noopener">
        Unsplash
      </a>
    </>
  );
}

export function SeePhoto({ p }: { p: Photo }) {
  return p.pageUrl ? (
    <a href={utm(p.pageUrl)} target="_blank" rel="noopener">
      See photo ↗
    </a>
  ) : null;
}
