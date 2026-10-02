import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

@Component({
  selector: "app-nav",
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: "./app-nav.component.html",
  styleUrl: "./app-nav.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppNavComponent {}
