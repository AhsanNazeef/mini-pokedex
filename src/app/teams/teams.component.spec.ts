import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Subject, of, throwError } from "rxjs";
import { ToastService } from "../common/services/toast.service";
import { ApiError } from "../core/graphql";
import { Pokemon } from "../pokedex/models/pokemon.model";
import { PokemonApiService } from "../pokedex/services/pokemon-api.service";
import { Team } from "./models/team.model";
import { TeamApiService } from "./services/team-api.service";
import { TeamsPage } from "./teams.component";

function makePokemon(id: number, name: string): Pokemon {
  return {
    id,
    name,
    height: 1,
    weight: 1,
    types: ["electric"],
    stats: {
      hp: 35,
      attack: 55,
      defense: 40,
      specialAttack: 50,
      specialDefense: 50,
      speed: 90,
    },
    total: 320,
    spriteUrl: null,
  };
}

const PIKACHU = makePokemon(25, "pikachu");
const KANTO: Team = {
  id: "1",
  trainerId: "1",
  name: "Kanto Starters",
  pokemonIds: [25],
  createdAt: "2024-01-15T10:00:00Z",
  trainerName: "Ash Ketchum",
};

describe("TeamsPage", () => {
  let fixture: ComponentFixture<TeamsPage>;
  let element: HTMLElement;
  const teamApi = {
    getTeams$: vi.fn(),
    createTeam$: vi.fn(),
    deleteTeam$: vi.fn(),
  };
  const pokemonApi = {
    getPokemon$: vi.fn(),
    getPokemonDetails$: vi.fn(),
  };

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(TeamsPage);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    teamApi.getTeams$.mockReset().mockReturnValue(of([KANTO]));
    teamApi.deleteTeam$.mockReset();
    pokemonApi.getPokemon$.mockReset().mockReturnValue(of([PIKACHU]));
    TestBed.configureTestingModule({
      providers: [
        { provide: TeamApiService, useValue: teamApi },
        { provide: PokemonApiService, useValue: pokemonApi },
      ],
    });
  });

  it("shows skeleton cards while teams load", async () => {
    teamApi.getTeams$.mockReturnValue(new Subject<Team[]>());
    await render();

    expect(element.querySelectorAll("app-skeleton").length).toBeGreaterThan(0);
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      "Loading teams",
    );
  });

  it("shows three placeholder cards before any count is known", async () => {
    localStorage.clear();
    teamApi.getTeams$.mockReturnValue(new Subject<Team[]>());
    await render();

    expect(element.querySelectorAll(".teams-page__skeleton-card").length).toBe(
      3,
    );
  });

  it("reuses the last known team count for the next visit's skeletons", async () => {
    // First visit loads five teams…
    const five = [1, 2, 3, 4, 5].map((n) => ({ ...KANTO, id: String(n) }));
    teamApi.getTeams$.mockReturnValue(of(five));
    await render();

    // …so a later visit shows five placeholders instead of guessing three.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: TeamApiService, useValue: teamApi },
        { provide: PokemonApiService, useValue: pokemonApi },
      ],
    });
    teamApi.getTeams$.mockReturnValue(new Subject<Team[]>());
    await render();

    expect(element.querySelectorAll(".teams-page__skeleton-card").length).toBe(
      5,
    );
  });

  it("keeps showing skeletons until the Pokédex cache arrives", async () => {
    // Teams come from the local mock server long before PokéAPI answers;
    // rendering then would flash bare ids and reflow once names land.
    const pokemon$ = new Subject<Pokemon[]>();
    pokemonApi.getPokemon$.mockReturnValue(pokemon$);
    await render();

    expect(element.querySelectorAll(".teams-page__skeleton-card").length).toBe(
      3,
    );
    expect(element.querySelectorAll("app-team-card").length).toBe(0);
    expect(element.textContent).not.toContain("#25");

    pokemon$.next([PIKACHU]);
    await fixture.whenStable();

    expect(element.querySelectorAll(".teams-page__skeleton-card").length).toBe(
      0,
    );
    expect(element.textContent).toContain("Pikachu");
  });

  it("lists teams with Pokémon resolved from the Pokédex cache", async () => {
    await render();

    expect(element.querySelectorAll("app-team-card").length).toBe(1);
    expect(element.textContent).toContain("Kanto Starters");
    expect(element.textContent).toContain("Ash Ketchum");
    expect(element.textContent).toContain("Pikachu");
  });

  it("invites the viewer to build a team when there are none", async () => {
    teamApi.getTeams$.mockReturnValue(of([]));
    await render();

    expect(element.textContent).toContain("No teams yet");
  });

  it("shows an error with a Retry that reloads", async () => {
    teamApi.getTeams$
      .mockReturnValueOnce(throwError(() => new ApiError("network", "offline")))
      .mockReturnValueOnce(of([KANTO]));
    await render();

    const alert = element.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Couldn't load your teams");
    alert?.querySelector("button")?.click();
    await fixture.whenStable();

    expect(teamApi.getTeams$).toHaveBeenCalledTimes(2);
    expect(element.textContent).toContain("Kanto Starters");
  });

  describe("active team", () => {
    const toggle = () =>
      element.querySelector<HTMLButtonElement>(".team-card__select");

    it("remembers the active team across visits", async () => {
      await render();
      expect(toggle()?.textContent?.trim()).toBe("Set active");

      toggle()?.click();
      await fixture.whenStable();
      expect(toggle()?.textContent?.trim()).toBe("Active");
      expect(toggle()?.getAttribute("aria-pressed")).toBe("true");

      // A fresh visit restores it from storage.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: TeamApiService, useValue: teamApi },
          { provide: PokemonApiService, useValue: pokemonApi },
        ],
      });
      await render();

      expect(toggle()?.textContent?.trim()).toBe("Active");
    });

    it("clears the selection when that team no longer exists", async () => {
      localStorage.setItem(
        "selectedTeamId",
        JSON.stringify({ value: "gone-team" }),
      );
      await render();

      expect(toggle()?.textContent?.trim()).toBe("Set active");
      expect(localStorage.getItem("selectedTeamId")).toBeNull();
    });

    it("unsets the active team when toggled again", async () => {
      await render();
      toggle()?.click();
      await fixture.whenStable();
      toggle()?.click();
      await fixture.whenStable();

      expect(toggle()?.textContent?.trim()).toBe("Set active");
      expect(localStorage.getItem("selectedTeamId")).toBeNull();
    });
  });

  it("removes a team on delete and restores it with a toast on failure", async () => {
    teamApi.deleteTeam$.mockReturnValue(
      throwError(() => new ApiError("network", "offline")),
    );
    await render();

    element
      .querySelector<HTMLButtonElement>(
        '[aria-label="Delete team Kanto Starters"]',
      )
      ?.click();
    await fixture.whenStable();

    // Rolled back, so the card is back and the failure was reported.
    expect(element.querySelectorAll("app-team-card").length).toBe(1);
    expect(TestBed.inject(ToastService).toasts()[0]?.message).toContain(
      "Couldn't delete",
    );
  });
});
