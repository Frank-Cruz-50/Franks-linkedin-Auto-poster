// The 10 research lanes from playbook.research, by their canonical names.
export const LANES = [
  "AI and automation in supply chain",
  "Tariffs and trade policy",
  "Freight markets",
  "Ports, rail and labor",
  "Parcel, last-mile and retail/e-commerce",
  "Manufacturing, sourcing and reshoring",
  "Tech outages and cyberattacks",
  "Energy, fuel and commodities",
  "Weather, disasters and geopolitics",
  "The week's biggest general news",
] as const;

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

/** Map a topic string to its canonical lane, or null if it isn't one of the 10. */
export function laneOf(topic: string): string | null {
  const t = norm(topic || "");
  for (const l of LANES) if (t === norm(l) || t.startsWith(norm(l))) return l;
  return null;
}
