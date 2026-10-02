# Mini Pokédex

A single-page Angular app for browsing Pokémon and building teams, backed by GraphQL.
Pokémon data comes from the public [PokéAPI GraphQL endpoint](https://beta.pokeapi.co/graphql/v1beta);
teams are stored in a local mock GraphQL server.

## Features

- **Pokédex table** — sprite, name, type badges and all six base stats plus total; sortable by
  any stat, client-side pagination (10 / 25 / 50), debounced name search and a type filter
- **Detail panel** — slide-in panel with abilities and a radar chart of base stats that
  animates from one Pokémon to the next
- **Team builder** — reactive form in a modal, with a debounced async unique-name check and a
  Pokémon autocomplete whose chips are removable (1–6 Pokémon)
- **Teams** — create and delete with optimistic updates, rollback and an error toast; the
  active team is remembered across reloads
- **Resilient UI** — every async view has loading, empty, error (with retry) and success states

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

## Architecture

### Layers

Data flows one way: **service → store → selectors → component**.

```
src/app/
├── core/       # App-wide singletons: GraphQL client, logger
├── common/     # Shared components, constants, models, pipes, services, utils, styles
├── pokedex/    # Pokédex page, table, detail panel and state/ (store + selectors)
└── teams/      # Teams page, team builder form, validators and state/ (team store)
```

- **Services** own the GraphQL documents and map raw responses to domain models. They return
  cold observables and never touch state.
- **Stores** (`pokemon.store.ts`, `team.store.ts`) hold a single `BehaviorSubject` of
  immutable state and expose it read-only. All mutations go through methods.
- **Selectors** derive everything the UI needs with `map`, `distinctUntilChanged`,
  `combineLatest` and `shareReplay(1)` — filtering, sorting and paging are pure functions,
  which keeps them easy to test.
- **Components** are standalone and `OnPush`, bridge selectors in with `toSignal()`, and use
  `signal()` only for their own UI state. Subscriptions use `takeUntilDestroyed()`.

### Fetching and caching

One `GraphqlClientService` serves both endpoints. The whole Pokédex (1025 Pokémon) is fetched
in a single request and cached in the store, so search, sorting, paging, the team cards and
the autocomplete all read from memory with no further requests. Only the sprite URL is
requested rather than the full `sprites` object, which keeps that response around 39 KB
gzipped instead of about 14 MB of JSON.

Per-Pokémon details (stats and abilities) are fetched on demand and cached by id.

### Errors and the four UI states

Every failure is normalised into an `ApiError` carrying a `kind`, a `userMessage` safe to
display, and `isRetryable`. GraphQL servers report failures with HTTP 200 and an `errors`
array, so the client treats that as a failure too. PokéAPI calls retry twice with a growing
delay (1s, then 2s); mutations deliberately do not, since retrying an ambiguous create could
produce duplicate teams. Requests time out after 30 seconds.

Each async view therefore renders one of four states — loading, empty, error with a working
retry, or success — from shared `skeleton`, `empty-state` and `error-state` components.

### Optimistic updates

Creating a team inserts it immediately with a temporary id; the server's copy replaces it on
success. On failure the row is removed and a toast explains why. Deleting works the same way
in reverse. Rollback is covered by unit tests and was verified in the browser with the
network cut.

## Testing

```bash
npm test
```

112 unit tests across 22 files, including the three the brief asks for:

| Required test  | File                                                         |
| -------------- | ------------------------------------------------------------ |
| Store method   | `teams/state/team.store.spec.ts` — optimistic rollback       |
| Selector       | `pokedex/state/pokemon.selectors.spec.ts` — filter/sort/page |
| Form validator | `teams/validators/unique-team-name.validator.spec.ts`        |

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

## What I'd improve with more time

- **Virtual scrolling for the table.** Caching the full Pokédex makes filtering instant, but
  50 rows per page is the practical ceiling for the DOM. `@angular/cdk` virtual scroll would
  let the table show everything without pagination.
- **Load ECharts lazily.** It is registered eagerly to match the developer guide, which puts
  about 139 KB (gzipped) into the initial bundle for a chart only the detail panel uses, and
  is why the production build budget is set to 850 kB rather than Angular's default 500 kB.
  Loading it with the panel would roughly halve the first download.
- **Trainer support.** `db.js` seeds two trainers, but the app writes every new team to
  trainer 1. A trainer switcher, and filtering teams by trainer, is the obvious next step.
- **Editing teams.** Only create and delete exist today; renaming a team or swapping a
  Pokémon means deleting and rebuilding it.
- **End-to-end tests.** The flows in this app were verified by driving a real browser during
  development; those checks belong in a committed Playwright suite rather than in my notes.
- **Reconciling concurrent edits.** The mock server has no subscriptions, so two tabs can
  drift apart. Refetching after a mutation, or polling, would keep them honest.
- **A real accessibility pass.** Roles, focus management and keyboard paths were built in and
  spot-checked, but the app has not been tested with an actual screen reader.
