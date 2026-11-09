// Text bits of a note card: the preview of the body and the meta line.
const PREVIEW_CHARS = 90;

/** First ~90 characters of the body on one line, "…" when cut. */
export function notePreview(body: string, max = PREVIEW_CHARS): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).trimEnd()}…`;
}

/** "#osobné · 📅 po 9. 11. 10:00 · 📁 Koncert · ☑ 2/6" — parts that don't exist are left out. */
export function noteMeta(parts: { tags: string[]; event?: string | null; project?: string | null; checklist?: { done: number; total: number } | null }): string {
  const out: string[] = [];
  if (parts.tags.length) out.push(parts.tags.map((x) => `#${x}`).join(' '));
  if (parts.event) out.push(`📅 ${parts.event}`);
  if (parts.project) out.push(parts.project.startsWith('📁') ? parts.project : `📁 ${parts.project}`);
  if (parts.checklist?.total) out.push(`☑ ${parts.checklist.done}/${parts.checklist.total}`);
  return out.join(' · ');
}
