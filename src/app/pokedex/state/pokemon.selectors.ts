import { Injectable, inject } from "@angular/core";
import {
  Observable,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  merge,
  shareReplay,
  skip,
  switchMap,
  take,
} from "rxjs";
import { POKEMON_SEARCH_DEBOUNCE_MS } from "../constants/pokemon.constants";
import { Pokemon, PokemonSort } from "../models/pokemon.model";
import {
  IDLE_DETAILS_ENTRY,
  PokemonDetailsEntry,
  PokemonStore,
} from "./pokemon.store";

export interface PokemonFilter {
  search: string;
  type: string | null;
}

export interface Page<T> {
  items: T[];
  index: number; // zero-based, clamped to the available pages
  size: number;
  pageCount: number;
  totalItems: number;
}

/** Lowercases and drops punctuation so "Mr. Mime" matches "mr-mime". */
function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Keeps Pokémon whose name contains `search` (ignoring case and punctuation)
 * and, when `type` is set, that have that type.
 */
export function filterPokemon(
  pokemon: readonly Pokemon[],
  { search, type }: PokemonFilter,
): Pokemon[] {
  const term = normalizeName(search);
  return pokemon.filter(
    (entry) =>
      (!term || normalizeName(entry.name).includes(term)) &&
      (!type || entry.types.includes(type)),
  );
}

/** Returns a sorted copy; ties fall back to National Pokédex order. */
export function sortPokemon(
  pokemon: readonly Pokemon[],
  { key, direction }: PokemonSort,
): Pokemon[] {
  const factor = direction === "asc" ? 1 : -1;
  const valueOf = (entry: Pokemon): number | string => {
    if (key === "id" || key === "name" || key === "total") return entry[key];
    return entry.stats[key];
  };
  return [...pokemon].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    const compared =
      typeof left === "string"
        ? left.localeCompare(String(right))
        : left - Number(right);
    return factor * compared || a.id - b.id;
  });
}

/** Slices one page out of `items`, clamping `index` into range. */
export function paginate<T>(
  items: readonly T[],
  index: number,
  size: number,
): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const safeIndex = Math.min(Math.max(index, 0), pageCount - 1);
  const start = safeIndex * size;
  return {
    items: items.slice(start, start + size),
    index: safeIndex,
    size,
    pageCount,
    totalItems: items.length,
  };
}

@Injectable({ providedIn: "root" })
export class PokemonSelectors {
  private readonly store = inject(PokemonStore);

  /** Load state of the Pokédex itself, for the table's four UI states. */
  readonly status$ = this.store.select((state) => state.status);

  /** User-facing message for a failed Pokédex load, or `null`. */
  readonly error$ = this.store.select((state) => state.error);

  /** Current search text, type filter, sort and page. */
  readonly query$ = this.store.select((state) => state.query);

  /** Every cached Pokémon in National Pokédex order. */
  readonly allPokemon$: Observable<Pokemon[]> = this.store.state$.pipe(
    // ids and entities change together; compare both to avoid a glitch frame.
    distinctUntilChanged(
      (prev, next) => prev.ids === next.ids && prev.entities === next.entities,
    ),
    map((state) => state.ids.map((id) => state.entities[id])),
    shareReplay(1),
  );

  /** Cached Pokémon keyed by National Pokédex number, for id lookups. */
  readonly entities$: Observable<Readonly<Record<number, Pokemon>>> =
    this.store.select((state) => state.entities);

  /** Distinct types across the cache, alphabetically, for the type filter. */
  readonly types$: Observable<string[]> = this.allPokemon$.pipe(
    map((pokemon) => [...new Set(pokemon.flatMap((p) => p.types))].sort()),
    distinctUntilChanged((prev, next) => prev.join() === next.join()),
    shareReplay(1),
  );

  /**
   * Search text once typing pauses for 300 ms. The initial value passes
   * straight through so the first render is not delayed.
   */
  readonly searchTerm$: Observable<string> = (() => {
    const raw$ = this.store.select((state) => state.query.search.trim());
    return merge(
      raw$.pipe(take(1)),
      raw$.pipe(skip(1), debounceTime(POKEMON_SEARCH_DEBOUNCE_MS)),
    ).pipe(distinctUntilChanged(), shareReplay(1));
  })();

  /** Pokémon matching the debounced search and the type filter. */
  readonly filteredPokemon$: Observable<Pokemon[]> = this.searchTerm$.pipe(
    switchMap((search) =>
      combineLatest([
        this.allPokemon$,
        this.store.select((state) => state.query.type),
      ]).pipe(
        map(([pokemon, type]) => filterPokemon(pokemon, { search, type })),
      ),
    ),
    shareReplay(1),
  );

  /** Filtered Pokémon in the chosen sort order. */
  readonly sortedPokemon$: Observable<Pokemon[]> = combineLatest([
    this.filteredPokemon$,
    this.store.select((state) => state.query.sort),
  ]).pipe(
    map(([pokemon, sort]) => sortPokemon(pokemon, sort)),
    shareReplay(1),
  );

  /** The current page of sorted, filtered Pokémon. */
  readonly page$: Observable<Page<Pokemon>> = combineLatest([
    this.sortedPokemon$,
    this.store.select((state) => state.query.page),
  ]).pipe(
    map(([pokemon, page]) => paginate(pokemon, page.index, page.size)),
    shareReplay(1),
  );

  /**
   * Streams one cached Pokémon, or `null` if it is not in the cache.
   * @param id National Pokédex number.
   */
  pokemonById$(id: number): Observable<Pokemon | null> {
    return this.store.select(
      (state) => (state.entities[id] as Pokemon | undefined) ?? null,
    );
  }

  /**
   * Streams the load state of one Pokémon's details.
   * @param id National Pokédex number.
   */
  detailsById$(id: number): Observable<PokemonDetailsEntry> {
    return this.store.select(
      (state) => state.details[id] ?? IDLE_DETAILS_ENTRY,
    );
  }
}
