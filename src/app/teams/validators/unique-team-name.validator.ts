import {
  AbstractControl,
  AsyncValidatorFn,
  ValidationErrors,
} from "@angular/forms";
import { Observable, catchError, map, of, switchMap, timer } from "rxjs";
import { TeamApiService } from "../services/team-api.service";
import { TeamStore } from "../state/team.store";

export const TEAM_NAME_CHECK_DEBOUNCE_MS = 300;

/**
 * Rejects a team name that is already in use, reporting `{ nameTaken: true }`.
 *
 * Angular cancels the previous run whenever the value changes, so the leading
 * timer debounces typing. The store is checked first because it also holds
 * optimistic teams the server has not stored yet. A failed lookup resolves as
 * valid: a background check should never block an otherwise correct form.
 *
 * @param store Team store, for cached and optimistic teams.
 * @param api Team API, for the authoritative server check.
 * @param exceptId Team id to ignore, when renaming an existing team.
 */
export function uniqueTeamNameValidator(
  store: TeamStore,
  api: TeamApiService,
  exceptId?: string,
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const name = String(control.value ?? "").trim();
    if (!name) return of(null);

    return timer(TEAM_NAME_CHECK_DEBOUNCE_MS).pipe(
      switchMap(() =>
        store.isNameTaken(name, exceptId)
          ? of(true)
          : api.isNameTaken$(name, exceptId),
      ),
      map((taken) => (taken ? { nameTaken: true } : null)),
      catchError(() => of(null)),
    );
  };
}
