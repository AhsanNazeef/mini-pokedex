import { ComponentFixture, TestBed } from "@angular/core/testing";
import { PaginationComponent } from "./pagination.component";

describe("PaginationComponent", () => {
  let fixture: ComponentFixture<PaginationComponent>;
  let element: HTMLElement;

  async function render(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  const button = (label: string) =>
    element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn(); // not implemented by jsdom
    fixture = TestBed.createComponent(PaginationComponent);
    element = fixture.nativeElement as HTMLElement;
    await render({
      pageIndex: 0,
      pageCount: 103,
      pageSize: 10,
      totalItems: 1025,
      pageSizeOptions: [10, 25, 50],
    });
  });

  it("shows the visible range and page position", () => {
    expect(element.textContent).toContain("1–10 of 1025");
    expect(element.textContent).toContain("Page 1 of 103");
  });

  it("disables Prev on the first page and Next on the last", async () => {
    expect(button("Previous page")?.disabled).toBe(true);
    expect(button("Next page")?.disabled).toBe(false);

    await render({ pageIndex: 102 });
    expect(element.textContent).toContain("1021–1025 of 1025");
    expect(button("Next page")?.disabled).toBe(true);
  });

  it("emits the next page index and new page size", async () => {
    const pageChange = vi.fn();
    const pageSizeChange = vi.fn();
    fixture.componentInstance.pageChange.subscribe(pageChange);
    fixture.componentInstance.pageSizeChange.subscribe(pageSizeChange);

    button("Next page")?.click();
    element.querySelector<HTMLButtonElement>("#page-size")?.click();
    await fixture.whenStable();
    [...element.querySelectorAll<HTMLElement>('[role="option"]')]
      .find((option) => option.textContent?.trim() === "25")
      ?.click();

    expect(pageChange).toHaveBeenCalledWith(1);
    expect(pageSizeChange).toHaveBeenCalledWith(25);
  });

  it("shows skeleton placeholders and disables controls while loading", async () => {
    await render({ loading: true });

    expect(element.querySelectorAll("app-skeleton").length).toBe(2);
    expect(element.textContent).not.toContain("of 1025");
    expect(element.textContent).not.toContain("Page 1");
    expect(button("Previous page")?.disabled).toBe(true);
    expect(button("Next page")?.disabled).toBe(true);
  });

  it("says there are no results and drops the page controls", async () => {
    await render({ totalItems: 0, pageCount: 1 });

    expect(element.textContent).toContain("No results");
    expect(button("Previous page")).toBeNull();
    expect(button("Next page")).toBeNull();
  });
});
