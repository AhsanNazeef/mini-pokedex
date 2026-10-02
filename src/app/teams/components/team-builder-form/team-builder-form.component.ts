import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { CustomButtonComponent } from "../../../common/components/custom-button/custom-button.component";
import {
  TEAM_MAX_POKEMON,
  TEAM_MIN_POKEMON,
  TEAM_NAME_MAX_LENGTH,
  TEAM_NAME_MIN_LENGTH,
} from "../../constants/team.constants";
import { CreateTeamInput } from "../../models/team.model";
import { TeamApiService } from "../../services/team-api.service";
import { TeamStore } from "../../state/team.store";
import { uniqueTeamNameValidator } from "../../validators/unique-team-name.validator";
import { PokemonPickerComponent } from "../pokemon-picker/pokemon-picker.component";

@Component({
  selector: "app-team-builder-form",
  standalone: true,
  imports: [CustomButtonComponent, PokemonPickerComponent, ReactiveFormsModule],
  templateUrl: "./team-builder-form.component.html",
  styleUrl: "./team-builder-form.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamBuilderFormComponent {
  readonly created = output<CreateTeamInput>();
  readonly cancelled = output<void>();

  private readonly store = inject(TeamStore);
  private readonly api = inject(TeamApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly minPokemon = TEAM_MIN_POKEMON;
  readonly maxPokemon = TEAM_MAX_POKEMON;
  readonly minNameLength = TEAM_NAME_MIN_LENGTH;
  readonly maxNameLength = TEAM_NAME_MAX_LENGTH;

  readonly form = new FormGroup({
    name: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(TEAM_NAME_MIN_LENGTH),
        Validators.maxLength(TEAM_NAME_MAX_LENGTH),
      ],
      asyncValidators: [uniqueTeamNameValidator(this.store, this.api)],
      updateOn: "change",
    }),
    pokemonIds: new FormControl<number[]>([], {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(TEAM_MIN_POKEMON),
        Validators.maxLength(TEAM_MAX_POKEMON),
      ],
    }),
  });

  // Value, status, touched and dirty changes all arrive on `events`, so one
  // signal is enough to keep every computed below in step with the form.
  private readonly formState = toSignal(this.form.events, {
    initialValue: null,
  });

  readonly submitted = signal(false);

  readonly nameControl = this.form.controls.name;
  readonly pokemonControl = this.form.controls.pokemonIds;

  readonly selectedIds = computed<readonly number[]>(() => {
    this.formState();
    return this.pokemonControl.value;
  });

  readonly isCheckingName = computed(() => {
    this.formState();
    return this.nameControl.status === "PENDING";
  });

  /** Errors appear once a field is dirty or touched, or after a submit try. */
  readonly nameError = computed(() => {
    this.formState();
    const control = this.nameControl;
    if (!this.shouldShow(control)) return null;
    if (control.hasError("required")) return "Enter a team name.";
    if (control.hasError("minlength")) {
      return `Use at least ${TEAM_NAME_MIN_LENGTH} characters.`;
    }
    if (control.hasError("maxlength")) {
      return `Use at most ${TEAM_NAME_MAX_LENGTH} characters.`;
    }
    if (control.hasError("nameTaken")) {
      return "You already have a team with that name.";
    }
    return null;
  });

  readonly pokemonError = computed(() => {
    this.formState();
    const control = this.pokemonControl;
    if (!this.shouldShow(control)) return null;
    return control.invalid
      ? `Pick between ${TEAM_MIN_POKEMON} and ${TEAM_MAX_POKEMON} Pokémon.`
      : null;
  });

  onSelectionChange(ids: number[]): void {
    this.pokemonControl.setValue(ids);
    this.pokemonControl.markAsDirty();
  }

  onPickerTouched(): void {
    this.pokemonControl.markAsTouched();
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      // Submit stays enabled: a disabled button cannot say what is missing.
      this.form.markAllAsTouched();
      this.focusFirstInvalidField();
      return;
    }
    this.created.emit({
      name: this.nameControl.value.trim(),
      pokemonIds: [...this.pokemonControl.value],
    });
    this.reset();
  }

  cancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  private focusFirstInvalidField(): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }

  private reset(): void {
    this.submitted.set(false);
    this.form.reset({ name: "", pokemonIds: [] });
  }

  private shouldShow(control: {
    dirty: boolean;
    touched: boolean;
    invalid: boolean;
  }): boolean {
    return (
      control.invalid && (control.dirty || control.touched || this.submitted())
    );
  }
}
