/** Text colour for a label placed inside a coloured fill: near-black on light fills, white otherwise. */
export function onColor(hex: string): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return '#fff';
  const [r, g, b] = m.slice(1, 4).map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // White whenever it reads well (WCAG AA, 4.5:1); otherwise whichever of white / near-black contrasts more.
  const white = 1.05 / (lum + 0.05);
  if (white >= 4.5) return '#ffffff';
  return (lum + 0.05) / 0.05 > white ? '#111214' : '#ffffff';
}

/** "#rrggbb" + opacity 0–1 → "#rrggbbaa". */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  return `${hex.slice(0, 7)}${a.toString(16).padStart(2, '0')}`;
}

/** Darkens (amount < 0) or lightens (amount > 0) a "#rrggbb" colour by mixing with black or white. */
export function shade(hex: string, amount: number): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return hex;
  const target = amount < 0 ? 0 : 255;
  const k = Math.min(1, Math.abs(amount));
  const part = (x: string) => Math.round(parseInt(x, 16) * (1 - k) + target * k).toString(16).padStart(2, '0');
  return `#${part(m[1])}${part(m[2])}${part(m[3])}`;
}
