import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of } from "rxjs";
import { Pokemon } from "../../../pokedex/models/pokemon.model";
import { PokemonApiService } from "../../../pokedex/services/pokemon-api.service";
import { PokemonStore } from "../../../pokedex/state/pokemon.store";
import { CreateTeamInput } from "../../models/team.model";
import { TeamApiService } from "../../services/team-api.service";
import { TEAM_NAME_CHECK_DEBOUNCE_MS } from "../../validators/unique-team-name.validator";
import { TeamBuilderFormComponent } from "./team-builder-form.component";

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

const PIKACHU = makePokemon(25, "pikachu");
const EEVEE = makePokemon(133, "eevee");

describe("TeamBuilderFormComponent", () => {
  let fixture: ComponentFixture<TeamBuilderFormComponent>;
  let element: HTMLElement;
  const teamApi = {
    getTeams$: vi.fn(),
    createTeam$: vi.fn(),
    deleteTeam$: vi.fn(),
    isNameTaken$: vi.fn(),
  };
  const pokemonApi = { getPokemon$: vi.fn(), getPokemonDetails$: vi.fn() };

  const nameInput = () =>
    element.querySelector<HTMLInputElement>("#team-name") as HTMLInputElement;
  const errors = () =>
    [...element.querySelectorAll(".team-form__error")].map((e) =>
      e.textContent?.trim(),
    );
  const submitButton = () =>
    [...element.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Create team",
    ) as HTMLButtonElement;

  // Real timers: Angular's zoneless scheduler relies on them, so the async
  // validator's debounce is waited out for real.
  const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

  async function typeName(value: string): Promise<void> {
    const input = nameInput();
    input.value = value;
    input.dispatchEvent(new Event("input"));
    await settle(TEAM_NAME_CHECK_DEBOUNCE_MS + 60);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    teamApi.getTeams$.mockReset().mockReturnValue(of([]));
    teamApi.isNameTaken$.mockReset().mockReturnValue(of(false));
    pokemonApi.getPokemon$.mockReset().mockReturnValue(of([PIKACHU, EEVEE]));
    TestBed.configureTestingModule({
      providers: [
        { provide: TeamApiService, useValue: teamApi },
        { provide: PokemonApiService, useValue: pokemonApi },
      ],
    });
    TestBed.inject(PokemonStore).loadPokemon();
    fixture = TestBed.createComponent(TeamBuilderFormComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it("shows no errors on a pristine form", () => {
    expect(errors()).toEqual([]);
  });

  it("reports a name that is too short, then clears it", async () => {
    await typeName("ab");
    expect(errors()).toContain("Use at least 3 characters.");

    await typeName("Hoenn Heroes");
    expect(errors()).toEqual([]);
  });

  it("reports a duplicate name from the async check", async () => {
    const created: CreateTeamInput[] = [];
    fixture.componentInstance.created.subscribe((input) => created.push(input));
    teamApi.isNameTaken$.mockReturnValue(of(true));

    await typeName("Kanto Starters");
    fixture.componentInstance.onSelectionChange([25]);
    await fixture.whenStable();
    submitButton().click();
    await fixture.whenStable();

    expect(errors()).toContain("You already have a team with that name.");
    expect(created).toEqual([]);
  });

  it("requires at least one Pokémon before it will submit", async () => {
    const created: CreateTeamInput[] = [];
    fixture.componentInstance.created.subscribe((input) => created.push(input));

    await typeName("Hoenn Heroes");
    submitButton().click();
    await fixture.whenStable();
    expect(created).toEqual([]);
    expect(errors()).toContain("Pick between 1 and 6 Pokémon.");

    fixture.componentInstance.onSelectionChange([25]);
    await fixture.whenStable();
    submitButton().click();
    await fixture.whenStable();

    expect(created.length).toBe(1);
  });

  it("surfaces every problem when an incomplete form is submitted", async () => {
    submitButton().click();
    await fixture.whenStable();

    expect(errors()).toEqual([
      "Enter a team name.",
      "Pick between 1 and 6 Pokémon.",
    ]);
    // Focus lands on the first field that needs attention.
    await settle(50);
    expect(document.activeElement?.id).toBe("team-name");
  });

  it("emits the trimmed name with its Pokémon, then resets", async () => {
    const created: CreateTeamInput[] = [];
    fixture.componentInstance.created.subscribe((input) => created.push(input));

    await typeName("  Hoenn Heroes  ");
    fixture.componentInstance.onSelectionChange([25, 133]);
    await fixture.whenStable();
    submitButton().click();
    await fixture.whenStable();

    expect(created).toEqual([{ name: "Hoenn Heroes", pokemonIds: [25, 133] }]);
    expect(nameInput().value).toBe("");
    expect(errors()).toEqual([]);
  });
});
