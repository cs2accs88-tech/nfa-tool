# Steam Manager

A Windows desktop application (Electron) for managing multiple Steam accounts locally. Import account tokens, sign in to / switch the Steam client, and run bulk account‑status checks — with all data stored locally and no authenticated web requests that could invalidate your tokens.

## Features

- **Token import** — paste or load a file of accounts in the `SteamID64----token----key:value…` format.
- **Accounts view** — name, token status, rank, elo, Prime, VAC, inventory value and last‑checked time.
- **Local Steam sign‑in & switching** — prepares the local Steam configuration so the client signs in as the selected account. It only writes local config; it never performs a web logout, so other accounts' sessions are preserved.
- **Account Status "Check All"** — signs in to each stored account one at a time, confirms the login via Steam's local `ActiveUser` state, and marks any token that cannot sign in as **Dead**. Runs sequentially and continues past individual failures.
- **Automatic updates** — via `electron-updater` + GitHub Releases, with SHA‑512 verification, in‑app download progress, settings, and history.
- **Local‑first storage** — SQLite (`better-sqlite3`); offline and token‑preserving by design.

## Requirements

- Windows 10/11
- Node.js 20+ and npm
- Steam installed (required for the sign‑in / account‑switching features)

## Installation

```bash
cd steam-manager
npm install
```

## Configuration

- Copy `.env.example` to `.env` for optional local settings.
- **Never commit** `.env` or the local database at `data/steam-manager.db` — they contain sensitive account data (login tokens). Both are git‑ignored by default.

## Running

```bash
npm run dev     # development
npm start       # production-like
```

## Building

```bash
npm run build            # current platform (electron-builder)
npm run build:win        # Windows: NSIS installer + portable
npm run build:portable   # portable .exe only
npm run build:installer  # NSIS installer only
```

Artifacts are written to `dist/`. Building expects the icons under `assets/icons/`.

## Testing

```bash
npm test          # unit suites (node --test)
npm run test:vdf  # VDF read/write suite
npm run test:update
```

## Project structure

```
steam-manager/
  src/
    main/         Electron main process: window, IPC, Steam sign-in, account status, auto-update
    renderer/     UI (HTML/CSS/JS) and the preload bridge
    database/     SQLite connection, schema, migrations
    services/     settings, accounts, logging
    imports/      token / CSV / JSON import + parsing
    steam/        Steam profile & link helpers
    utils/        VDF, token, and validation helpers
    config/       environment + production configuration
  tests/          node --test unit / integration suites
  assets/         icons and static resources
  .github/        CI and release workflows
```

Local‑only and git‑ignored: `data/` (account database), `logs/`, `backups/`, `dist/`, `release/`, `node_modules/`.

## Versioning

This project uses [Semantic Versioning](https://semver.org/) (`Major.Minor.Patch`). The version is defined once in `package.json` and surfaced in‑app via `app.getVersion()`.

## Contributing

Branch model:

- `main` — stable, released code
- `develop` — integration branch
- `feature/*`, `bugfix/*`, `hotfix/*`, `release/*` — scoped work branches

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` a new feature
- `fix:` a bug fix
- `refactor:` a change that neither fixes a bug nor adds a feature
- `docs:` documentation only
- `chore:` tooling / maintenance
- `test:` adding or updating tests

## License

Released under the MIT License — see [`LICENSE`](./LICENSE).
