import { Component, input } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { of, throwError } from "rxjs";
import { ApiError } from "../core/graphql";
import { PokemonDetailPanelComponent } from "./components/pokemon-detail-panel/pokemon-detail-panel.component";
import { StatRadarChartComponent } from "./components/stat-radar-chart/stat-radar-chart.component";
import { Pokemon, PokemonStats } from "./models/pokemon.model";
import { PokedexPage } from "./pokedex.component";
import { PokemonApiService } from "./services/pokemon-api.service";

// ECharts needs a real canvas, which jsdom does not provide.
@Component({ selector: "app-stat-radar-chart", standalone: true, template: "" })
class StatRadarChartStubComponent {
  readonly stats = input<PokemonStats>();
  readonly color = input("");
  readonly name = input("");
  readonly label = input("");
}

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

describe("PokedexPage", () => {
  const api = { getPokemon$: vi.fn(), getPokemonDetails$: vi.fn() };

  beforeEach(() => {
    api.getPokemon$.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: PokemonApiService, useValue: api }],
    });
    TestBed.overrideComponent(PokemonDetailPanelComponent, {
      remove: { imports: [StatRadarChartComponent] },
      add: { imports: [StatRadarChartStubComponent] },
    });
  });

  it("loads the Pokédex on init and renders the first page", async () => {
    api.getPokemon$.mockReturnValue(
      of([makePokemon(1, "bulbasaur"), makePokemon(4, "charmander")]),
    );
    const fixture = TestBed.createComponent(PokedexPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(api.getPokemon$).toHaveBeenCalledOnce();
    expect(element.querySelectorAll("tbody tr").length).toBe(2);
    expect(element.textContent).toContain("1–2 of 2");
  });

  it("shows the error state and reloads on Retry", async () => {
    api.getPokemon$
      .mockReturnValueOnce(throwError(() => new ApiError("network", "offline")))
      .mockReturnValueOnce(of([makePokemon(1, "bulbasaur")]));
    const fixture = TestBed.createComponent(PokedexPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    await fixture.whenStable();

    expect(api.getPokemon$).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelectorAll("tbody tr").length).toBe(1);
  });

  it("opens the detail panel on row click and makes the page inert until closed", async () => {
    api.getPokemon$.mockReturnValue(of([makePokemon(4, "charmander")]));
    api.getPokemonDetails$.mockReturnValue(
      of({ ...makePokemon(4, "charmander"), abilities: [] }),
    );
    const fixture = TestBed.createComponent(PokedexPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLElement>("tbody tr")?.click();
    await fixture.whenStable();

    expect(element.querySelector(".panel--open")).not.toBeNull();
    expect(
      element.querySelector("#pokemon-detail-title")?.textContent,
    ).toContain("Charmander");
    expect(element.querySelector("main")?.hasAttribute("inert")).toBe(true);

    element.querySelector<HTMLButtonElement>('[aria-label="Back"]')?.click();
    await fixture.whenStable();

    expect(element.querySelector(".panel--open")).toBeNull();
    expect(element.querySelector("main")?.hasAttribute("inert")).toBe(false);
  });
});
