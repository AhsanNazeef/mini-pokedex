export type StatKey =
  "hp" | "attack" | "defense" | "specialAttack" | "specialDefense" | "speed";

export type PokemonStats = Record<StatKey, number>;

export interface Pokemon {
  id: number; // National Pokédex number
  name: string;
  height: number; // decimetres
  weight: number; // hectograms
  types: string[]; // primary type first
  stats: PokemonStats;
  total: number;
  spriteUrl: string | null;
}

export interface PokemonAbility {
  name: string;
  shortEffect: string | null;
  isHidden: boolean;
}

export interface PokemonDetails extends Pokemon {
  abilities: PokemonAbility[];
}

export type PokemonSortKey = StatKey | "total" | "id" | "name";

export type SortDirection = "asc" | "desc";

export interface PokemonSort {
  key: PokemonSortKey;
  direction: SortDirection;
}

export type PageSize = 10 | 25 | 50;
