import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from "@angular/core";
import { AvatarComponent } from "../../../common/components/avatar/avatar.component";
import { CustomButtonComponent } from "../../../common/components/custom-button/custom-button.component";
import { EmptyStateComponent } from "../../../common/components/empty-state/empty-state.component";
import { ErrorStateComponent } from "../../../common/components/error-state/error-state.component";
import { SkeletonComponent } from "../../../common/components/skeleton/skeleton.component";
import { TypeBadgeComponent } from "../../../common/components/type-badge/type-badge.component";
import { LoadStatus } from "../../../common/models/load-status.model";
import { DexNumberPipe } from "../../../common/pipes/dex-number.pipe";
import { PokemonNamePipe } from "../../../common/pipes/pokemon-name.pipe";
import { toTitleCase } from "../../../common/utils/string.util";
import { STAT_KEYS, STAT_LABELS } from "../../constants/pokemon.constants";
import {
  Pokemon,
  PokemonSort,
  PokemonSortKey,
} from "../../models/pokemon.model";

interface TableColumn {
  id: string;
  label: string;
  sortKey: PokemonSortKey | null;
}

const COLUMNS: readonly TableColumn[] = [
  { id: "id", label: "#", sortKey: "id" },
  { id: "name", label: "Name", sortKey: "name" },
  { id: "types", label: "Types", sortKey: null },
  ...STAT_KEYS.map((key) => ({
    id: key,
    label: STAT_LABELS[key],
    sortKey: key,
  })),
  { id: "total", label: "Total", sortKey: "total" },
];

type ViewState = "loading" | "error" | "empty" | "success";

@Component({
  selector: "app-pokemon-table",
  standalone: true,
  imports: [
    AvatarComponent,
    CustomButtonComponent,
    DexNumberPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    PokemonNamePipe,
    SkeletonComponent,
    TypeBadgeComponent,
  ],
  templateUrl: "./pokemon-table.component.html",
  styleUrl: "./pokemon-table.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokemonTableComponent {
  readonly pokemon = input.required<readonly Pokemon[]>();
  readonly status = input.required<LoadStatus>();
  readonly errorMessage = input<string | null>(null);
  readonly sort = input.required<PokemonSort>();
  readonly skeletonRowCount = input(10);
  readonly selectedId = input<number | null>(null);
  readonly searchTerm = input("");
  readonly typeFilter = input<string | null>(null);

  readonly sortChange = output<PokemonSortKey>();
  readonly rowSelect = output<Pokemon>();
  readonly retry = output<void>();
  readonly clearFilters = output<void>();

  readonly columns = COLUMNS;
  readonly statKeys = STAT_KEYS;
  readonly columnCount = COLUMNS.length + 1; // + sprite column

  readonly viewState = computed<ViewState>(() => {
    const status = this.status();
    if (status === "idle" || status === "loading") return "loading";
    if (status === "error") return "error";
    return this.pokemon().length === 0 ? "empty" : "success";
  });

  readonly skeletonRows = computed(() =>
    Array.from({ length: this.skeletonRowCount() }, (_, index) => index),
  );

  readonly hasFilters = computed(
    () => this.searchTerm() !== "" || this.typeFilter() !== null,
  );

  readonly emptyMessage = computed(() => {
    const search = this.searchTerm();
    const type = this.typeFilter();
    if (search && type) {
      return `Nothing matches "${search}" among ${toTitleCase(type)}-type Pokémon.`;
    }
    if (search) return `Nothing matches "${search}". Check the spelling.`;
    if (type) return `No ${toTitleCase(type)}-type Pokémon found.`;
    return "There are no Pokémon to show.";
  });

  ariaSort(column: TableColumn): "ascending" | "descending" | null {
    const sort = this.sort();
    if (column.sortKey === null || sort.key !== column.sortKey) return null;
    return sort.direction === "asc" ? "ascending" : "descending";
  }

  onRowKeydown(event: Event, pokemon: Pokemon): void {
    event.preventDefault(); // stop Space from scrolling the page
    this.rowSelect.emit(pokemon);
  }
}
