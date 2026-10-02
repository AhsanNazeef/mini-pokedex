import { Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Subject, of, throwError } from "rxjs";
import { ApiError } from "../../../core/graphql";
import {
  Pokemon,
  PokemonDetails,
  PokemonStats,
} from "../../models/pokemon.model";
import { PokemonApiService } from "../../services/pokemon-api.service";
import { PokemonStore } from "../../state/pokemon.store";
import { StatRadarChartComponent } from "../stat-radar-chart/stat-radar-chart.component";
import { PokemonDetailPanelComponent } from "./pokemon-detail-panel.component";

// ECharts needs a real canvas, which jsdom does not provide.
@Component({ selector: "app-stat-radar-chart", standalone: true, template: "" })
class StatRadarChartStubComponent {
  readonly stats = input<PokemonStats>();
  readonly color = input("");
  readonly name = input("");
  readonly label = input("");
}

const CHARMANDER: Pokemon = {
  id: 4,
  name: "charmander",
  height: 6,
  weight: 85,
  types: ["fire"],
  stats: {
    hp: 39,
    attack: 52,
    defense: 43,
    specialAttack: 60,
    specialDefense: 50,
    speed: 65,
  },
  total: 309,
  spriteUrl: null,
};

const DETAILS: PokemonDetails = {
  ...CHARMANDER,
  abilities: [
    { name: "blaze", shortEffect: "Powers up fire moves.", isHidden: false },
    {
      name: "solar-power",
      shortEffect: "Boosts Sp. Atk in sun.",
      isHidden: true,
    },
  ],
};

describe("PokemonDetailPanelComponent", () => {
  let fixture: ComponentFixture<PokemonDetailPanelComponent>;
  let element: HTMLElement;
  const api = { getPokemon$: vi.fn(), getPokemonDetails$: vi.fn() };

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(PokemonDetailPanelComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput("pokemonId", 4);
    fixture.componentRef.setInput("open", true);
    await fixture.whenStable();
  }

  beforeEach(() => {
    api.getPokemon$.mockReset().mockReturnValue(of([CHARMANDER]));
    api.getPokemonDetails$.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: PokemonApiService, useValue: api }],
    });
    TestBed.overrideComponent(PokemonDetailPanelComponent, {
      remove: { imports: [StatRadarChartComponent] },
      add: { imports: [StatRadarChartStubComponent] },
    });
    TestBed.inject(PokemonStore).loadPokemon();
  });

  it("shows cached info at once while abilities load", async () => {
    api.getPokemonDetails$.mockReturnValue(new Subject<PokemonDetails>());
    await render();

    expect(
      element.querySelector("#pokemon-detail-title")?.textContent,
    ).toContain("Charmander");
    expect(element.textContent).toContain("#0004");
    expect(element.textContent).toContain("8.5 kg");
    expect(element.querySelector(".panel__stats")?.textContent).toContain(
      "Sp.Atk",
    );
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      "Loading abilities",
    );
  });

  it("lists abilities once details arrive, marking hidden ones", async () => {
    const details$ = new Subject<PokemonDetails>();
    api.getPokemonDetails$.mockReturnValue(details$);
    await render();

    details$.next(DETAILS);
    await fixture.whenStable();

    const names = [...element.querySelectorAll(".panel__ability-name")].map(
      (name) => name.textContent?.trim(),
    );
    expect(names).toEqual(["Blaze", "Solar Power"]);
    expect(element.querySelectorAll(".panel__hidden-tag").length).toBe(1);
  });

  it("shows an error with a Retry that refetches", async () => {
    api.getPokemonDetails$
      .mockReturnValueOnce(throwError(() => new ApiError("network", "offline")))
      .mockReturnValueOnce(of(DETAILS));
    await render();

    const alert = element.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Can't reach the server");
    alert?.querySelector("button")?.click();
    await fixture.whenStable();

    expect(api.getPokemonDetails$).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelectorAll(".panel__ability").length).toBe(2);
  });

  it("explains when no abilities are recorded", async () => {
    api.getPokemonDetails$.mockReturnValue(of({ ...DETAILS, abilities: [] }));
    await render();

    expect(element.textContent).toContain("No abilities recorded");
  });

  it("moves focus to Back when opened", async () => {
    api.getPokemonDetails$.mockReturnValue(of(DETAILS));
    await render();

    expect(document.activeElement?.getAttribute("aria-label")).toBe("Back");
  });

  it("closes from Back or Escape, and ignores Escape while closed", async () => {
    api.getPokemonDetails$.mockReturnValue(of(DETAILS));
    await render();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    element.querySelector<HTMLButtonElement>('[aria-label="Back"]')?.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(closed).toHaveBeenCalledTimes(2);

    fixture.componentRef.setInput("open", false);
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(closed).toHaveBeenCalledTimes(2);
  });
});
