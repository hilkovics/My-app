/** How long a toast stays (3.8 s, design token `motion.toastDurationMs`). */
export const TOAST_DURATION_MS = 3800;

/** One visible toast. `undo` restores the state before the action it announces. */
export type ToastState = {
  id: number;
  message: string;
  undo: (() => void | Promise<void>) | null;
  /** Warning toasts use the same chrome; the message itself starts with "⚠ ". */
  durationMs: number;
};

export type ToastAction = { type: 'show'; toast: Omit<ToastState, 'id'> } | { type: 'dismiss'; id?: number };

/** Pure reducer: a new toast replaces the current one; dismiss only affects the toast with that id. */
export function toastReducer(state: ToastState | null, action: ToastAction): ToastState | null {
  if (action.type === 'show') return { ...action.toast, id: (state?.id ?? 0) + 1 };
  if (action.id != null && state?.id !== action.id) return state;
  return null;
}

let current: ToastState | null = null;
let counter = 0;
const listeners = new Set<() => void>();

function emit(next: ToastState | null) {
  current = next;
  listeners.forEach((l) => l());
}

export function subscribeToast(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getToast(): ToastState | null {
  return current;
}

/** Shows a toast (replacing any visible one). Safe to call from anywhere, also outside React. */
export function toast(message: string, opts: { undo?: () => void | Promise<void>; durationMs?: number } = {}): void {
  counter += 1;
  emit({ id: counter, message, undo: opts.undo ?? null, durationMs: opts.durationMs ?? TOAST_DURATION_MS });
}

export function dismissToast(id?: number): void {
  if (id != null && current?.id !== id) return;
  emit(null);
}
