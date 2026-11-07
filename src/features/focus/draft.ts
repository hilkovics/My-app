// What the next focus session is about (chosen before pressing Start). In-memory only.
import { useSyncExternalStore } from 'react';

export interface FocusDraft {
  itemId: string | null;
  itemTitle: string | null;
  tag: string | null;
}

let draft: FocusDraft = { itemId: null, itemTitle: null, tag: null };
const listeners = new Set<() => void>();

export function setFocusDraft(patch: Partial<FocusDraft>): void {
  draft = { ...draft, ...patch };
  for (const l of listeners) l();
}

export function useFocusDraft(): FocusDraft {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => draft,
  );
}
