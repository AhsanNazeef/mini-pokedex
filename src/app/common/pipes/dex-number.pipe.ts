import { Pipe, PipeTransform } from "@angular/core";

/** Formats a National Pokédex number the way the games do: 25 → "#0025". */
@Pipe({ name: "dexNumber", standalone: true })
export class DexNumberPipe implements PipeTransform {
  transform(id: number): string {
    return `#${String(id).padStart(4, "0")}`;
  }
}
