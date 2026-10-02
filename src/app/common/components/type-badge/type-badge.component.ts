import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

// Darker type colours that need white text to stay readable (WCAG AA).
const LIGHT_TEXT_TYPES: ReadonlySet<string> = new Set([
  "fighting",
  "poison",
  "ghost",
  "dragon",
  "dark",
]);

@Component({
  selector: "app-type-badge",
  standalone: true,
  templateUrl: "./type-badge.component.html",
  styleUrl: "./type-badge.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypeBadgeComponent {
  readonly type = input.required<string>();

  readonly color = computed(
    () => `var(--type-${this.type()}, var(--color-secondary))`,
  );
  readonly hasLightText = computed(() => LIGHT_TEXT_TYPES.has(this.type()));
}
