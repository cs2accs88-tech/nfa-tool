# Build Guide

## Prerequisites

- Node.js 18+ (recommended: 20 LTS)
- npm 9+
- Git

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm run test

# Build production executable
npm run build
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Launch app in development mode with DevTools |
| `npm start` | Launch app in production mode |
| `npm run test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run test:performance` | Run performance benchmarks |
| `npm run test:coverage` | Run tests with code coverage |
| `npm run lint` | Check code quality with ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without modifying |
| `npm run build` | Build production executable |
| `npm run build:win` | Build Windows installer + portable |
| `npm run build:linux` | Build Linux AppImage + deb |
| `npm run build:mac` | Build macOS dmg |
| `npm run package` | Package without creating installer (for testing) |
| `npm run dist` | Full pipeline: clean → lint → test → build |
| `npm run release` | Full release cycle with version bump |
| `npm run release:patch` | Bump patch version and build |
| `npm run release:minor` | Bump minor version and build |
| `npm run release:major` | Bump major version and build |
| `npm run clean` | Remove build artifacts |
| `npm run backup` | Backup application data |
| `npm run doctor` | Diagnose project setup |

## Build Output

Builds are output to `release/{version}/`:

- `Steam Manager-{version}-win-x64.exe` — NSIS Installer
- `Steam Manager-{version}-Portable.exe` — Portable executable
- `Steam Manager-{version}-win-x64.zip` — ZIP archive

## Configuration

Build configuration is in `electron-builder.config.js`.

Key settings:
- **appId**: `com.steammanager.app`
- **Targets**: NSIS installer, portable, ZIP (Windows)
- **Compression**: normal
- **Auto-update**: GitHub releases

## Icons

Place icons in `assets/icons/`:
- `icon.ico` — Windows (256x256)
- `icon.png` — Linux (512x512)
- `icon.icns` — macOS

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` or `production` |
| `DATABASE_FILE` | Custom database filename |
| `GH_TOKEN` | GitHub token for auto-update publishing |

## Troubleshooting

- **Build fails with native module error**: Run `npm run postinstall` to rebuild native modules
- **Icon not found**: Ensure `assets/icons/` contains the correct icon files
- **Tests fail**: Run `npm run doctor` to diagnose setup issues
