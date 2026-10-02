import { Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  exhaustMap,
  finalize,
  map,
  switchMap,
  tap,
} from "rxjs";
import { LoadStatus } from "../../common/models/load-status.model";
import { ApiError } from "../../core/graphql";
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_POKEMON_SORT,
  POKEDEX_SIZE,
} from "../constants/pokemon.constants";
import {
  PageSize,
  Pokemon,
  PokemonDetails,
  PokemonSort,
  PokemonSortKey,
  SortDirection,
} from "../models/pokemon.model";
import { PokemonApiService } from "../services/pokemon-api.service";

export interface PokemonListQuery {
  search: string;
  type: string | null;
  sort: PokemonSort;
  page: { index: number; size: PageSize };
}

export interface PokemonDetailsEntry {
  status: LoadStatus;
  data: PokemonDetails | null;
  error: string | null;
}

export interface PokemonState {
  status: LoadStatus;
  error: string | null;
  ids: number[];
  entities: Readonly<Record<number, Pokemon>>;
  details: Readonly<Partial<Record<number, PokemonDetailsEntry>>>;
  query: PokemonListQuery;
}

export const IDLE_DETAILS_ENTRY: PokemonDetailsEntry = {
  status: "idle",
  data: null,
  error: null,
};

export const INITIAL_POKEMON_STATE: PokemonState = {
  status: "idle",
  error: null,
  ids: [],
  entities: {},
  details: {},
  query: {
    search: "",
    type: null,
    sort: DEFAULT_POKEMON_SORT,
    page: { index: 0, size: DEFAULT_PAGE_SIZE },
  },
};

// Columns that start ascending when first sorted; stats start highest-first.
const ASCENDING_FIRST_SORT_KEYS: ReadonlySet<PokemonSortKey> = new Set([
  "id",
  "name",
]);

@Injectable({ providedIn: "root" })
export class PokemonStore {
  private readonly api = inject(PokemonApiService);
  private readonly stateSubject = new BehaviorSubject<PokemonState>(
    INITIAL_POKEMON_STATE,
  );
  private readonly loadListRequests$ = new Subject<void>();
  private readonly loadDetailsRequests$ = new Subject<number>();

  /** Every state change, starting with the current state. */
  readonly state$: Observable<PokemonState> = this.stateSubject.asObservable();

  constructor() {
    this.loadListRequests$
      .pipe(
        exhaustMap(() => {
          this.patch({ status: "loading", error: null });
          return this.api.getPokemon$(POKEDEX_SIZE).pipe(
            tap((pokemon) => this.cacheList(pokemon)),
            catchError((error: unknown) => {
              this.patch({
                status: "error",
                error: ApiError.from(error).userMessage,
              });
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.loadDetailsRequests$
      .pipe(
        switchMap((id) => {
          this.setDetails(id, { status: "loading", data: null, error: null });
          return this.api.getPokemonDetails$(id).pipe(
            tap((details) => this.cacheDetails(details)),
            catchError((error: unknown) => {
              this.setDetails(id, {
                status: "error",
                data: null,
                error: ApiError.from(error).userMessage,
              });
              return EMPTY;
            }),
            // A request cancelled by a newer selection goes back to idle so
            // it is fetched again if that Pokémon is selected later.
            finalize(() => {
              if (this.snapshot.details[id]?.status === "loading") {
                this.setDetails(id, IDLE_DETAILS_ENTRY);
              }
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** The current state, for one-off reads. */
  get snapshot(): PokemonState {
    return this.stateSubject.value;
  }

  /**
   * Streams one slice of state, emitting only when that slice changes.
   * @param projector Picks the slice from the state.
   */
  select<T>(projector: (state: PokemonState) => T): Observable<T> {
    return this.state$.pipe(map(projector), distinctUntilChanged());
  }

  /**
   * Loads the whole Pokédex into the cache. Does nothing while a load is in
   * flight or once the cache is filled; call again after an error to retry.
   */
  loadPokemon(): void {
    const { status } = this.snapshot;
    if (status === "loading" || status === "success") return;
    this.loadListRequests$.next();
  }

  /**
   * Loads one Pokémon's details (stats and abilities) into the cache. Does
   * nothing if they are cached or in flight; call again after an error to retry.
   * @param id National Pokédex number.
   */
  loadDetails(id: number): void {
    const status = this.snapshot.details[id]?.status;
    if (status === "loading" || status === "success") return;
    this.loadDetailsRequests$.next(id);
  }

  /**
   * Sets the name search text and returns to the first page.
   * @param search Raw input text; matching is debounced by the selectors.
   */
  setSearch(search: string): void {
    this.patchQuery({ search, page: this.firstPage() });
  }

  /**
   * Filters by type and returns to the first page.
   * @param type Type name, or `null` for all types.
   */
  setTypeFilter(type: string | null): void {
    this.patchQuery({ type, page: this.firstPage() });
  }

  /**
   * Sorts by `key` and returns to the first page. Choosing the current key
   * again flips the direction; a new stat key starts highest-first, while
   * number and name start ascending.
   * @param key Column to sort by.
   */
  sortBy(key: PokemonSortKey): void {
    const { sort } = this.snapshot.query;
    let direction: SortDirection;
    if (sort.key === key) {
      direction = sort.direction === "asc" ? "desc" : "asc";
    } else {
      direction = ASCENDING_FIRST_SORT_KEYS.has(key) ? "asc" : "desc";
    }
    this.patchQuery({ sort: { key, direction }, page: this.firstPage() });
  }

  /**
   * Shows a page of results. Out-of-range values are clamped by the selectors.
   * @param index Zero-based page index.
   */
  setPage(index: number): void {
    const { page } = this.snapshot.query;
    if (page.index !== index) this.patchQuery({ page: { ...page, index } });
  }

  /**
   * Changes the number of rows per page and returns to the first page.
   * @param size One of the allowed page sizes.
   */
  setPageSize(size: PageSize): void {
    this.patchQuery({ page: { index: 0, size } });
  }

  private cacheList(pokemon: Pokemon[]): void {
    const entities = { ...this.snapshot.entities };
    for (const entry of pokemon) entities[entry.id] = entry;
    this.patch({
      status: "success",
      error: null,
      ids: pokemon.map((entry) => entry.id),
      entities,
    });
  }

  private cacheDetails(details: PokemonDetails): void {
    this.setDetails(details.id, {
      status: "success",
      data: details,
      error: null,
    });
  }

  private setDetails(id: number, entry: PokemonDetailsEntry): void {
    this.patch({ details: { ...this.snapshot.details, [id]: entry } });
  }

  private firstPage(): PokemonListQuery["page"] {
    const { page } = this.snapshot.query;
    return page.index === 0 ? page : { ...page, index: 0 };
  }

  private patchQuery(partial: Partial<PokemonListQuery>): void {
    this.patch({ query: { ...this.snapshot.query, ...partial } });
  }

  private patch(partial: Partial<PokemonState>): void {
    this.stateSubject.next({ ...this.snapshot, ...partial });
  }
}
