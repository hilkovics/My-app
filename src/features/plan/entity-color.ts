import { hashString } from '@/lib/color';

/**
 * Colour of an event/entity: its own colour if it has one, otherwise a stable slot of the given
 * categorical palette chosen from its id (the same id always gets the same colour).
 */
export function entityColor(id: string, color: string | null | undefined, palette: readonly string[]): string {
  if (color) return color;
  return palette[hashString(id) % palette.length];
}
