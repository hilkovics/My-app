// Colour helpers. The only place where alpha mixes and text-on-colour are computed.

function parse(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

/** "#rrggbb" + opacity 0–1 → "rgba(r,g,b,a)". Colours that already are rgba()/named pass through unchanged. */
export function hexA(color: string, alpha: number): string {
  const rgb = parse(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, alpha))})`;
}

/** Relative luminance (WCAG) of a "#rrggbb" colour. */
export function luminance(hex: string): number {
  const rgb = parse(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const DARK_ON_COLOR = '#15142B';

/** Text colour for a label on a user or categorical colour: luminance above 0.18 → dark ink, otherwise white. */
export function onColor(hex: string): string {
  return luminance(hex) > 0.18 ? DARK_ON_COLOR : '#ffffff';
}

/** Darkens (amount < 0) or lightens (amount > 0) a "#rrggbb" colour by mixing with black or white. */
export function shade(hex: string, amount: number): string {
  const rgb = parse(hex);
  if (!rgb) return hex;
  const target = amount < 0 ? 0 : 255;
  const k = Math.min(1, Math.abs(amount));
  const part = (v: number) => Math.round(v * (1 - k) + target * k).toString(16).padStart(2, '0');
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`;
}

/** Stable small hash of a string (for picking a categorical colour per entity). */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
