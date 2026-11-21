// LinkedIn and Typefully don't render markdown. Turn **text** into Unicode
// Mathematical Sans-Serif Bold, exactly like the original artifact's bold().
export function bold(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, (_m, t: string) =>
    [...t]
      .map((c) => {
        const o = c.codePointAt(0)!;
        if (o >= 65 && o <= 90) return String.fromCodePoint(0x1d5d4 + o - 65);
        if (o >= 97 && o <= 122) return String.fromCodePoint(0x1d5ee + o - 97);
        if (o >= 48 && o <= 57) return String.fromCodePoint(0x1d7ec + o - 48);
        return c;
      })
      .join(""),
  );
}

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** HTML preview with <b> for **bold** lead-ins. */
export function mdPreview(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}
