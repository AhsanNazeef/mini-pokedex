import { Injectable, inject } from "@angular/core";
import { Observable, map, of } from "rxjs";
import { MOCK_GRAPHQL_URL } from "../../common/constants/api.constants";
import { ApiError, GraphqlClientService } from "../../core/graphql";
import { DEFAULT_TRAINER_ID } from "../constants/team.constants";
import { CreateTeamInput, Team } from "../models/team.model";

interface ApiTeam {
  id: string;
  trainer_id: string;
  name: string;
  pokemon_ids: number[];
  created_at: string;
  Trainer: { name: string } | null;
}

const teamFields = /* GraphQL */ `
  id
  trainer_id
  name
  pokemon_ids
  created_at
  Trainer {
    name
  }
`;

const getTeamsQuery = /* GraphQL */ `
  query GetTeams {
    allTeams {
      ${teamFields}
    }
  }
`;

// `q` is the mock server's case-insensitive full-text filter, so this finds
// near-matches; the exact comparison happens in the service.
const findTeamsByNameQuery = /* GraphQL */ `
  query FindTeamsByName($name: String!) {
    allTeams(filter: { q: $name }) {
      id
      name
    }
  }
`;

const createTeamMutation = /* GraphQL */ `
  mutation CreateTeam(
    $trainerId: ID!
    $name: String!
    $pokemonIds: [Int]!
    $createdAt: String!
  ) {
    createTeam(
      trainer_id: $trainerId
      name: $name
      pokemon_ids: $pokemonIds
      created_at: $createdAt
    ) {
      ${teamFields}
    }
  }
`;

const removeTeamMutation = /* GraphQL */ `
  mutation RemoveTeam($id: ID!) {
    removeTeam(id: $id) {
      id
    }
  }
`;

@Injectable({ providedIn: "root" })
export class TeamApiService {
  private readonly graphql = inject(GraphqlClientService);

  /** Fetches every team from the mock server. */
  getTeams$(): Observable<Team[]> {
    return this.graphql
      .request$<{ allTeams: ApiTeam[] }>(MOCK_GRAPHQL_URL, getTeamsQuery)
      .pipe(map((data) => data.allTeams.map(toTeam)));
  }

  /**
   * Whether another team already uses this name, ignoring case and outer
   * spaces. Backs the form's async uniqueness check.
   * @param name Candidate team name.
   * @param exceptId Team id to ignore, when renaming an existing team.
   */
  isNameTaken$(name: string, exceptId?: string): Observable<boolean> {
    const needle = name.trim().toLowerCase();
    if (!needle) return of(false);
    return this.graphql
      .request$<{ allTeams: { id: string; name: string }[] }>(
        MOCK_GRAPHQL_URL,
        findTeamsByNameQuery,
        { name: needle },
      )
      .pipe(
        map((data) =>
          data.allTeams.some(
            (team) =>
              team.id !== exceptId && team.name.trim().toLowerCase() === needle,
          ),
        ),
      );
  }

  /**
   * Creates a team for the default trainer, stamped with the current time.
   * Not retried: a retry after an ambiguous failure could create duplicates.
   * @param input Team name and the chosen Pokémon's National Pokédex numbers.
   */
  createTeam$(input: CreateTeamInput): Observable<Team> {
    return this.graphql
      .request$<{ createTeam: ApiTeam }>(MOCK_GRAPHQL_URL, createTeamMutation, {
        trainerId: DEFAULT_TRAINER_ID,
        name: input.name,
        pokemonIds: input.pokemonIds,
        createdAt: new Date().toISOString(),
      })
      .pipe(map((data) => toTeam(data.createTeam)));
  }

  /**
   * Deletes a team. Fails with an {@link ApiError} if the id does not exist,
   * which the server reports by returning null.
   * @param id Server id of the team.
   */
  deleteTeam$(id: string): Observable<void> {
    return this.graphql
      .request$<{ removeTeam: { id: string } | null }>(
        MOCK_GRAPHQL_URL,
        removeTeamMutation,
        { id },
      )
      .pipe(
        map((data) => {
          if (!data.removeTeam) {
            throw new ApiError("graphql", `Team ${id} not found`);
          }
        }),
      );
  }
}

function toTeam(raw: ApiTeam): Team {
  return {
    id: raw.id,
    trainerId: raw.trainer_id,
    name: raw.name,
    pokemonIds: raw.pokemon_ids,
    createdAt: raw.created_at,
    trainerName: raw.Trainer?.name ?? null,
  };
}
