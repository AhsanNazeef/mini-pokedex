import { ComponentFixture, TestBed } from "@angular/core/testing";
import { CustomSelectComponent, SelectOption } from "./custom-select.component";

const OPTIONS: SelectOption[] = [
  { value: "", label: "All types" },
  { value: "fire", label: "Fire" },
  { value: "flying", label: "Flying" },
  { value: "water", label: "Water" },
];

describe("CustomSelectComponent", () => {
  let fixture: ComponentFixture<CustomSelectComponent>;
  let element: HTMLElement;
  let changes: string[];

  const trigger = () =>
    element.querySelector<HTMLButtonElement>(
      '[role="combobox"]',
    ) as HTMLButtonElement;
  const listbox = () => element.querySelector('[role="listbox"]');
  const options = () => [
    ...element.querySelectorAll<HTMLElement>('[role="option"]'),
  ];

  async function press(key: string): Promise<void> {
    trigger().dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true }),
    );
    await fixture.whenStable();
  }

  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn(); // not implemented by jsdom
    fixture = TestBed.createComponent(CustomSelectComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput("label", "Type");
    fixture.componentRef.setInput("inputId", "type-filter");
    fixture.componentRef.setInput("options", OPTIONS);
    fixture.componentRef.setInput("value", "");
    changes = [];
    fixture.componentInstance.valueChange.subscribe((value) =>
      changes.push(value),
    );
    await fixture.whenStable();
  });

  it("shows the selected label with the list closed", () => {
    expect(trigger().textContent).toContain("All types");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(listbox()).toBeNull();
  });

  it("opens on click with the selected option marked and highlighted", async () => {
    trigger().click();
    await fixture.whenStable();

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(options().length).toBe(4);
    expect(options()[0].getAttribute("aria-selected")).toBe("true");
    expect(trigger().getAttribute("aria-activedescendant")).toBe(
      options()[0].id,
    );
  });

  it("selects a clicked option, emits it and returns focus", async () => {
    trigger().click();
    await fixture.whenStable();
    options()[1].click();
    await fixture.whenStable();

    expect(changes).toEqual(["fire"]);
    expect(listbox()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("moves with arrow keys, selects with Enter and cancels with Escape", async () => {
    await press("ArrowDown");
    expect(listbox()).not.toBeNull();

    await press("ArrowDown");
    await press("ArrowDown");
    expect(trigger().getAttribute("aria-activedescendant")).toBe(
      options()[2].id,
    );
    await press("Enter");
    expect(changes).toEqual(["flying"]);
    expect(listbox()).toBeNull();

    await press("ArrowDown");
    await press("End");
    await press("Escape");
    expect(listbox()).toBeNull();
    expect(changes).toEqual(["flying"]);
  });

  it("jumps to options by their first letter, cycling on repeats", async () => {
    await press("f");
    expect(trigger().getAttribute("aria-activedescendant")).toBe(
      options()[1].id,
    );
    await press("f");
    expect(trigger().getAttribute("aria-activedescendant")).toBe(
      options()[2].id,
    );
    await press("w");
    await press("Enter");
    expect(changes).toEqual(["water"]);
  });

  it("closes without a change when clicking outside", async () => {
    trigger().click();
    await fixture.whenStable();
    document.body.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true }),
    );
    await fixture.whenStable();

    expect(listbox()).toBeNull();
    expect(changes).toEqual([]);
  });

  it("stays closed while disabled", async () => {
    fixture.componentRef.setInput("disabled", true);
    await fixture.whenStable();
    trigger().click();
    await press("ArrowDown");

    expect(listbox()).toBeNull();
  });
});
