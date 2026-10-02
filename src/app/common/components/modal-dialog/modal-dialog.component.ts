import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from "@angular/core";

/**
 * Centred modal built on the native `<dialog>`, which brings focus trapping,
 * Escape-to-close, an inert background and top-layer stacking for free.
 * Opening it never moves the page behind it.
 */
@Component({
  selector: "app-modal-dialog",
  standalone: true,
  templateUrl: "./modal-dialog.component.html",
  styleUrl: "./modal-dialog.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Clicks bubble from the native dialog to the host; a click whose target is
  // the dialog itself landed on the backdrop.
  host: { "(click)": "onBackdropClick($event)" },
})
export class ModalDialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly closed = output<void>();

  private readonly dialog =
    viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open()) {
        if (!dialog.open) dialog.showModal();
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  /** Fires for Escape and for `close()`, so state stays in step either way. */
  onClose(): void {
    if (this.open()) this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.closed.emit();
  }
}
