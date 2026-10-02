import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  CustomSelectComponent,
  SelectOption,
} from "../common/components/custom-select/custom-select.component";
import { HeaderComponent } from "../common/components/header/header.component";
import { PaginationComponent } from "../common/components/pagination/pagination.component";
import { ImagePreloadService } from "../common/services/image-preload.service";
import { toTitleCase } from "../common/utils/string.util";
import { PokemonTableComponent } from "./components/pokemon-table/pokemon-table.component";
import { PAGE_SIZE_OPTIONS } from "./constants/pokemon.constants";
import { PageSize, Pokemon, PokemonSortKey } from "./models/pokemon.model";
import { PokemonSelectors } from "./state/pokemon.selectors";
import { PokemonStore } from "./state/pokemon.store";

@Component({
  selector: "app-pokedex-page",
  standalone: true,
  imports: [
    CustomSelectComponent,
    HeaderComponent,
    PaginationComponent,
    PokemonTableComponent,
  ],
  templateUrl: "./pokedex.component.html",
  styleUrl: "./pokedex.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokedexPage implements OnInit {
  private readonly store = inject(PokemonStore);
  private readonly selectors = inject(PokemonSelectors);
  private readonly imagePreload = inject(ImagePreloadService);

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  // Store selectors bridged into the template
  readonly status = toSignal(this.selectors.status$, { requireSync: true });
  readonly errorMessage = toSignal(this.selectors.error$, {
    requireSync: true,
  });
  readonly query = toSignal(this.selectors.query$, { requireSync: true });
  readonly searchTerm = toSignal(this.selectors.searchTerm$, {
    requireSync: true,
  });
  readonly page = toSignal(this.selectors.page$, { requireSync: true });
  readonly types = toSignal(this.selectors.types$, { requireSync: true });
  private readonly sortedPokemon = toSignal(this.selectors.sortedPokemon$, {
    requireSync: true,
  });

  // UI state
  readonly selectedPokemonId = signal<number | null>(null);
  readonly isPanelOpen = signal(false);

  readonly isReady = computed(() => this.status() === "success");
  readonly typeOptions = computed<SelectOption[]>(() => [
    { value: "", label: "All types" },
    ...this.types().map((type) => ({ value: type, label: toTitleCase(type) })),
  ]);

  constructor() {
    // Fetch the next page's sprites in the background so paging feels instant.
    effect(() => {
      const { index, size } = this.page();
      const nextPage = this.sortedPokemon().slice(
        (index + 1) * size,
        (index + 2) * size,
      );
      this.imagePreload.preload(nextPage.map((pokemon) => pokemon.spriteUrl));
    });
  }

  ngOnInit(): void {
    this.store.loadPokemon();
  }

  onSearchChange(search: string): void {
    this.store.setSearch(search);
  }

  onTypeChange(type: string): void {
    this.store.setTypeFilter(type || null);
  }

  onSortChange(key: PokemonSortKey): void {
    this.store.sortBy(key);
  }

  onPageChange(index: number): void {
    this.store.setPage(index);
  }

  onPageSizeChange(size: number): void {
    if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(size)) {
      this.store.setPageSize(size as PageSize);
    }
  }

  onRetry(): void {
    this.store.loadPokemon();
  }

  onClearFilters(): void {
    this.store.setSearch("");
    this.store.setTypeFilter(null);
  }

  onSelectPokemon(pokemon: Pokemon): void {
    this.selectedPokemonId.set(pokemon.id);
    this.isPanelOpen.set(true);
  }
}
