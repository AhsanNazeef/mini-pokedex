import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Pokemon } from "../../models/pokemon.model";
import { PokemonTableComponent } from "./pokemon-table.component";

function makePokemon(id: number, name: string, types: string[]): Pokemon {
  return {
    id,
    name,
    height: 1,
    weight: 1,
    types,
    stats: {
      hp: 45,
      attack: 49,
      defense: 49,
      specialAttack: 65,
      specialDefense: 65,
      speed: 45,
    },
    total: 318,
    spriteUrl: null,
  };
}

const BULBASAUR = makePokemon(1, "bulbasaur", ["grass", "poison"]);
const MR_MIME = makePokemon(122, "mr-mime", ["psychic", "fairy"]);

describe("PokemonTableComponent", () => {
  let fixture: ComponentFixture<PokemonTableComponent>;
  let element: HTMLElement;

  async function render(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(PokemonTableComponent);
    element = fixture.nativeElement as HTMLElement;
    await render({
      pokemon: [],
      status: "loading",
      sort: { key: "id", direction: "asc" },
      skeletonRowCount: 10,
    });
  });

  it("shows one skeleton row per page row while loading", () => {
    expect(element.querySelectorAll("tbody tr").length).toBe(10);
    expect(element.querySelectorAll("app-skeleton").length).toBeGreaterThan(0);
    expect(
      element.querySelector(".pokemon-table")?.getAttribute("aria-busy"),
    ).toBe("true");
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      "Loading Pokémon",
    );
  });

  it("shows the error with a working Retry", async () => {
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    await render({ status: "error", errorMessage: "Can't reach the server." });

    const alert = element.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Couldn't load the Pokédex");
    expect(alert?.textContent).toContain("Can't reach the server.");
    alert?.querySelector("button")?.click();
    expect(retry).toHaveBeenCalledOnce();
  });

  it("explains an empty search and offers to clear filters", async () => {
    const clearFilters = vi.fn();
    fixture.componentInstance.clearFilters.subscribe(clearFilters);
    await render({ status: "success", searchTerm: "zzz", typeFilter: "fire" });

    const status = element.querySelector('[role="status"]');
    expect(status?.textContent).toContain(
      'Nothing matches "zzz" among Fire-type Pokémon.',
    );
    status?.querySelector("button")?.click();
    expect(clearFilters).toHaveBeenCalledOnce();
  });

  it("renders a row per Pokémon with formatted name, number and types", async () => {
    await render({ status: "success", pokemon: [BULBASAUR, MR_MIME] });

    const rows = element.querySelectorAll("tbody tr");
    expect(rows.length).toBe(2);
    expect(rows[1].textContent).toContain("#0122");
    expect(rows[1].textContent).toContain("Mr Mime");
    expect(rows[1].querySelectorAll("app-type-badge").length).toBe(2);
  });

  it("emits rowSelect on click and on Enter", async () => {
    const rowSelect = vi.fn();
    fixture.componentInstance.rowSelect.subscribe(rowSelect);
    await render({ status: "success", pokemon: [BULBASAUR, MR_MIME] });

    const rows = element.querySelectorAll<HTMLElement>("tbody tr");
    rows[0].click();
    rows[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(rowSelect).toHaveBeenNthCalledWith(1, BULBASAUR);
    expect(rowSelect).toHaveBeenNthCalledWith(2, MR_MIME);
  });

  it("emits sortChange from a stat header and marks the sorted column", async () => {
    const sortChange = vi.fn();
    fixture.componentInstance.sortChange.subscribe(sortChange);
    await render({
      status: "success",
      pokemon: [BULBASAUR],
      sort: { key: "speed", direction: "desc" },
    });

    const speedHeader = [...element.querySelectorAll("th")].find((th) =>
      th.textContent?.includes("Speed"),
    );
    expect(speedHeader?.getAttribute("aria-sort")).toBe("descending");
    speedHeader?.querySelector("button")?.click();
    expect(sortChange).toHaveBeenCalledWith("speed");
  });
});
