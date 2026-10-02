import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import type { EChartsCoreOption } from "echarts/core";
import { NgxEchartsDirective } from "ngx-echarts";
import {
  MAX_BASE_STAT,
  STAT_KEYS,
  STAT_LABELS,
} from "../../constants/pokemon.constants";
import { PokemonStats } from "../../models/pokemon.model";

const GRID_COLOR = "rgba(255, 255, 255, 0.12)";
const LABEL_COLOR = "rgba(255, 255, 255, 0.6)";

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

@Component({
  selector: "app-stat-radar-chart",
  standalone: true,
  imports: [NgxEchartsDirective],
  templateUrl: "./stat-radar-chart.component.html",
  styleUrl: "./stat-radar-chart.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatRadarChartComponent {
  readonly stats = input.required<PokemonStats>();
  readonly color = input("#007acc");
  readonly name = input("");
  readonly label = input("");

  // Static chart setup. Data arrives through `update`, which ECharts merges
  // into the same series, so switching Pokémon morphs the shape (animated).
  readonly options: EChartsCoreOption = {
    animation: !prefersReducedMotion(),
    animationDuration: 500,
    animationDurationUpdate: 500,
    animationEasingUpdate: "cubicInOut",
    tooltip: {
      trigger: "item",
      backgroundColor: "#1e2121",
      borderColor: GRID_COLOR,
      textStyle: { color: "#ffffff" },
    },
    radar: {
      indicator: STAT_KEYS.map((key) => ({
        name: STAT_LABELS[key],
        max: MAX_BASE_STAT,
      })),
      radius: "68%",
      splitNumber: 5,
      axisName: { color: LABEL_COLOR, fontSize: 11 },
      axisLine: { lineStyle: { color: GRID_COLOR } },
      splitLine: { lineStyle: { color: GRID_COLOR } },
      splitArea: { show: false },
    },
    series: [
      {
        type: "radar",
        symbol: "circle",
        symbolSize: 5,
        data: [{ value: STAT_KEYS.map(() => 0) }],
      },
    ],
  };

  readonly update = computed<EChartsCoreOption>(() => {
    const color = this.color();
    return {
      series: [
        {
          data: [
            {
              name: this.name(),
              value: STAT_KEYS.map((key) => this.stats()[key]),
            },
          ],
          lineStyle: { color, width: 2 },
          itemStyle: { color },
          areaStyle: { color, opacity: 0.3 },
        },
      ],
    };
  });
}
