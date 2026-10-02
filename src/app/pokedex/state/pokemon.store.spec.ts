import { TestBed } from "@angular/core/testing";
import { Subject, of, throwError } from "rxjs";
import { ApiError } from "../../core/graphql";
import { Pokemon, PokemonDetails } from "../models/pokemon.model";
import { PokemonApiService } from "../services/pokemon-api.service";
import { PokemonStore } from "./pokemon.store";

function makePokemon(id: number, name: string): Pokemon {
  return {
    id,
    name,
    height: 1,
    weight: 1,
    types: ["normal"],
    stats: {
      hp: 50,
      attack: 50,
      defense: 50,
      specialAttack: 50,
      specialDefense: 50,
      speed: 50,
    },
    total: 300,
    spriteUrl: null,
  };
}

const LIST = [makePokemon(1, "bulbasaur"), makePokemon(4, "charmander")];
const DETAILS: PokemonDetails = {
  ...makePokemon(4, "charmander"),
  abilities: [{ name: "blaze", shortEffect: "Boosts fire.", isHidden: false }],
};
const NETWORK_ERROR = new ApiError("network", "offline");

describe("PokemonStore", () => {
  let store: PokemonStore;
  const api = { getPokemon$: vi.fn(), getPokemonDetails$: vi.fn() };

  beforeEach(() => {
    api.getPokemon$.mockReset();
    api.getPokemonDetails$.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: PokemonApiService, useValue: api }],
    });
    store = TestBed.inject(PokemonStore);
  });

  describe("loadPokemon", () => {
    it("caches the list and does not fetch it again", () => {
      api.getPokemon$.mockReturnValue(of(LIST));

      store.loadPokemon();
      store.loadPokemon();

      expect(api.getPokemon$).toHaveBeenCalledOnce();
      expect(store.snapshot.status).toBe("success");
      expect(store.snapshot.ids).toEqual([1, 4]);
      expect(store.snapshot.entities[4].name).toBe("charmander");
    });

    it("ignores repeat calls while a load is in flight", () => {
      const response$ = new Subject<Pokemon[]>();
      api.getPokemon$.mockReturnValue(response$);

      store.loadPokemon();
      store.loadPokemon();
      expect(store.snapshot.status).toBe("loading");

      response$.next(LIST);
      expect(api.getPokemon$).toHaveBeenCalledOnce();
      expect(store.snapshot.status).toBe("success");
    });

    it("exposes a friendly error and recovers on retry", () => {
      api.getPokemon$.mockReturnValueOnce(throwError(() => NETWORK_ERROR));

      store.loadPokemon();
      expect(store.snapshot.status).toBe("error");
      expect(store.snapshot.error).toBe(NETWORK_ERROR.userMessage);

      api.getPokemon$.mockReturnValueOnce(of(LIST));
      store.loadPokemon();
      expect(store.snapshot.status).toBe("success");
      expect(store.snapshot.error).toBeNull();
    });
  });

  describe("loadDetails", () => {
    it("caches details per Pokémon", () => {
      api.getPokemonDetails$.mockReturnValue(of(DETAILS));

      store.loadDetails(4);
      store.loadDetails(4);

      expect(api.getPokemonDetails$).toHaveBeenCalledOnce();
      expect(store.snapshot.details[4]).toEqual({
        status: "success",
        data: DETAILS,
        error: null,
      });
    });

    it("records a friendly error that a later call retries", () => {
      api.getPokemonDetails$.mockReturnValueOnce(
        throwError(() => NETWORK_ERROR),
      );
      store.loadDetails(4);
      expect(store.snapshot.details[4]?.status).toBe("error");
      expect(store.snapshot.details[4]?.error).toBe(NETWORK_ERROR.userMessage);

      api.getPokemonDetails$.mockReturnValueOnce(of(DETAILS));
      store.loadDetails(4);
      expect(store.snapshot.details[4]?.status).toBe("success");
    });

    it("cancels a pending request when another Pokémon is selected", () => {
      const first$ = new Subject<PokemonDetails>();
      api.getPokemonDetails$
        .mockReturnValueOnce(first$)
        .mockReturnValueOnce(of(DETAILS));

      store.loadDetails(1);
      store.loadDetails(4);

      expect(first$.observed).toBe(false);
      expect(store.snapshot.details[1]?.status).toBe("idle");
      expect(store.snapshot.details[4]?.status).toBe("success");
    });
  });

  describe("list query", () => {
    it("starts a new stat column highest-first and flips on repeat", () => {
      store.sortBy("attack");
      expect(store.snapshot.query.sort).toEqual({
        key: "attack",
        direction: "desc",
      });

      store.sortBy("attack");
      expect(store.snapshot.query.sort.direction).toBe("asc");

      store.sortBy("name");
      expect(store.snapshot.query.sort).toEqual({
        key: "name",
        direction: "asc",
      });
    });

    it("returns to the first page when search, type, sort or size change", () => {
      const changes = [
        () => store.setSearch("char"),
        () => store.setTypeFilter("fire"),
        () => store.sortBy("speed"),
        () => store.setPageSize(25),
      ];
      for (const change of changes) {
        store.setPage(3);
        change();
        expect(store.snapshot.query.page.index).toBe(0);
      }
    });
  });
});
