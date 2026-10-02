import { DecimalPipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { of, switchMap } from "rxjs";
import { AvatarComponent } from "../../../common/components/avatar/avatar.component";
import { EmptyStateComponent } from "../../../common/components/empty-state/empty-state.component";
import { ErrorStateComponent } from "../../../common/components/error-state/error-state.component";
import { SkeletonComponent } from "../../../common/components/skeleton/skeleton.component";
import { TypeBadgeComponent } from "../../../common/components/type-badge/type-badge.component";
import { DexNumberPipe } from "../../../common/pipes/dex-number.pipe";
import { PokemonNamePipe } from "../../../common/pipes/pokemon-name.pipe";
import { readCssVariable } from "../../../common/utils/css-var.util";
import {
  MAX_BASE_STAT,
  STAT_KEYS,
  STAT_LABELS,
} from "../../constants/pokemon.constants";
import { Pokemon } from "../../models/pokemon.model";
import { PokemonSelectors } from "../../state/pokemon.selectors";
import { IDLE_DETAILS_ENTRY, PokemonStore } from "../../state/pokemon.store";
import { StatRadarChartComponent } from "../stat-radar-chart/stat-radar-chart.component";

@Component({
  selector: "app-pokemon-detail-panel",
  standalone: true,
  imports: [
    AvatarComponent,
    DecimalPipe,
    DexNumberPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    PokemonNamePipe,
    SkeletonComponent,
    StatRadarChartComponent,
    TypeBadgeComponent,
  ],
  templateUrl: "./pokemon-detail-panel.component.html",
  styleUrl: "./pokemon-detail-panel.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:keydown.escape)": "onEscape()",
    "(document:focusin)": "onDocumentFocusIn($event)",
  },
})
export class PokemonDetailPanelComponent {
  readonly pokemonId = input<number | null>(null);
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly store = inject(PokemonStore);
  private readonly selectors = inject(PokemonSelectors);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly closeButton =
    viewChild<ElementRef<HTMLButtonElement>>("closeButton");

  readonly statKeys = STAT_KEYS;
  readonly statLabels = STAT_LABELS;
  readonly maxBaseStat = MAX_BASE_STAT;
  readonly titleId = "pokemon-detail-title";

  private readonly pokemonId$ = toObservable(this.pokemonId);
  private readonly cached = toSignal(
    this.pokemonId$.pipe(
      switchMap((id) =>
        id === null ? of(null) : this.selectors.pokemonById$(id),
      ),
    ),
    { initialValue: null },
  );
  readonly details = toSignal(
    this.pokemonId$.pipe(
      switchMap((id) =>
        id === null ? of(IDLE_DETAILS_ENTRY) : this.selectors.detailsById$(id),
      ),
    ),
    { initialValue: IDLE_DETAILS_ENTRY },
  );

  // The by-id details (stats + abilities) once fetched; the cached list entry
  // until then, so the panel has content the moment it opens.
  readonly pokemon = computed<Pokemon | null>(
    () => this.details().data ?? this.cached(),
  );
  readonly abilities = computed(() => this.details().data?.abilities ?? []);
  readonly isLoadingDetails = computed(() => {
    const status = this.details().status;
    return status === "idle" || status === "loading";
  });
  readonly chartColor = computed(() => {
    const type = this.pokemon()?.types[0];
    return (
      (type && readCssVariable(`--type-${type}`)) ||
      readCssVariable("--color-primary") ||
      "#007acc"
    );
  });

  // Opening the dialog makes the page inert, which drops focus from the row
  // that opened it, so the last element focused outside is tracked instead.
  private lastOutsideFocus: HTMLElement | null = null;
  private returnFocusTo: HTMLElement | null = null;

  constructor() {
    // Load details for whichever Pokémon is shown; the store caches them.
    effect(() => {
      const id = this.pokemonId();
      if (id !== null) this.store.loadDetails(id);
    });

    // Move focus into the dialog when it opens and back to the row on close
    // (after render, once the page is no longer inert).
    effect(() => {
      if (this.open()) {
        this.returnFocusTo = this.lastOutsideFocus;
        afterNextRender(() => this.closeButton()?.nativeElement.focus(), {
          injector: this.injector,
        });
      } else if (this.returnFocusTo) {
        const target = this.returnFocusTo;
        this.returnFocusTo = null;
        afterNextRender(() => target.focus(), { injector: this.injector });
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  onDocumentFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    if (!this.host.nativeElement.contains(target)) {
      this.lastOutsideFocus = target;
    }
  }

  onEscape(): void {
    if (this.open()) this.close();
  }

  retryDetails(): void {
    const id = this.pokemonId();
    if (id !== null) this.store.loadDetails(id);
  }
}
