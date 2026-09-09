// Clipboard helper with fallback (works on http/mobile browsers too).
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// Remove [ACTION:...] control tags so copied text stays human-readable.
export function stripActionTags(text: string): string {
  return (text || "").replace(/\[ACTION:[^\]]+\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export interface CodeSegment {
  type: "text" | "code";
  lang: string;
  body: string;
}

// Split message into text/code segments on fenced ``` blocks.
export function splitCodeSegments(text: string): CodeSegment[] {
  const out: CodeSegment[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", lang: "", body: text.slice(last, m.index) });
    out.push({ type: "code", lang: m[1] || "code", body: m[2].replace(/\n$/, "") });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", lang: "", body: text.slice(last) });
  if (out.length === 0) out.push({ type: "text", lang: "", body: text });
  return out;
}

export function findUrls(text: string): string[] {
  const m = (text || "").match(/https?:\/\/[^\s)>\]`'"]+/g);
  return m ? [...new Set(m)] : [];
}
