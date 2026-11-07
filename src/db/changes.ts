// Tiny change bus: repositories call notifyChange() after writes; live queries re-run and
// side-effect owners (e.g. notification scheduling) learn which items changed.

export interface ChangeEvent {
  /** Items whose data changed (created, updated or deleted). Empty = unspecified/bulk. */
  itemIds: string[];
}

type Listener = (e: ChangeEvent) => void;
const listeners = new Set<Listener>();
let version = 0;

export function notifyChange(itemIds: string[] = []): void {
  version++;
  const event = { itemIds };
  for (const l of listeners) l(event);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVersion(): number {
  return version;
}
