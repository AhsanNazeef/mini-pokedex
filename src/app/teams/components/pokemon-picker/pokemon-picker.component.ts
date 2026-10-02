import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
} from "rxjs";
import { AvatarComponent } from "../../../common/components/avatar/avatar.component";
import { EmptyStateComponent } from "../../../common/components/empty-state/empty-state.component";
import { ErrorStateComponent } from "../../../common/components/error-state/error-state.component";
import { SkeletonComponent } from "../../../common/components/skeleton/skeleton.component";
import { toTitleCase } from "../../../common/utils/string.util";
import {
  POKEMON_SEARCH_DEBOUNCE_MS,
  POKEDEX_SIZE,
} from "../../../pokedex/constants/pokemon.constants";
import { Pokemon } from "../../../pokedex/models/pokemon.model";
import { PokemonSelectors } from "../../../pokedex/state/pokemon.selectors";
import { PokemonStore } from "../../../pokedex/state/pokemon.store";

/**
 * Rows rendered per batch. The whole Pokédex is already cached, so reaching
 * the end of the list just renders more of it — no further requests.
 */
export const PICKER_PAGE_SIZE = 20;

const DROPDOWN_MAX_HEIGHT_PX = 220;
const DROPDOWN_MIN_HEIGHT_PX = 120;
const DROPDOWN_GAP_PX = 4;
const VIEWPORT_MARGIN_PX = 8;

export interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

type DropdownState = "loading" | "error" | "empty" | "results";

@Component({
  selector: "app-pokemon-picker",
  standalone: true,
  imports: [
    AvatarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
  ],
  templateUrl: "./pokemon-picker.component.html",
  styleUrl: "./pokemon-picker.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:pointerdown)": "onDocumentPointerDown($event)",
    "(window:resize)": "repositionDropdown()",
  },
})
export class PokemonPickerComponent {
  readonly inputId = input.required<string>();
  readonly selectedIds = input.required<readonly number[]>();
  readonly maxSelection = input(6);
  readonly describedBy = input<string | null>(null);
  readonly invalid = input(false);

  readonly selectionChange = output<number[]>();
  readonly touched = output<void>();

  private readonly store = inject(PokemonStore);
  private readonly selectors = inject(PokemonSelectors);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly searchField =
    viewChild<ElementRef<HTMLInputElement>>("searchField");
  private readonly field = viewChild<ElementRef<HTMLElement>>("field");
  private readonly dropdown = viewChild<ElementRef<HTMLElement>>("dropdown");
  private readonly scrollAnchor =
    viewChild<ElementRef<HTMLElement>>("scrollAnchor");
  private scrollObserver?: IntersectionObserver;

  readonly rawQuery = signal("");

  private readonly queryInput$ = new Subject<string>();
  /** Typed text, settled: the task's debounced typeahead. */
  private readonly debouncedQuery = toSignal(
    this.queryInput$.pipe(
      debounceTime(POKEMON_SEARCH_DEBOUNCE_MS),
      map((value) => value.trim().toLowerCase()),
      distinctUntilChanged(),
      startWith(""),
    ),
    { initialValue: "" },
  );

  // An empty field needs no debounce: clearing it (or picking a Pokémon, which
  // clears it) shows the full list at once instead of the previous search's
  // stale, now-empty results.
  private readonly query = computed(() =>
    this.rawQuery().trim() === "" ? "" : this.debouncedQuery(),
  );

  private readonly allPokemon = toSignal(this.selectors.allPokemon$, {
    requireSync: true,
  });
  private readonly pokedexStatus = toSignal(this.selectors.status$, {
    requireSync: true,
  });
  private readonly pokedexError = toSignal(this.selectors.error$, {
    requireSync: true,
  });

  readonly isOpen = signal(false);
  readonly activeIndex = signal(0);
  readonly listboxId = computed(() => `${this.inputId()}-listbox`);
  readonly errorMessage = computed(() => this.pokedexError() ?? "");
  readonly skeletonRows = [1, 2, 3];
  readonly pokedexSize = POKEDEX_SIZE;

