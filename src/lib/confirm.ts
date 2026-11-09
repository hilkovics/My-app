import { toast } from './toast-store';

/** A pending confirmation, rendered by `ConfirmDialogHost`. */
export type ConfirmRequest = {
  title: string;
  message?: string;
  okLabel: string;
  destructive: boolean;
  resolve: (ok: boolean) => void;
};

let pending: ConfirmRequest | null = null;
const listeners = new Set<() => void>();

function set(next: ConfirmRequest | null) {
  pending = next;
  listeners.forEach((l) => l());
}

export function subscribeConfirm(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getConfirm(): ConfirmRequest | null {
  return pending;
}

/** Closes the visible dialog with the given answer. */
export function answerConfirm(ok: boolean): void {
  const req = pending;
  set(null);
  req?.resolve(ok);
}

/** In-app confirm dialog (Zrušiť / `okLabel`). Same signature as the former native Alert wrapper. */
export function confirm(title: string, message: string | undefined, okLabel: string, destructive = true): Promise<boolean> {
  if (pending) answerConfirm(false);
  return new Promise((resolve) => set({ title, message, okLabel, destructive, resolve }));
}

/** Short informational message; shown as a toast instead of a native alert. */
export function notify(title: string, message?: string): void {
  toast(message ? `${title} · ${message}` : title, { durationMs: 5000 });
}
