import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ErrorStateComponent } from "./error-state.component";

describe("ErrorStateComponent", () => {
  let fixture: ComponentFixture<ErrorStateComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.componentRef.setInput("message", "Can't reach the server.");
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it("announces the message as an alert", () => {
    const alert = element.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Something went wrong");
    expect(alert?.textContent).toContain("Can't reach the server.");
  });

  it("emits retry when the Retry button is clicked", () => {
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);

    const button = element.querySelector("button");
    expect(button?.textContent?.trim()).toBe("Retry");
    button?.click();

    expect(retry).toHaveBeenCalledOnce();
  });

  it("hides the icon and title in compact mode", async () => {
    fixture.componentRef.setInput("compact", true);
    await fixture.whenStable();

    expect(element.querySelector(".error-state__title")).toBeNull();
    expect(element.textContent).toContain("Can't reach the server.");
    expect(element.querySelector("button")).not.toBeNull();
  });
});
