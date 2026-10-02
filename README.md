# Mini Pokédex

A single-page Angular app for browsing Pokémon and building teams, backed by GraphQL.
Pokémon data comes from the public [PokéAPI GraphQL endpoint](https://beta.pokeapi.co/graphql/v1beta);
teams are stored in a local mock GraphQL server.

## Features

- **Pokédex table** — sprite, name, type badges and all six base stats plus total; sortable by
  any stat, client-side pagination (10 / 25 / 50), debounced name search and a type filter
- **Detail panel** — slide-in panel with abilities and an animated radar chart of base stats
- **Team builder** — reactive form with an async unique-name check, a debounced Pokémon
  autocomplete and removable chips (1–6 Pokémon)
- **Teams** — create and delete teams with optimistic updates and rollback on failure
- **Resilient UI** — every async view has loading, empty, error (with retry) and success states

## Status

Work in progress. This section is updated as features land.

- [x] Angular 21 workspace (standalone, zoneless, Vitest, SCSS)
- [x] Tooling: commitlint, husky, ESLint
- [x] Mock GraphQL server
- [x] Pokédex table and detail panel
- [ ] Team store, team list and team builder
- [ ] Unit tests (store rollback, selector/computed, form validator)

## Tech stack

| Area      | Choice                                              |
| --------- | --------------------------------------------------- |
| Framework | Angular 21.2 — standalone components, zoneless      |
| State     | Custom RxJS stores (`BehaviorSubject`) + Signals    |
| Data      | GraphQL over Angular `HttpClient`                   |
| Charts    | ECharts via `ngx-echarts`                           |
| Tests     | Vitest                                              |
| Styling   | SCSS with BEM naming and CSS custom property tokens |

## Getting started

### Prerequisites

- Node.js `^20.19`, `^22.12` or `>=24`
- npm 8 or later

### Install

```bash
npm install
```

### Start the mock server

Teams live in a local GraphQL server generated from [`db.js`](db.js) by
[json-graphql-server](https://github.com/marmelab/json-graphql-server). In its own terminal:

```bash
npx json-graphql-server db.js --port 4000
```

It serves GraphQL at <http://localhost:4000/>, with a GraphiQL explorer at the same URL. Data
is kept in memory, so created or deleted teams reset when the server restarts.

### Start the app

In a second terminal:

```bash
npm start
```

Then open <http://localhost:4200>. Pokémon data needs internet access to reach PokéAPI.

## Scripts

| Command                | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm start`            | Start the dev server on port 4200         |
| `npm run build`        | Production build into `dist/mini-pokedex` |
| `npm test`             | Run unit tests with Vitest                |
| `npm run lint`         | Lint TypeScript and templates with ESLint |
| `npm run format`       | Format `src/` with Prettier               |
| `npm run format:check` | Check formatting without writing changes  |

The Angular CLI is installed locally, so use `npx ng <command>` (or the scripts above) rather
than a global `ng`.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) and are checked by
commitlint in a husky `commit-msg` hook (installed automatically by `npm install`):

```
<type>(<scope>): <subject>
```

- **Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `style`
- **Scopes:** `core`, `common`, `cache`, `pokedex`, `teams`, `deps`, `readme`, `mock`
- **Subject:** lowercase, imperative mood ("add", not "added"), no trailing period, header
  ≤ 100 characters

## Project structure

```
src/app/
├── core/       # App-wide singletons: GraphQL client, logger
├── common/     # Shared components, constants, models, pipes, services, utils, styles
├── pokedex/    # Pokédex page, table, detail panel and state/ (store + selectors)
└── teams/      # Teams page, team builder form, validators and state/ (team store)
```
