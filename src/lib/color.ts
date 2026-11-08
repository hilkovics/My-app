/** Text colour for a label placed inside a coloured fill: near-black on light fills, white otherwise. */
export function onColor(hex: string): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return '#fff';
  const [r, g, b] = m.slice(1, 4).map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Pick whichever gives the higher contrast ratio.
  return (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05) ? '#111214' : '#ffffff';
}
