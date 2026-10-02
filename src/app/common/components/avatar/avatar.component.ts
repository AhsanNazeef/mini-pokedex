import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from "@angular/core";

@Component({
  selector: "app-avatar",
  standalone: true,
  templateUrl: "./avatar.component.html",
  styleUrl: "./avatar.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  // Signal-based component API (inputs)
  readonly imageUrl = input<string | null>(null);
  readonly size = input<number>(40);
  readonly fallbackInitials = input<string>("??");
  readonly variant = input<"circle" | "sprite">("circle");
  readonly loading = input<"lazy" | "eager">("lazy");

  // Local state
  readonly hasLoadError = signal(false);
  readonly isLoaded = signal(false);

  readonly isLoading = computed(
    () => !!this.imageUrl() && !this.isLoaded() && !this.hasLoadError(),
  );

  constructor() {
    // Reset error and loaded state when imageUrl input changes
    effect(() => {
      this.imageUrl();
      this.hasLoadError.set(false);
      this.isLoaded.set(false);
    });
  }

  onImageLoad(): void {
    this.isLoaded.set(true);
  }

  onImageError(): void {
    this.hasLoadError.set(true);
  }
}
