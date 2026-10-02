import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  Event as RouterEvent,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
  RouterOutlet,
} from "@angular/router";
import { filter, map } from "rxjs";
import { ErrorStateComponent } from "./common/components/error-state/error-state.component";
import { ICON_URLS } from "./common/constants/icon.constants";
import { ImagePreloadService } from "./common/services/image-preload.service";

type NavigationState =
  { status: "loading" | "idle" } | { status: "error"; url: string };

function toNavigationState(event: RouterEvent): NavigationState | null {
  if (event instanceof NavigationStart) return { status: "loading" };
  if (event instanceof NavigationError) {
    return { status: "error", url: event.url };
  }
  if (
    event instanceof NavigationEnd ||
    event instanceof NavigationCancel ||
    event instanceof NavigationSkipped
  ) {
    return { status: "idle" };
  }
  return null;
}

@Component({
  selector: "app-root",
  standalone: true,
  imports: [ErrorStateComponent, RouterOutlet],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly router = inject(Router);

  // Lazy routes download their code on navigation. Tracking it means a slow
  // or failed download shows a loader or a Retry instead of a blank screen.
  readonly navigation = toSignal(
    this.router.events.pipe(
      map(toNavigationState),
      filter((state): state is NavigationState => state !== null),
    ),
    { initialValue: { status: "loading" } as NavigationState },
  );
  readonly hasPage = signal(false);

  readonly isNavigating = computed(
    () => this.navigation().status === "loading",
  );
  readonly failedUrl = computed(() => {
    const navigation = this.navigation();
    return navigation.status === "error" ? navigation.url : null;
  });

  constructor() {
    inject(ImagePreloadService).preload(ICON_URLS);
  }

  retryNavigation(url: string): void {
    void this.router.navigateByUrl(url);
  }
}
