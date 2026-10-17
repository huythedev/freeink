# Publishing FreeInk updates via GitHub Releases

This prototype includes the main updater logic. Replace your existing installed app by releasing a new **full NSIS installer**, not by shipping source-code ZIPs.

## 1. Publish the repository

Use the public **[`huythedev/freeink`](https://github.com/huythedev/freeink)** GitHub repository and preserve the `.github/workflows/windows-release.yml` directory. A private repository is **not** recommended for normal app users: it requires authenticating each update client. Do not embed a private GitHub API token inside FreeInk.

Keep the following consistent between versions:

- `package.json` → `build.appId`: `org.freeink.prototype` (changing it is a product migration and can change Windows update/installation identity).
- GitHub owner/repo used by all installers. This is captured inside the installed application's `app-update.yml` at release build time. Moving or transferring repositories requires a migration strategy.
- The localhost port `17873` currently serves as the editor's browser storage origin. Don't change it casually if users already have notes.

## 2. First version

Update `package.json` to your first intended release version (the prototype starts at `0.2.0`). Push the source. Create a tag matching the version:

```bash
git add .
git commit -m "Initial FreeInk release"
git push origin main
git tag v0.2.0
git push origin v0.2.0
```

The GitHub Actions **Windows release** workflow reads `github.repository`, verifies that `v0.2.0` matches the package version and executes `npm run release:win`. The workflow's short-lived `GITHUB_TOKEN` has `contents: write` to publish the NSIS installer, SHA-512/size manifests and `latest.yml` (and `.blockmap` as produced). Check the Releases tab and verify the installation manually.

The **first release** is installed by the user once, by downloading its NSIS installer. After that, users can use the app's **Updates** button to check, download, and restart into later releases, without separately visiting GitHub.

## 3. Publish an update

Change code, increment `package.json` version from `0.2.0` to `0.2.1`, test, push and tag it:

```bash
git add .
git commit -m "FreeInk v0.2.1"
git push origin main
git tag v0.2.1
git push origin v0.2.1
```

Ensure the GitHub release is **published** and contains both the `.exe` and `latest.yml`. Updates cannot discover unpublished releases or a ZIP file that lacks update metadata. Test in a clean Windows VM with `0.2.0` installed, checking that `0.2.1` is discovered, downloads, installs and preserves saved notes.

## 4. How the updater survives structural code changes

`updater.js` checks GitHub Release version metadata via `electron-updater`. It never applies patches against specific editor paths. NSIS installs the new application package as a whole. Even if `app.js` becomes `src/editor/*`, or dependencies and windows change, the updater can still install the package, *provided future releases continue to ship a functioning updater, compatible update metadata, and same application identity.*

Application data needs separate care: `persist()` saves the `schemaVersion: 2` notebook format in IndexedDB, and `migrateLibrary()` normalizes older note models on load. Every future breaking data format change must add and test a migration. Desktop app-updating cannot automatically repair an incompatible or deleted notebook format, renamed origin, appId or forgotten publishing repository.

## 5. Safety, signing and releases

- Do **not** point update clients at arbitrary user-provided GitHub links or execute downloaded JavaScript. The main-process updater downloads only the configured GitHub provider's installer.
- Never ship `GH_TOKEN` or `GITHUB_TOKEN` to users. Workflow secret tokens are used only while publishing releases.
- The update metadata/hash verifies transport integrity, but **code signing is strongly recommended** so Windows can verify the publisher and avoid SmartScreen uncertainty. The prototype does not include a signing certificate.
- Prefer `npm ci` after you generate and commit a `package-lock.json` from a trusted online `npm install`, for reproducible CI.
- Do not distribute a portable executable as if it is auto-updatable. The NSIS installer is the supported Windows update target.

## 6. Build a release locally

With `FREEINK_GITHUB_REPO=huythedev/freeink` set in your shell, run:

```bash
npm install
npm run release:win
```

Outside CI this builds the installed NSIS target and its update feed configuration without publishing; release from GitHub Actions to avoid exposing GitHub tokens. On Windows PowerShell set the variable with `$env:FREEINK_GITHUB_REPO='owner/repo'` before running the command.
