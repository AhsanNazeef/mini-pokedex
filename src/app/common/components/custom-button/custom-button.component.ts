import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";

@Component({
  selector: "app-custom-button",
  standalone: true,
  templateUrl: "./custom-button.component.html",
  styleUrl: "./custom-button.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomButtonComponent {
  readonly variant = input<"primary" | "secondary">("primary");
  readonly type = input<"button" | "submit">("button");
  readonly disabled = input(false);
  readonly isLoading = input(false);
  readonly ariaLabel = input<string | null>(null);
  readonly clicked = output<void>();

  onClick(): void {
    if (this.disabled() || this.isLoading()) return;
    this.clicked.emit();
  }
}
