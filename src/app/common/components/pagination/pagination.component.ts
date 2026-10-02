import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from "@angular/core";
import { CustomButtonComponent } from "../custom-button/custom-button.component";
import {
  CustomSelectComponent,
  SelectOption,
} from "../custom-select/custom-select.component";
import { SkeletonComponent } from "../skeleton/skeleton.component";

@Component({
  selector: "app-pagination",
  standalone: true,
  imports: [CustomButtonComponent, CustomSelectComponent, SkeletonComponent],
  templateUrl: "./pagination.component.html",
  styleUrl: "./pagination.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  readonly pageIndex = input.required<number>();
  readonly pageCount = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly totalItems = input.required<number>();
  readonly pageSizeOptions = input.required<readonly number[]>();
  readonly loading = input(false);
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  readonly rangeStart = computed(() =>
    this.totalItems() === 0 ? 0 : this.pageIndex() * this.pageSize() + 1,
  );
  readonly rangeEnd = computed(() =>
    Math.min((this.pageIndex() + 1) * this.pageSize(), this.totalItems()),
  );
  readonly hasPrevious = computed(() => this.pageIndex() > 0);
  readonly hasNext = computed(() => this.pageIndex() < this.pageCount() - 1);
  readonly sizeOptions = computed<SelectOption[]>(() =>
    this.pageSizeOptions().map((size) => ({
      value: String(size),
      label: String(size),
    })),
  );
  readonly sizeValue = computed(() => String(this.pageSize()));

  onPageSizeChange(value: string): void {
    this.pageSizeChange.emit(Number(value));
  }
}
