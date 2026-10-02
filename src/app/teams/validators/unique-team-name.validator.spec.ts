import { FormControl } from "@angular/forms";
import { Observable, of, throwError } from "rxjs";
import { ApiError } from "../../core/graphql";
import { TeamApiService } from "../services/team-api.service";
import { TeamStore } from "../state/team.store";
import {
  TEAM_NAME_CHECK_DEBOUNCE_MS,
  uniqueTeamNameValidator,
} from "./unique-team-name.validator";

describe("uniqueTeamNameValidator", () => {
  const store = { isNameTaken: vi.fn() };
  const api = { isNameTaken$: vi.fn() };

  function validate(value: string, exceptId?: string) {
    const validator = uniqueTeamNameValidator(
      store as unknown as TeamStore,
      api as unknown as TeamApiService,
      exceptId,
    );
    const result = validator(new FormControl(value)) as Observable<unknown>;
    let emitted: unknown = "pending";
    result.subscribe((value) => (emitted = value));
    return () => emitted;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    store.isNameTaken.mockReset().mockReturnValue(false);
    api.isNameTaken$.mockReset().mockReturnValue(of(false));
  });

  afterEach(() => vi.useRealTimers());

  it("accepts a name no one is using", () => {
    const result = validate("Hoenn Heroes");

    vi.advanceTimersByTime(TEAM_NAME_CHECK_DEBOUNCE_MS);

    expect(result()).toBeNull();
    expect(api.isNameTaken$).toHaveBeenCalledWith("Hoenn Heroes", undefined);
  });

  it("rejects a name the server already has", () => {
    api.isNameTaken$.mockReturnValue(of(true));
    const result = validate("Kanto Starters");

    vi.advanceTimersByTime(TEAM_NAME_CHECK_DEBOUNCE_MS);

    expect(result()).toEqual({ nameTaken: true });
  });

  it("waits for the debounce before asking the server", () => {
    validate("Hoenn Heroes");

    vi.advanceTimersByTime(TEAM_NAME_CHECK_DEBOUNCE_MS - 1);
    expect(api.isNameTaken$).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(api.isNameTaken$).toHaveBeenCalledOnce();
  });

  it("rejects a name held only by an optimistic team, without a request", () => {
    store.isNameTaken.mockReturnValue(true);
    const result = validate("Pending Squad");

    vi.advanceTimersByTime(TEAM_NAME_CHECK_DEBOUNCE_MS);

    expect(result()).toEqual({ nameTaken: true });
    expect(api.isNameTaken$).not.toHaveBeenCalled();
  });

  it("accepts an empty value and leaves that to the required validator", () => {
    const blank = validate("");
    const spaces = validate("   ");

    vi.advanceTimersByTime(TEAM_NAME_CHECK_DEBOUNCE_MS);

    expect(blank()).toBeNull();
    expect(spaces()).toBeNull();
    expect(api.isNameTaken$).not.toHaveBeenCalled();
  });

  it("checks the trimmed name and skips the team being renamed", () => {
    validate("  Johto Squad  ", "2");

    vi.advanceTimersByTime(TEAM_NAME_CHECK_DEBOUNCE_MS);

    expect(store.isNameTaken).toHaveBeenCalledWith("Johto Squad", "2");
    expect(api.isNameTaken$).toHaveBeenCalledWith("Johto Squad", "2");
  });

  it("treats a failed lookup as valid so the form is never stuck", () => {
    api.isNameTaken$.mockReturnValue(
      throwError(() => new ApiError("network", "offline")),
    );
    const result = validate("Hoenn Heroes");

    vi.advanceTimersByTime(TEAM_NAME_CHECK_DEBOUNCE_MS);

    expect(result()).toBeNull();
  });
});
