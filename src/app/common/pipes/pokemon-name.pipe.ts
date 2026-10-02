import { Pipe, PipeTransform } from "@angular/core";
import { toTitleCase } from "../utils/string.util";

@Pipe({ name: "pokemonName", standalone: true })
export class PokemonNamePipe implements PipeTransform {
  transform(name: string): string {
    return toTitleCase(name);
  }
}
