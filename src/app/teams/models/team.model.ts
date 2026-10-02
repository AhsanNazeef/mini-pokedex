export interface Team {
  id: string;
  trainerId: string;
  name: string;
  pokemonIds: number[];
  createdAt: string; // ISO 8601 timestamp
  trainerName: string | null;
}

export interface CreateTeamInput {
  name: string;
  pokemonIds: number[];
}
