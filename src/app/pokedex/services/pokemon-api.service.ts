import { Injectable, inject } from "@angular/core";
import { Observable, map } from "rxjs";
import {
  API_MAX_RETRIES,
  API_RETRY_DELAY_MS,
  POKEAPI_GRAPHQL_URL,
} from "../../common/constants/api.constants";
import { retryWithDelay } from "../../common/utils/retry-with-delay.util";
import {
  ApiError,
  GraphqlClientService,
  GraphqlVariables,
} from "../../core/graphql";
import { API_STAT_KEYS, STAT_KEYS } from "../constants/pokemon.constants";
import {
  Pokemon,
  PokemonAbility,
  PokemonDetails,
  PokemonStats,
} from "../models/pokemon.model";

interface ApiPokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  pokemon_v2_pokemontypes: { pokemon_v2_type: { name: string } }[];
  pokemon_v2_pokemonstats: {
    base_stat: number;
    pokemon_v2_stat: { name: string };
  }[];
  pokemon_v2_pokemonsprites: { sprites: string | null }[];
}

interface ApiPokemonAbility {
  pokemon_v2_ability: {
    name: string;
    pokemon_v2_abilityeffecttexts: { short_effect: string }[];
  };
  is_hidden: boolean;
}

// Only the front sprite URL is requested: the full `sprites` object holds
// dozens of image URLs per Pokémon, turning the full-dex load from ~650 KB
// into ~14 MB of JSON.
const pokemonFieldsFragment = /* GraphQL */ `
  fragment PokemonFields on pokemon_v2_pokemon {
    id
    name
    height
    weight
    pokemon_v2_pokemontypes(order_by: { slot: asc }) {
      pokemon_v2_type {
        name
      }
    }
    pokemon_v2_pokemonstats {
      base_stat
      pokemon_v2_stat {
        name
      }
    }
    pokemon_v2_pokemonsprites {
      sprites(path: "front_default")
    }
  }
`;

const getPokemonQuery = /* GraphQL */ `
  query GetPokemon($limit: Int, $offset: Int) {
    pokemon_v2_pokemon(limit: $limit, offset: $offset, order_by: { id: asc }) {
      ...PokemonFields
    }
  }
  ${pokemonFieldsFragment}
`;

const getPokemonDetailsQuery = /* GraphQL */ `
  query GetPokemonDetails($pokemonId: Int!) {
    pokemon_v2_pokemon_by_pk(id: $pokemonId) {
      ...PokemonFields
    }
    pokemon_v2_pokemonability(where: { pokemon_id: { _eq: $pokemonId } }) {
      pokemon_v2_ability {
        name
        pokemon_v2_abilityeffecttexts(where: { language_id: { _eq: 9 } }) {
          short_effect
        }
      }
      is_hidden
    }
  }
  ${pokemonFieldsFragment}
`;

@Injectable({ providedIn: "root" })
export class PokemonApiService {
  private readonly graphql = inject(GraphqlClientService);

  /**
   * Fetches a page of Pokémon with types, base stats and front sprite,
   * ordered by National Pokédex number. Transient failures are retried.
   * @param limit Maximum number of Pokémon to return.
   * @param offset Number of Pokémon to skip.
   */
  getPokemon$(limit: number, offset = 0): Observable<Pokemon[]> {
    return this.query$<{ pokemon_v2_pokemon: ApiPokemon[] }>(getPokemonQuery, {
      limit,
      offset,
    }).pipe(map((data) => data.pokemon_v2_pokemon.map(toPokemon)));
  }

  /**
   * Fetches one Pokémon's stats and abilities. Transient failures are
   * retried; fails with an {@link ApiError} if the id does not exist.
   * @param id National Pokédex number.
   */
  getPokemonDetails$(id: number): Observable<PokemonDetails> {
    return this.query$<{
      pokemon_v2_pokemon_by_pk: ApiPokemon | null;
      pokemon_v2_pokemonability: ApiPokemonAbility[];
    }>(getPokemonDetailsQuery, { pokemonId: id }).pipe(
      map((data) => {
        if (!data.pokemon_v2_pokemon_by_pk) {
          throw new ApiError("graphql", `Pokémon #${id} not found`);
        }
        return {
          ...toPokemon(data.pokemon_v2_pokemon_by_pk),
          abilities: data.pokemon_v2_pokemonability.map(toAbility),
        };
      }),
    );
  }

  private query$<TData>(
    query: string,
    variables: GraphqlVariables,
  ): Observable<TData> {
    return this.graphql
      .request$<TData>(POKEAPI_GRAPHQL_URL, query, variables)
      .pipe(
        retryWithDelay({
          count: API_MAX_RETRIES,
          delayMs: API_RETRY_DELAY_MS,
          shouldRetry: (error) =>
            error instanceof ApiError && error.isRetryable,
        }),
      );
  }
}

function toPokemon(raw: ApiPokemon): Pokemon {
  const stats = Object.fromEntries(
    STAT_KEYS.map((key) => [key, 0]),
  ) as PokemonStats;
  for (const { base_stat, pokemon_v2_stat } of raw.pokemon_v2_pokemonstats) {
    const key = API_STAT_KEYS[pokemon_v2_stat.name];
    if (key) stats[key] = base_stat;
  }

  return {
    id: raw.id,
    name: raw.name,
    height: raw.height,
    weight: raw.weight,
    types: raw.pokemon_v2_pokemontypes.map((t) => t.pokemon_v2_type.name),
    stats,
    total: STAT_KEYS.reduce((sum, key) => sum + stats[key], 0),
    spriteUrl: raw.pokemon_v2_pokemonsprites[0]?.sprites ?? null,
  };
}

function toAbility(raw: ApiPokemonAbility): PokemonAbility {
  return {
    name: raw.pokemon_v2_ability.name,
    shortEffect:
      raw.pokemon_v2_ability.pokemon_v2_abilityeffecttexts[0]?.short_effect ??
      null,
    isHidden: raw.is_hidden,
  };
}
