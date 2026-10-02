import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "app-skeleton",
  standalone: true,
  templateUrl: "./skeleton.component.html",
  styleUrl: "./skeleton.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "aria-hidden": "true" },
})
export class SkeletonComponent {
  readonly width = input("100%");
  readonly height = input("1rem");
  readonly radius = input("var(--radius-sm)");
}