  // Fixed to the viewport, so the list overlays instead of resizing the
  // dialog, and no scrolling ancestor can clip it.
  readonly dropdownPosition = signal<DropdownPosition | null>(null);

  private readonly visibleCount = signal(PICKER_PAGE_SIZE);

  readonly selected = computed<Pokemon[]>(() => {
    const byId = new Map(this.allPokemon().map((p) => [p.id, p]));
    return this.selectedIds().map(
      (id) =>
        byId.get(id) ?? {
          id,
          name: `#${id}`,
          height: 0,
          weight: 0,
          types: [],
          stats: {
            hp: 0,
            attack: 0,
            defense: 0,
            specialAttack: 0,
            specialDefense: 0,
            speed: 0,
          },
          total: 0,
          spriteUrl: null,
        },
    );
  });

  readonly isFull = computed(
    () => this.selectedIds().length >= this.maxSelection(),
  );

  /** Every Pokémon matching the search that is not already on the team. */
  readonly matches = computed<Pokemon[]>(() => {
    const query = this.query();
    const chosen = new Set(this.selectedIds());
    return this.allPokemon().filter(
      (pokemon) =>
        !chosen.has(pokemon.id) &&
        (!query || pokemon.name.toLowerCase().includes(query)),
    );
  });

  /** The slice currently rendered; grows as the list is scrolled. */
  readonly results = computed<Pokemon[]>(() =>
    this.matches().slice(0, this.visibleCount()),
  );

  readonly hasMore = computed(
    () => this.matches().length > this.results().length,
  );

  readonly dropdownState = computed<DropdownState>(() => {
    const status = this.pokedexStatus();
    if (status === "idle" || status === "loading") return "loading";
    if (status === "error") return "error";
    return this.results().length ? "results" : "empty";
  });

  readonly emptyMessage = computed(() =>
    this.query()
      ? `No Pokémon match "${this.rawQuery().trim()}".`
      : "Every Pokémon is already on this team.",
  );

