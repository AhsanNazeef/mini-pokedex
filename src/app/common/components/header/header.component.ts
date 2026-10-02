import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from "@angular/core";

@Component({
  selector: "app-header",
  standalone: true,
  templateUrl: "./header.component.html",
  styleUrl: "./header.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  readonly title = input.required<string>();
  readonly backUrl = input<string | null>(null);
  readonly showSearch = input(false);
  readonly searchQuery = input("");
  readonly searchPlaceholder = input("Search");
  readonly searchDisabled = input(false);
  readonly searchChange = output<string>();
  readonly clearSearch = output<void>();

  private readonly searchField =
    viewChild<ElementRef<HTMLInputElement>>("searchField");

  onSearchInput(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }

  onClearSearch(): void {
    this.clearSearch.emit();
    // The clear button disappears once the query is empty; keep focus in the field.
    this.searchField()?.nativeElement.focus();
  }
}
