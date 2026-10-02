import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";
import { Pokemon, PokemonStats } from "../models/pokemon.model";
import { PokemonApiService } from "../services/pokemon-api.service";
import {
  Page,
  PokemonSelectors,
  filterPokemon,
  paginate,
  sortPokemon,
} from "./pokemon.selectors";
import { PokemonStore } from "./pokemon.store";

function makePokemon(
  id: number,
  name: string,
  types: string[],
  stats: Partial<PokemonStats> = {},
): Pokemon {
  const full: PokemonStats = {
    hp: 50,
    attack: 50,
    defense: 50,
    specialAttack: 50,
    specialDefense: 50,
    speed: 50,
    ...stats,
  };
  const total = Object.values(full).reduce((sum, value) => sum + value, 0);
  return {
    id,
    name,
    height: 1,
    weight: 1,
    types,
    stats: full,
    total,
    spriteUrl: null,
  };
}

const BULBASAUR = makePokemon(1, "bulbasaur", ["grass", "poison"], {
  speed: 45,
});
const CHARMANDER = makePokemon(4, "charmander", ["fire"], { speed: 65 });
const CHARIZARD = makePokemon(6, "charizard", ["fire", "flying"], {
  speed: 100,
});
const MR_MIME = makePokemon(122, "mr-mime", ["psychic", "fairy"], {
  speed: 90,
});
const ALL = [BULBASAUR, CHARMANDER, CHARIZARD, MR_MIME];

describe("pokemon selectors", () => {
  describe("filterPokemon", () => {
    it("matches names ignoring case and punctuation", () => {
      expect(filterPokemon(ALL, { search: "CHAR", type: null })).toEqual([
        CHARMANDER,
        CHARIZARD,
      ]);
      expect(filterPokemon(ALL, { search: "Mr. Mime", type: null })).toEqual([
        MR_MIME,
      ]);
    });

    it("combines the name search with the type filter", () => {
      expect(filterPokemon(ALL, { search: "char", type: "flying" })).toEqual([
        CHARIZARD,
      ]);
      expect(filterPokemon(ALL, { search: "", type: "fire" })).toEqual([
        CHARMANDER,
        CHARIZARD,
      ]);
    });

    it("returns an empty list when nothing matches", () => {
      expect(filterPokemon(ALL, { search: "pikachu", type: null })).toEqual([]);
    });
  });

  describe("sortPokemon", () => {
    it("sorts by a stat in either direction without mutating the input", () => {
      const input = [...ALL];
      expect(
        sortPokemon(input, { key: "speed", direction: "desc" }).map(
          (p) => p.id,
        ),
      ).toEqual([6, 122, 4, 1]);
      expect(
        sortPokemon(input, { key: "speed", direction: "asc" }).map((p) => p.id),
      ).toEqual([1, 4, 122, 6]);
      expect(input).toEqual(ALL);
    });

    it("breaks ties by National Pokédex number", () => {
      const tied = [makePokemon(9, "b", []), makePokemon(3, "a", [])];
      expect(
        sortPokemon(tied, { key: "hp", direction: "desc" }).map((p) => p.id),
      ).toEqual([3, 9]);
    });

    it("sorts names alphabetically", () => {
      expect(
        sortPokemon(ALL, { key: "name", direction: "asc" }).map((p) => p.name),
      ).toEqual(["bulbasaur", "charizard", "charmander", "mr-mime"]);
    });
  });

  describe("paginate", () => {
    it("returns the requested page with page metadata", () => {
      expect(paginate(ALL, 1, 3)).toEqual({
        items: [MR_MIME],
        index: 1,
        size: 3,
        pageCount: 2,
        totalItems: 4,
      });
    });

    it("clamps an out-of-range index to the last page", () => {
      expect(paginate(ALL, 5, 3).index).toBe(1);
    });

    it("reports one empty page when there are no items", () => {
      expect(paginate([], 0, 10)).toEqual({
        items: [],
        index: 0,
        size: 10,
        pageCount: 1,
        totalItems: 0,
      });
    });
  });

  describe("PokemonSelectors.page$", () => {
    let store: PokemonStore;
    let selectors: PokemonSelectors;
    let latestPage: Page<Pokemon> | undefined;

    beforeEach(() => {
      vi.useFakeTimers();
      TestBed.configureTestingModule({
        providers: [
          {
            provide: PokemonApiService,
            useValue: { getPokemon$: () => of(ALL) },
          },
        ],
      });
      store = TestBed.inject(PokemonStore);
      selectors = TestBed.inject(PokemonSelectors);
      store.loadPokemon();
      selectors.page$.subscribe((page) => (latestPage = page));
    });

    afterEach(() => vi.useRealTimers());

    it("applies the search only after 300 ms without typing", () => {
      expect(latestPage?.totalItems).toBe(4);

      store.setSearch("char");
      vi.advanceTimersByTime(299);
      expect(latestPage?.totalItems).toBe(4);

      vi.advanceTimersByTime(1);
      expect(latestPage?.items.map((p) => p.name)).toEqual([
        "charmander",
        "charizard",
      ]);
    });

    it("restarts the debounce window on each keystroke", () => {
      store.setSearch("c");
      vi.advanceTimersByTime(200);
      store.setSearch("ch");
      vi.advanceTimersByTime(200);
      expect(latestPage?.totalItems).toBe(4);

      vi.advanceTimersByTime(100);
      expect(latestPage?.totalItems).toBe(2);
    });

    it("applies type filter, sort and page size together", () => {
      store.setTypeFilter("fire");
      store.sortBy("speed");
      store.setPageSize(10);

      expect(latestPage?.items.map((p) => p.name)).toEqual([
        "charizard",
        "charmander",
      ]);
    });
  });
});
