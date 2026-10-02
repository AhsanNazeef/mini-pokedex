import { TestBed } from "@angular/core/testing";
import { Subject, of, throwError } from "rxjs";
import { ApiError } from "../../core/graphql";
import { Team } from "../models/team.model";
import { TeamApiService } from "../services/team-api.service";
import { TeamStore } from "./team.store";

function makeTeam(id: string, name: string, createdAt: string): Team {
  return {
    id,
    trainerId: "1",
    name,
    pokemonIds: [25, 6],
    createdAt,
    trainerName: "Ash Ketchum",
  };
}

const KANTO = makeTeam("1", "Kanto Starters", "2024-01-15T10:00:00Z");
const JOHTO = makeTeam("2", "Johto Squad", "2024-03-20T14:30:00Z");
const NETWORK_ERROR = new ApiError("network", "offline");

describe("TeamStore", () => {
  let store: TeamStore;
  let mutationErrors: string[];
  const api = {
    getTeams$: vi.fn(),
    createTeam$: vi.fn(),
    deleteTeam$: vi.fn(),
  };

  const names = () => store.snapshot.teams.map((team) => team.name);

  beforeEach(() => {
    api.getTeams$.mockReset().mockReturnValue(of([KANTO, JOHTO]));
    api.createTeam$.mockReset();
    api.deleteTeam$.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: TeamApiService, useValue: api }],
    });
    store = TestBed.inject(TeamStore);
    mutationErrors = [];
    store.mutationErrors$.subscribe((message) => mutationErrors.push(message));
    store.loadTeams();
  });

  describe("loadTeams", () => {
    it("caches teams and does not fetch again after success", () => {
      store.loadTeams();

      expect(api.getTeams$).toHaveBeenCalledOnce();
      expect(store.snapshot.status).toBe("success");
      expect(names()).toEqual(["Kanto Starters", "Johto Squad"]);
    });

    it("exposes a friendly error and recovers on retry", () => {
      api.getTeams$.mockReturnValueOnce(throwError(() => NETWORK_ERROR));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: TeamApiService, useValue: api }],
      });
      store = TestBed.inject(TeamStore);

      store.loadTeams();
      expect(store.snapshot.status).toBe("error");
      expect(store.snapshot.error).toBe(NETWORK_ERROR.userMessage);

      store.loadTeams();
      expect(store.snapshot.status).toBe("success");
    });
  });

  describe("createTeam (optimistic)", () => {
    it("shows the team immediately and swaps in the server copy on success", () => {
      const response$ = new Subject<Team>();
      api.createTeam$.mockReturnValue(response$);

      const tempId = store.createTeam({ name: "New Squad", pokemonIds: [1] });

      expect(names()).toContain("New Squad");
      expect(store.snapshot.pendingIds.has(tempId)).toBe(true);

      const serverTeam = makeTeam("9", "New Squad", "2024-06-01T09:00:00Z");
      response$.next(serverTeam);
      response$.complete();

      expect(names()).toContain("New Squad");
      expect(store.snapshot.teams.find((t) => t.name === "New Squad")?.id).toBe(
        "9",
      );
      expect(store.snapshot.pendingIds.size).toBe(0);
      expect(mutationErrors).toEqual([]);
    });

    it("rolls back the optimistic team and reports when the mutation fails", () => {
      const response$ = new Subject<Team>();
      api.createTeam$.mockReturnValue(response$);

      store.createTeam({ name: "Doomed Squad", pokemonIds: [1, 4] });
      expect(names()).toContain("Doomed Squad");

      response$.error(NETWORK_ERROR);

      expect(names()).toEqual(["Kanto Starters", "Johto Squad"]);
      expect(store.snapshot.pendingIds.size).toBe(0);
      expect(mutationErrors).toEqual([
        `Couldn't create "Doomed Squad". ${NETWORK_ERROR.userMessage}`,
      ]);
    });
  });

  describe("deleteTeam (optimistic)", () => {
    it("removes the team immediately and confirms silently on success", () => {
      api.deleteTeam$.mockReturnValue(of(undefined));

      store.deleteTeam("1");

      expect(names()).toEqual(["Johto Squad"]);
      expect(store.snapshot.pendingIds.size).toBe(0);
      expect(mutationErrors).toEqual([]);
    });

    it("restores the team and reports when the mutation fails", () => {
      api.deleteTeam$.mockReturnValue(throwError(() => NETWORK_ERROR));

      store.deleteTeam("1");

      expect(names()).toContain("Kanto Starters");
      expect(mutationErrors).toEqual([
        `Couldn't delete "Kanto Starters". ${NETWORK_ERROR.userMessage}`,
      ]);
    });

    it("ignores a second delete while one is in flight for the same team", () => {
      api.deleteTeam$.mockReturnValue(new Subject());

      store.deleteTeam("1");
      store.deleteTeam("1");

      expect(api.deleteTeam$).toHaveBeenCalledOnce();
    });
  });

  describe("teams$ and isNameTaken", () => {
    it("sorts teams newest first, including optimistic rows", () => {
      api.createTeam$.mockReturnValue(new Subject());
      let latest: Team[] = [];
      store.teams$.subscribe((teams) => (latest = teams));

      store.createTeam({ name: "Fresh Team", pokemonIds: [7] });

      expect(latest.map((team) => team.name)).toEqual([
        "Fresh Team",
        "Johto Squad",
        "Kanto Starters",
      ]);
    });

    it("matches names ignoring case and outer spaces", () => {
      expect(store.isNameTaken("  kanto starters ")).toBe(true);
      expect(store.isNameTaken("Kanto Starters", "1")).toBe(false);
      expect(store.isNameTaken("Sinnoh Six")).toBe(false);
    });
  });
});
