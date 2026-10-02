import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ToastService } from "../../services/toast.service";

@Component({
  selector: "app-toast-host",
  standalone: true,
  templateUrl: "./toast-host.component.html",
  styleUrl: "./toast-host.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastHostComponent {
  private readonly toastService = inject(ToastService);

  readonly toasts = this.toastService.toasts;

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
