import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { EmptyStateComponent } from "../common/components/empty-state/empty-state.component";
import { ErrorStateComponent } from "../common/components/error-state/error-state.component";
import { HeaderComponent } from "../common/components/header/header.component";
import { SkeletonComponent } from "../common/components/skeleton/skeleton.component";
import {
  CacheService,
  TEAM_COUNT_CACHE_KEY,
} from "../common/services/cache.service";
import { ToastService } from "../common/services/toast.service";
import { LoadStatus } from "../common/models/load-status.model";
import { PokemonSelectors } from "../pokedex/state/pokemon.selectors";
import { PokemonStore } from "../pokedex/state/pokemon.store";
import {
  TeamCardComponent,
  TeamMember,
} from "./components/team-card/team-card.component";
import {
  DEFAULT_SKELETON_TEAM_CARDS,
  MAX_SKELETON_TEAM_CARDS,
} from "./constants/team.constants";
import { Team } from "./models/team.model";
import { TeamStore } from "./state/team.store";

interface TeamView {
  team: Team;
  members: TeamMember[];
  pending: boolean;
}

@Component({
  selector: "app-teams-page",
  standalone: true,
  imports: [
    EmptyStateComponent,
    ErrorStateComponent,
    HeaderComponent,
    SkeletonComponent,
    TeamCardComponent,
  ],
  templateUrl: "./teams.component.html",
  styleUrl: "./teams.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamsPage implements OnInit {
  private readonly teamStore = inject(TeamStore);
  private readonly pokemonStore = inject(PokemonStore);
  private readonly pokemonSelectors = inject(PokemonSelectors);
  private readonly toastService = inject(ToastService);
  private readonly cache = inject(CacheService);

  private readonly teamStatus = toSignal(this.teamStore.status$, {
    requireSync: true,
  });
  private readonly pokemonStatus = toSignal(this.pokemonSelectors.status$, {
    requireSync: true,
  });
  readonly errorMessage = toSignal(this.teamStore.error$, {
    requireSync: true,
  });
  // Placeholder count from the last successful load, so a reload shows the
  // right number of cards rather than a guess.
  readonly skeletonCards = Array.from(
    { length: this.rememberedTeamCount() },
    (_, index) => index,
  );
  readonly skeletonSlots = [1, 2, 3, 4, 5, 6];
  readonly skeletonBadges = [1, 2, 3, 4, 5, 6, 7];

  /**
   * Cards need teams *and* the Pokédex cache, so the page keeps showing
   * skeletons until both arrive — otherwise rows would flash bare ids and
   * then reflow. A failed Pokédex load still renders the teams, with ids.
   */
  readonly status = computed<LoadStatus>(() => {
    const teams = this.teamStatus();
    if (teams === "error" || teams === "idle" || teams === "loading") {
      return teams;
    }
    const pokemon = this.pokemonStatus();
    return pokemon === "idle" || pokemon === "loading" ? "loading" : "success";
  });

  private readonly teams = toSignal(this.teamStore.teams$, {
    requireSync: true,
  });
  private readonly pendingIds = toSignal(this.teamStore.pendingIds$, {
    requireSync: true,
  });
  // Sprites and names come from the Pokédex cache, so no extra requests.
  private readonly pokemonById = toSignal(this.pokemonSelectors.entities$, {
    requireSync: true,
  });

  readonly teamViews = computed<TeamView[]>(() => {
    const entities = this.pokemonById();
    const pending = this.pendingIds();
    return this.teams().map((team) => ({
      team,
      members: team.pokemonIds.map((id) => ({
        id,
        pokemon: entities[id] ?? null,
      })),
      pending: pending.has(team.id),
    }));
  });

  constructor() {
    // A rolled-back create or delete surfaces as a toast.
    this.teamStore.mutationErrors$
      .pipe(takeUntilDestroyed())
      .subscribe((message) => this.toastService.error(message));

    // Remember how many teams exist so the next visit's skeleton matches.
    effect(() => {
      if (this.teamStatus() !== "success") return;
      this.cache.set(TEAM_COUNT_CACHE_KEY, this.teams().length);
    });
  }

  ngOnInit(): void {
    this.teamStore.loadTeams();
    // Both stores cache, so revisiting the page costs nothing.
    this.pokemonStore.loadPokemon();
  }

  private rememberedTeamCount(): number {
    const remembered = this.cache.get<number>(TEAM_COUNT_CACHE_KEY);
    if (typeof remembered !== "number" || remembered < 1) {
      return DEFAULT_SKELETON_TEAM_CARDS;
    }
    return Math.min(remembered, MAX_SKELETON_TEAM_CARDS);
  }

  onRetry(): void {
    this.teamStore.loadTeams();
  }

  onDeleteTeam(id: string): void {
    this.teamStore.deleteTeam(id);
  }
}
