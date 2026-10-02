import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "pokedex",
    loadChildren: () =>
      import("./pokedex/pokedex.routes").then((m) => m.pokedexRoutes),
  },
  { path: "", redirectTo: "pokedex", pathMatch: "full" },
  { path: "**", redirectTo: "pokedex" },
];
