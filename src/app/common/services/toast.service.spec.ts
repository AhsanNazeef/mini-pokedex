import { TestBed } from "@angular/core/testing";
import { TOAST_DISMISS_MS, ToastService } from "./toast.service";

describe("ToastService", () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it("queues toasts oldest first with their tone", () => {
    service.error('Couldn\'t delete "Kanto Starters".');
    service.success("Team created.");

    expect(
      service.toasts().map((toast) => [toast.tone, toast.message]),
    ).toEqual([
      ["error", 'Couldn\'t delete "Kanto Starters".'],
      ["success", "Team created."],
    ]);
  });

  it("dismisses each toast on its own timer", () => {
    service.error("First");
    vi.advanceTimersByTime(TOAST_DISMISS_MS - 1000);
    service.error("Second");

    vi.advanceTimersByTime(1000);
    expect(service.toasts().map((toast) => toast.message)).toEqual(["Second"]);

    vi.advanceTimersByTime(TOAST_DISMISS_MS);
    expect(service.toasts()).toEqual([]);
  });

  it("dismisses a toast early by id", () => {
    service.error("Dismiss me");
    service.dismiss(service.toasts()[0].id);

    expect(service.toasts()).toEqual([]);
  });
});
