import { Routes } from "@angular/router";

export const pokedexRoutes: Routes = [
  {
    path: "",
    title: "Pokédex · Mini Pokédex",
    loadComponent: () =>
      import("./pokedex.component").then((m) => m.PokedexPage),
  },
];
