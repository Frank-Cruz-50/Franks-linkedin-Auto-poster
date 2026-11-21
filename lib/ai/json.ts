/** Pull the JSON object out of a model reply (handles ```json fences and chatter). */
export function extractJson(text: string): unknown {
  const s = String(text || "").trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  const tryParse = (x: string) => {
    try {
      return JSON.parse(x);
    } catch {
      return undefined;
    }
  };
  if (fence) {
    const v = tryParse(fence[1].trim());
    if (v !== undefined) return v;
  }
  const direct = tryParse(s);
  if (direct !== undefined) return direct;
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) {
    const v = tryParse(s.slice(a, b + 1));
    if (v !== undefined) return v;
  }
  throw new Error("The reply wasn't valid JSON.");
}
