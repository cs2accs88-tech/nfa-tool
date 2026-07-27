# Release Guide

## Versioning

Steam Manager uses [Semantic Versioning](https://semver.org/):

- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features, backward compatible
- **PATCH** (0.0.x): Bug fixes, backward compatible

## Release Process

### Automated Release

```bash
# Patch release (bug fixes)
npm run release:patch

# Minor release (new features)
npm run release:minor

# Major release (breaking changes)
npm run release:major
```

This automatically:
1. Bumps the version in package.json
2. Runs lint checks
3. Runs all tests
4. Builds the application
5. Generates release notes

### Manual Release

```bash
# 1. Bump version
node build/scripts/bump-version.js patch

# 2. Run quality checks
npm run lint
npm run test

# 3. Build
npm run build

# 4. Verify output
ls release/
```

### GitHub Release

1. Tag the release:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

2. GitHub Actions will automatically:
   - Run tests
   - Build executables
   - Create a GitHub Release
   - Upload build artifacts

## Pre-Release Checklist

- [ ] All tests pass (`npm run test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Version bumped correctly
- [ ] Changelog/release notes updated
- [ ] Build succeeds (`npm run build`)
- [ ] Installer works on clean machine
- [ ] Portable version launches correctly
- [ ] Database migration runs on existing data
- [ ] No console errors in production mode

## Backup Before Release

Always backup before a release:

```bash
npm run backup
```

This creates a timestamped backup in `backups/` with:
- Database files
- Logs
- Manifest with version info

## Build Artifacts

After building, artifacts are in `release/{version}/`:

| File | Description |
|------|-------------|
| `*.exe` (NSIS) | Windows installer |
| `*-Portable.exe` | Portable Windows executable |
| `*.zip` | ZIP archive |

## Installer Features

The NSIS installer provides:
- Custom installation directory
- Desktop shortcut
- Start menu shortcut
- Uninstaller with clean removal
- Preserves user data on uninstall
- Upgrade support (in-place)

## Auto-Update Architecture

The app is prepared for auto-updates via `electron-updater`:

- Update checks every 4 hours (configurable)
- Downloads happen in background
- User prompted before install
- Automatic backup before update

To enable:
1. Configure GitHub releases as the update source
2. Set `GH_TOKEN` in CI environment
3. Updates will be served from GitHub Releases

## Rollback

If a release has issues:
1. Restore from backup: `backups/backup-{timestamp}/`
2. Copy database back to `data/`
3. Install previous version

## Hotfix Process

```bash
git checkout main
git checkout -b hotfix/description
# Fix the issue
npm run test
npm run release:patch
git checkout main
git merge hotfix/description
```
