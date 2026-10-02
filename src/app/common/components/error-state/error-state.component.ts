import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { CustomButtonComponent } from "../custom-button/custom-button.component";

@Component({
  selector: "app-error-state",
  standalone: true,
  imports: [CustomButtonComponent],
  templateUrl: "./error-state.component.html",
  styleUrl: "./error-state.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorStateComponent {
  readonly title = input("Something went wrong");
  readonly message = input.required<string>();
  readonly compact = input(false);
  readonly retry = output<void>();
}