  constructor() {
    // Re-place the list whenever it opens or its contents change size.
    afterRenderEffect(() => {
      if (!this.isOpen()) return;
      this.dropdownState();
      this.results();
      this.repositionDropdown();
    });

    // Render the next batch when the end of the list scrolls into view,
    // following the guide's IntersectionObserver pattern.
    afterRenderEffect(() => {
      const anchor = this.scrollAnchor()?.nativeElement;
      const root = this.dropdown()?.nativeElement ?? null;
      this.scrollObserver?.disconnect();
      if (!anchor) return;
      this.scrollObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) this.loadMore();
        },
        { root, threshold: 0.1 },
      );
      this.scrollObserver.observe(anchor);
    });

    // Keep the highlighted row in view while arrowing through a long list.
    afterRenderEffect(() => {
      const index = this.isOpen() ? this.activeIndex() : -1;
      const root = this.dropdown()?.nativeElement;
      if (index < 0 || !root) return;
      const options = root.querySelectorAll('[role="option"]');
      options[index]?.scrollIntoView({ block: "nearest" });
    });

    // Capture phase so scrolling inside the dialog counts too.
    const onScroll = () => this.repositionDropdown();
    document.addEventListener("scroll", onScroll, true);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener("scroll", onScroll, true);
      this.scrollObserver?.disconnect();
    });
  }

  /** Renders the next batch of matches. */
  loadMore(): void {
    if (this.hasMore()) {
      this.visibleCount.update((count) => count + PICKER_PAGE_SIZE);
    }
  }

  repositionDropdown(): void {
    const anchor = this.field()?.nativeElement;
    if (!anchor || !this.isOpen()) return;

    const rect = anchor.getBoundingClientRect();
    const spaceBelow =
      window.innerHeight - rect.bottom - DROPDOWN_GAP_PX - VIEWPORT_MARGIN_PX;
    const spaceAbove = rect.top - DROPDOWN_GAP_PX - VIEWPORT_MARGIN_PX;
    const openDown =
      spaceBelow >= Math.min(DROPDOWN_MAX_HEIGHT_PX, DROPDOWN_MIN_HEIGHT_PX) ||
      spaceBelow >= spaceAbove;
    const maxHeight = Math.max(
      DROPDOWN_MIN_HEIGHT_PX,
      Math.min(DROPDOWN_MAX_HEIGHT_PX, openDown ? spaceBelow : spaceAbove),
    );

    this.dropdownPosition.set({
      left: rect.left,
      width: rect.width,
      maxHeight,
      top: openDown
        ? rect.bottom + DROPDOWN_GAP_PX
        : rect.top - DROPDOWN_GAP_PX - maxHeight,
    });
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.rawQuery.set(value);
    this.queryInput$.next(value);
    this.activeIndex.set(0);
    this.visibleCount.set(PICKER_PAGE_SIZE);
    this.isOpen.set(!this.isFull());
  }

  onFocus(): void {
    if (this.isFull()) return;
    this.visibleCount.set(PICKER_PAGE_SIZE);
    this.isOpen.set(true);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation(); // keep an enclosing dialog open
      this.isOpen.set(false);
      return;
    }
    if (
      event.key === "Backspace" &&
      !this.rawQuery() &&
      this.selected().length
    ) {
      this.remove(this.selected()[this.selected().length - 1].id);
      return;
    }
    if (!this.isOpen()) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.isOpen.set(true);
      }
      return;
    }

    const last = this.results().length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (this.activeIndex() >= last) this.loadMore();
        this.activeIndex.update((index) =>
          Math.min(index + 1, this.results().length - 1),
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        this.activeIndex.update((index) => Math.max(index - 1, 0));
        break;
      case "Enter": {
        // Enter picks a suggestion rather than submitting the form.
        event.preventDefault();
        const pokemon = this.results()[this.activeIndex()];
        if (pokemon) this.add(pokemon.id);
        break;
      }
    }
  }

  // Options carry no handlers of their own: they are not focusable in this
  // pattern, so clicks and hovers are delegated from the listbox.
  onListboxClick(event: MouseEvent): void {
    const index = this.optionIndexFrom(event);
    if (index !== null) this.add(this.results()[index].id);
  }

  onListboxPointerMove(event: MouseEvent): void {
    const index = this.optionIndexFrom(event);
    if (index !== null && index !== this.activeIndex()) {
      this.activeIndex.set(index);
    }
  }

  onDocumentPointerDown(event: PointerEvent): void {
    if (
      this.isOpen() &&
      !this.host.nativeElement.contains(event.target as Node)
    ) {
      this.isOpen.set(false);
      this.touched.emit();
    }
  }

  optionId(index: number): string {
    return `${this.inputId()}-option-${index}`;
  }

  label(pokemon: Pokemon): string {
    return toTitleCase(pokemon.name);
  }

  add(id: number): void {
    if (this.isFull() || this.selectedIds().includes(id)) return;
    this.selectionChange.emit([...this.selectedIds(), id]);
    this.touched.emit();
    this.clearQuery();
    if (this.selectedIds().length + 1 >= this.maxSelection()) {
      this.isOpen.set(false);
    }
    this.searchField()?.nativeElement.focus();
  }

  remove(id: number): void {
    this.selectionChange.emit(
      this.selectedIds().filter((entry) => entry !== id),
    );
    this.touched.emit();
    this.searchField()?.nativeElement.focus();
  }

  retryPokedex(): void {
    this.store.loadPokemon();
  }

  private optionIndexFrom(event: Event): number | null {
    const option = (event.target as Element).closest<HTMLElement>(
      "[data-index]",
    );
    return option ? Number(option.dataset["index"]) : null;
  }

  private clearQuery(): void {
    this.rawQuery.set("");
    this.queryInput$.next("");
    this.activeIndex.set(0);
    this.visibleCount.set(PICKER_PAGE_SIZE);
    const field = this.searchField()?.nativeElement;
    if (field) field.value = "";
  }
}
