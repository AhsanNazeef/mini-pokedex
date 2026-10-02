import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

export interface SelectOption {
  value: string;
  label: string;
}

const OPTION_HEIGHT_PX = 36;
const LISTBOX_PADDING_PX = 10; // 4px padding + 1px border, top and bottom
const MAX_VISIBLE_OPTIONS = 5;

/**
 * Select-only combobox (WAI-ARIA APG pattern). Focus stays on the trigger;
 * `aria-activedescendant` points at the highlighted option.
 */
@Component({
  selector: "app-custom-select",
  standalone: true,
  templateUrl: "./custom-select.component.html",
  styleUrl: "./custom-select.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "(document:pointerdown)": "onDocumentPointerDown($event)" },
})
export class CustomSelectComponent {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = input("");
  readonly disabled = input(false);
  readonly valueChange = output<string>();

  // Show at most five options; the rest scroll.
  readonly listboxMaxHeight =
    MAX_VISIBLE_OPTIONS * OPTION_HEIGHT_PX + LISTBOX_PADDING_PX;

  readonly isOpen = signal(false);
  readonly activeIndex = signal(-1);
  readonly opensUpward = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger =
    viewChild.required<ElementRef<HTMLButtonElement>>("trigger");
  private readonly listbox = viewChild<ElementRef<HTMLElement>>("listbox");

  readonly labelId = computed(() => `${this.inputId()}-label`);
  readonly listboxId = computed(() => `${this.inputId()}-listbox`);
  readonly selectedIndex = computed(() =>
    this.options().findIndex((option) => option.value === this.value()),
  );
  readonly selectedLabel = computed(
    () => this.options()[this.selectedIndex()]?.label ?? "",
  );
  readonly activeOptionId = computed(() =>
    this.isOpen() && this.activeIndex() >= 0
      ? this.optionId(this.activeIndex())
      : null,
  );

  constructor() {
    // Keep the highlighted option in view while navigating a long list.
    afterRenderEffect(() => {
      const index = this.isOpen() ? this.activeIndex() : -1;
      const listbox = this.listbox()?.nativeElement;
      if (index < 0 || !listbox) return;
      const options = listbox.querySelectorAll('[role="option"]');
      options[index]?.scrollIntoView({ block: "nearest" });
    });
  }

  optionId(index: number): string {
    return `${this.inputId()}-option-${index}`;
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(activeIndex = this.selectedIndex()): void {
    if (this.disabled() || this.isOpen()) return;
    this.opensUpward.set(this.shouldOpenUpward());
    this.activeIndex.set(Math.max(activeIndex, 0));
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  select(index: number, { refocus = true } = {}): void {
    const option = this.options()[index];
    if (option && option.value !== this.value()) {
      this.valueChange.emit(option.value);
    }
    this.close();
    if (refocus) this.trigger().nativeElement.focus();
  }

  onKeydown(event: KeyboardEvent): void {
    const last = this.options().length - 1;

    if (!this.isOpen()) {
      switch (event.key) {
        case "ArrowDown":
        case "ArrowUp":
        case "Enter":
        case " ":
          event.preventDefault();
          this.open();
          return;
        case "Home":
          event.preventDefault();
          this.open(0);
          return;
        case "End":
          event.preventDefault();
          this.open(last);
          return;
      }
      this.typeahead(event);
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.activeIndex.update((index) => Math.min(index + 1, last));
        return;
      case "ArrowUp":
        event.preventDefault();
        this.activeIndex.update((index) => Math.max(index - 1, 0));
        return;
      case "Home":
        event.preventDefault();
        this.activeIndex.set(0);
        return;
      case "End":
        event.preventDefault();
        this.activeIndex.set(last);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        this.select(this.activeIndex());
        return;
      case "Escape":
        // Stop here so an enclosing panel does not close as well.
        event.preventDefault();
        event.stopPropagation();
        this.close();
        return;
      case "Tab":
        this.select(this.activeIndex(), { refocus: false });
        return;
    }
    this.typeahead(event);
  }

  // Clicks and hovers are delegated from the listbox: options are not
  // focusable in this pattern, so they carry no handlers of their own.
  onListboxClick(event: MouseEvent): void {
    const index = this.optionIndexFrom(event);
    if (index !== null) this.select(index);
  }

  onListboxPointerMove(event: MouseEvent): void {
    const index = this.optionIndexFrom(event);
    if (index !== null && index !== this.activeIndex()) {
      this.activeIndex.set(index);
    }
  }

  onDocumentPointerDown(event: PointerEvent): void {
    if (
      this.isOpen() &&
      !this.host.nativeElement.contains(event.target as Node)
    ) {
      this.close();
    }
  }

  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.host.nativeElement.contains(next)) this.close();
  }

  // Typing a letter jumps to the next option starting with it.
  private typeahead(event: KeyboardEvent): void {
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey) return;
    const char = event.key.toLowerCase();
    const options = this.options();
    const from =
      (this.isOpen() ? this.activeIndex() : this.selectedIndex()) + 1;
    for (let offset = 0; offset < options.length; offset++) {
      const index = (from + offset) % options.length;
      if (options[index].label.toLowerCase().startsWith(char)) {
        if (this.isOpen()) {
          this.activeIndex.set(index);
        } else {
          this.open(index);
        }
        return;
      }
    }
  }

  private optionIndexFrom(event: Event): number | null {
    const option = (event.target as Element).closest<HTMLElement>(
      "[data-index]",
    );
    return option ? Number(option.dataset["index"]) : null;
  }

  private shouldOpenUpward(): boolean {
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const listHeight = Math.min(
      this.options().length * OPTION_HEIGHT_PX + LISTBOX_PADDING_PX,
      this.listboxMaxHeight,
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    return spaceBelow < listHeight && rect.top > spaceBelow;
  }
}
