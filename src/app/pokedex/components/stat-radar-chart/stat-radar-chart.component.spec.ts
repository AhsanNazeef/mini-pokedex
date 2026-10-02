import { TestBed } from "@angular/core/testing";
import { StatRadarChartComponent } from "./stat-radar-chart.component";

interface RadarUpdate {
  series: {
    data: { name: string; value: number[] }[];
    lineStyle: { color: string };
    areaStyle: { color: string; opacity: number };
  }[];
}

describe("StatRadarChartComponent", () => {
  beforeEach(() => {
    // Only the option objects are under test; ECharts itself needs a canvas.
    TestBed.overrideComponent(StatRadarChartComponent, {
      set: { imports: [], template: "" },
    });
  });

  function create() {
    const fixture = TestBed.createComponent(StatRadarChartComponent);
    fixture.componentRef.setInput("stats", {
      hp: 78,
      attack: 84,
      defense: 78,
      specialAttack: 109,
      specialDefense: 85,
      speed: 100,
    });
    fixture.componentRef.setInput("color", "#ee8130");
    fixture.componentRef.setInput("name", "Charizard");
    return fixture.componentInstance;
  }

  it("plots the six base stats on axes scaled to the highest base stat", () => {
    const radar = create().options["radar"] as {
      indicator: { name: string; max: number }[];
    };

    expect(radar.indicator.map((axis) => axis.name)).toEqual([
      "HP",
      "Attack",
      "Defense",
      "Sp.Atk",
      "Sp.Def",
      "Speed",
    ]);
    expect(radar.indicator.every((axis) => axis.max === 255)).toBe(true);
  });

  it("maps stats to a series update in axis order with the given colour", () => {
    const update = create().update() as unknown as RadarUpdate;

    expect(update.series[0].data[0]).toEqual({
      name: "Charizard",
      value: [78, 84, 78, 109, 85, 100],
    });
    expect(update.series[0].lineStyle.color).toBe("#ee8130");
    expect(update.series[0].areaStyle).toEqual({
      color: "#ee8130",
      opacity: 0.3,
    });
  });

  it("only updates the series, so ECharts morphs the existing shape", () => {
    expect(Object.keys(create().update())).toEqual(["series"]);
  });
});
