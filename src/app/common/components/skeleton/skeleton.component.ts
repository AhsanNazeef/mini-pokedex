import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "app-skeleton",
  standalone: true,
  templateUrl: "./skeleton.component.html",
  styleUrl: "./skeleton.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Width lives on the host so parents can align it (e.g. margin-left: auto).
  host: { "aria-hidden": "true", "[style.width]": "width()" },
})
export class SkeletonComponent {
  readonly width = input("100%");
  readonly height = input("1rem");
  readonly radius = input("var(--radius-sm)");
}
