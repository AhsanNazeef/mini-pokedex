import { Injectable, signal } from "@angular/core";

export type ToastTone = "error" | "success";

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

export const TOAST_DISMISS_MS = 6000;

@Injectable({ providedIn: "root" })
export class ToastService {
  private readonly items = signal<readonly Toast[]>([]);
  private nextId = 0;

  /** Toasts currently on screen, oldest first. */
  readonly toasts = this.items.asReadonly();

  /**
   * Shows a failure message, e.g. after an optimistic update was rolled back.
   * @param message User-facing text; never raw server output.
   */
  error(message: string): void {
    this.show("error", message);
  }

  /**
   * Shows a confirmation message.
   * @param message User-facing text.
   */
  success(message: string): void {
    this.show("success", message);
  }

  /**
   * Removes a toast early, e.g. when the viewer dismisses it.
   * @param id Id of the toast to remove.
   */
  dismiss(id: number): void {
    this.items.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(tone: ToastTone, message: string): void {
    const id = ++this.nextId;
    this.items.update((toasts) => [...toasts, { id, tone, message }]);
    setTimeout(() => this.dismiss(id), TOAST_DISMISS_MS);
  }
}
