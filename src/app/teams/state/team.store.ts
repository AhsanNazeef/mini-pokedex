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
  map,
  mergeMap,
  shareReplay,
  tap,
} from "rxjs";
import { LoadStatus } from "../../common/models/load-status.model";
import { ApiError } from "../../core/graphql";
import { TEMP_TEAM_ID_PREFIX } from "../constants/team.constants";
import { CreateTeamInput, Team } from "../models/team.model";
import { TeamApiService } from "../services/team-api.service";

export interface TeamState {
  status: LoadStatus;
  error: string | null;
  teams: readonly Team[];
  /** Ids with an in-flight mutation (optimistic rows and pending deletes). */
  pendingIds: ReadonlySet<string>;
}

export const INITIAL_TEAM_STATE: TeamState = {
  status: "idle",
  error: null,
  teams: [],
  pendingIds: new Set(),
};

@Injectable({ providedIn: "root" })
export class TeamStore {
  private readonly api = inject(TeamApiService);
  private readonly stateSubject = new BehaviorSubject<TeamState>(
    INITIAL_TEAM_STATE,
  );
  private readonly loadRequests$ = new Subject<void>();
  private readonly createRequests$ = new Subject<{
    tempId: string;
    input: CreateTeamInput;
  }>();
  private readonly deleteRequests$ = new Subject<Team>();
  private readonly mutationErrorsSubject = new Subject<string>();
  private tempIdCounter = 0;

  /** Every state change, starting with the current state. */
  readonly state$: Observable<TeamState> = this.stateSubject.asObservable();

  /**
   * One user-friendly message per failed mutation, after its optimistic
   * change has been rolled back. The UI shows these as toasts.
   */
  readonly mutationErrors$: Observable<string> =
    this.mutationErrorsSubject.asObservable();

  /** Teams newest-first; optimistic rows sort by their provisional time. */
  readonly teams$: Observable<Team[]> = this.state$.pipe(
    map((state) => state.teams),
    distinctUntilChanged(),
    map((teams) =>
      [...teams].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),
    shareReplay(1),
  );

  /** Load state of the team list, for the page's four UI states. */
  readonly status$ = this.select((state) => state.status);

  /** User-facing message for a failed load, or `null`. */
  readonly error$ = this.select((state) => state.error);

  /** Ids with a create or delete still in flight, so rows can show as busy. */
  readonly pendingIds$ = this.select((state) => state.pendingIds);

  constructor() {
    this.loadRequests$
      .pipe(
        exhaustMap(() => {
          this.patch({ status: "loading", error: null });
          return this.api.getTeams$().pipe(
            tap((teams) =>
              this.patch({ status: "success", error: null, teams }),
            ),
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

    // Mutations run concurrently; each one resolves or rolls back on its own.
    this.createRequests$
      .pipe(
        mergeMap(({ tempId, input }) =>
          this.api.createTeam$(input).pipe(
            tap((team) => this.confirmCreate(tempId, team)),
            catchError((error: unknown) => {
              this.rollbackCreate(tempId, input.name, error);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.deleteRequests$
      .pipe(
        mergeMap((team) =>
          this.api.deleteTeam$(team.id).pipe(
            tap(() => this.confirmDelete(team.id)),
            catchError((error: unknown) => {
              this.rollbackDelete(team, error);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** The current state, for one-off reads. */
  get snapshot(): TeamState {
    return this.stateSubject.value;
  }

  /**
   * Streams one slice of state, emitting only when that slice changes.
   * @param projector Picks the slice from the state.
   */
  select<T>(projector: (state: TeamState) => T): Observable<T> {
    return this.state$.pipe(map(projector), distinctUntilChanged());
  }

  /**
   * Loads all teams into the store. Does nothing while a load is in flight
   * or after one succeeded; call again after an error to retry.
   */
  loadTeams(): void {
    const { status } = this.snapshot;
    if (status === "loading" || status === "success") return;
    this.loadRequests$.next();
  }

  /**
   * Creates a team optimistically: it appears in the list at once and is
   * swapped for the server's copy on success. On failure it is removed and
   * a message is emitted on {@link mutationErrors$}.
   * @param input Team name and the chosen Pokémon's National Pokédex numbers.
   * @returns The optimistic row's provisional id.
   */
  createTeam(input: CreateTeamInput): string {
    const tempId = `${TEMP_TEAM_ID_PREFIX}${++this.tempIdCounter}`;
    const optimistic: Team = {
      id: tempId,
      trainerId: "",
      name: input.name,
      pokemonIds: [...input.pokemonIds],
      createdAt: new Date().toISOString(),
      trainerName: null,
    };
    this.patch({
      teams: [...this.snapshot.teams, optimistic],
      pendingIds: withId(this.snapshot.pendingIds, tempId),
    });
    this.createRequests$.next({ tempId, input });
    return tempId;
  }

  /**
   * Deletes a team optimistically: it disappears at once and is restored
   * with a {@link mutationErrors$} message if the server call fails.
   * Ignored while another mutation for the same team is in flight.
   * @param id Id of the team to delete.
   */
  deleteTeam(id: string): void {
    const { teams, pendingIds } = this.snapshot;
    const team = teams.find((entry) => entry.id === id);
    if (!team || pendingIds.has(id)) return;
    this.patch({
      teams: teams.filter((entry) => entry.id !== id),
      pendingIds: withId(pendingIds, id),
    });
    this.deleteRequests$.next(team);
  }

  /**
   * Whether a team name is already taken, ignoring case and outer spaces.
   * @param name Candidate name.
   * @param exceptId Team id to skip, when renaming an existing team.
   */
  isNameTaken(name: string, exceptId?: string): boolean {
    const needle = name.trim().toLowerCase();
    return this.snapshot.teams.some(
      (team) => team.id !== exceptId && team.name.toLowerCase() === needle,
    );
  }

  private confirmCreate(tempId: string, team: Team): void {
    this.patch({
      teams: this.snapshot.teams.map((entry) =>
        entry.id === tempId ? team : entry,
      ),
      pendingIds: withoutId(this.snapshot.pendingIds, tempId),
    });
  }

  private rollbackCreate(tempId: string, name: string, error: unknown): void {
    this.patch({
      teams: this.snapshot.teams.filter((entry) => entry.id !== tempId),
      pendingIds: withoutId(this.snapshot.pendingIds, tempId),
    });
    this.mutationErrorsSubject.next(
      `Couldn't create "${name}". ${ApiError.from(error).userMessage}`,
    );
  }

  private confirmDelete(id: string): void {
    this.patch({ pendingIds: withoutId(this.snapshot.pendingIds, id) });
  }

  private rollbackDelete(team: Team, error: unknown): void {
    this.patch({
      teams: [...this.snapshot.teams, team],
      pendingIds: withoutId(this.snapshot.pendingIds, team.id),
    });
    this.mutationErrorsSubject.next(
      `Couldn't delete "${team.name}". ${ApiError.from(error).userMessage}`,
    );
  }

  private patch(partial: Partial<TeamState>): void {
    this.stateSubject.next({ ...this.snapshot, ...partial });
  }
}

function withId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids);
  next.add(id);
  return next;
}

function withoutId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}
