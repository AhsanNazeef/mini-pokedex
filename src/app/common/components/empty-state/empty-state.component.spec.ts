import { TestBed } from "@angular/core/testing";
import { EmptyStateComponent } from "./empty-state.component";

describe("EmptyStateComponent", () => {
  it("shows the title and message as a status", async () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput("title", "No Pokémon found");
    fixture.componentRef.setInput("message", 'Nothing matches "xyz".');
    await fixture.whenStable();

    const status = (fixture.nativeElement as HTMLElement).querySelector(
      '[role="status"]',
    );
    expect(status?.textContent).toContain("No Pokémon found");
    expect(status?.textContent).toContain('Nothing matches "xyz".');
  });
});
