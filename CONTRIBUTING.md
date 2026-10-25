# Contributing to RaceHubOS

Thanks for helping! RaceHubOS runs on real race nights, so a few rules keep it reliable. The full rules, each with the incident behind it, are in [docs/CONVENTIONS.md](docs/CONVENTIONS.md) (French).

## Setup

- Node.js 22.13+
- `npm install` — also installs the git hooks from `.githooks/`: the commit message is checked on every commit, the project rules before every push.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), **without scope**: `type: description`.

Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `style`, `test`, `perf`, `ci`, `build`.

```
feat: import Cockpit-XP archives            ✓
feat(cockpit): import Cockpit-XP archives   ✗ scope
feat: packages/frontend/src/pages           ✗ says nothing about the change
```

One commit = one coherent change that works on its own. Don't split a feature by folder.

## Formatting and lint

- `npm run format` before committing. [Prettier](https://prettier.io) decides the layout (`.prettierrc.json`), so reviews only discuss the code.
- ESLint must not report more problems than before in the files you change. Some files carry old problems: you don't have to fix them, just don't add new ones.

Both are checked by `npm run check`.

## Tests

Every PR that changes code comes with tests covering the change:

- business rules: backend, `npm test -w @racehubos/backend` — always through this script, which points the tests at a throwaway database
- interface: Playwright, `npm test -w @racehubos/frontend`, with selectors on `data-testid`

A test must fail when the rule it protects is broken.

## Leave to the maintainer

- the version in `package.json`
- `CHANGELOG.md`
- `package-lock.json`, unless you add or update a dependency

Describe the user-facing change in the PR description instead: the version and the changelog are written when merging. Several PRs bumping the version from the same `main` all conflict with each other.

Don't reformat files you don't need to change (e.g. `package.json` rewritten with `é` escapes).

## Before opening a PR

```bash
npm run check
npm test -w @racehubos/backend
```

- One PR = one topic, based on the latest `main`.
- Every translation key exists in every language (`fr`, `en`, `de`…), checked by `npm run check`.
- Enable **Allow edits by maintainers**, so small fixes can be made directly on your branch.
