import { PageSize, PokemonSort, StatKey } from "../models/pokemon.model";

// National Pokédex numbers run 1–1025; alternate forms start at id 10001.
export const POKEDEX_SIZE = 1025;

export const POKEMON_SEARCH_DEBOUNCE_MS = 300;

// Highest base stat any Pokémon has (Blissey's HP); the radar and stat bars scale to it.
export const MAX_BASE_STAT = 255;

export const PAGE_SIZE_OPTIONS: readonly PageSize[] = [10, 25, 50];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

export const DEFAULT_POKEMON_SORT: PokemonSort = {
  key: "id",
  direction: "asc",
};

export const STAT_KEYS: readonly StatKey[] = [
  "hp",
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
];

// Column labels as named in the task: HP, Attack, Defense, Sp.Atk, Sp.Def, Speed
export const STAT_LABELS: Readonly<Record<StatKey, string>> = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  specialAttack: "Sp.Atk",
  specialDefense: "Sp.Def",
  speed: "Speed",
};

// PokéAPI stat names → StatKey
export const API_STAT_KEYS: Readonly<Record<string, StatKey>> = {
  hp: "hp",
  attack: "attack",
  defense: "defense",
  "special-attack": "specialAttack",
  "special-defense": "specialDefense",
  speed: "speed",
};
