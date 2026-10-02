import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from "@angular/core";
import { AvatarComponent } from "../../../common/components/avatar/avatar.component";
import { TypeBadgeComponent } from "../../../common/components/type-badge/type-badge.component";
import { PokemonNamePipe } from "../../../common/pipes/pokemon-name.pipe";
import { Pokemon } from "../../../pokedex/models/pokemon.model";
import { Team } from "../../models/team.model";

export interface TeamMember {
  id: number;
  pokemon: Pokemon | null;
}

@Component({
  selector: "app-team-card",
  standalone: true,
  imports: [AvatarComponent, DatePipe, PokemonNamePipe, TypeBadgeComponent],
  templateUrl: "./team-card.component.html",
  styleUrl: "./team-card.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamCardComponent {
  readonly team = input.required<Team>();
  /** Cached Pokémon for this team, in slot order; entries may be unresolved. */
  readonly members = input.required<readonly TeamMember[]>();
  /** True while this team's create or delete is still in flight. */
  readonly pending = input(false);
  /** Marks this as the trainer's active team. */
  readonly selected = input(false);
  readonly deleteTeam = output<string>();
  readonly selectToggle = output<string>();

  /** Combined base-stat total, counting only members already in the cache. */
  readonly totalStats = computed(() =>
    this.members().reduce(
      (sum, member) => sum + (member.pokemon?.total ?? 0),
      0,
    ),
  );

  /** Distinct types across the team, most common first, for the badges. */
  readonly typeSpread = computed(() => {
    const counts = new Map<string, number>();
    for (const { pokemon } of this.members()) {
      for (const type of pokemon?.types ?? []) {
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([type, count]) => ({ type, count }));
  });
}
