import { ComponentFixture, TestBed } from "@angular/core/testing";
import type { Mock } from "vitest";
import { CustomButtonComponent } from "./custom-button.component";

describe("CustomButtonComponent", () => {
  let fixture: ComponentFixture<CustomButtonComponent>;
  let clicked: Mock<() => void>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CustomButtonComponent);
    clicked = vi.fn<() => void>();
    fixture.componentInstance.clicked.subscribe(clicked);
  });

  async function click(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector("button")?.click();
  }

  it("emits clicked when enabled", async () => {
    await click({});
    expect(clicked).toHaveBeenCalledOnce();
  });

  it("does not emit while disabled or loading", async () => {
    await click({ disabled: true });
    await click({ disabled: false, isLoading: true });
    expect(clicked).not.toHaveBeenCalled();
  });
});
