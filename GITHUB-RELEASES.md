# Publish FreeInk Windows installers (.exe + .msi) from GitHub Actions

Repository: https://github.com/huythedev/freeink

## Release by clicking a button (no terminal commands required)

1. Go to **[Actions → Publish Windows release (EXE + MSI)](https://github.com/huythedev/freeink/actions/workflows/windows-release.yml)**.
2. Click **Run workflow**, make sure the selected branch is `main`.
3. Enter `0.2.0` for the first release (the current prototype), then higher versions such as `0.2.1`, `0.3.0`, `1.0.0` for later releases.
4. Click the green **Run workflow** button. Wait for a successful run, then open [Releases](https://github.com/huythedev/freeink/releases).
5. Users download the `FreeInk-<version>-x64.exe` (recommended) or `FreeInk-<version>-x64.msi` file from the published release.

The workflow validates the version, refuses to reuse existing tags or downgrade, updates `package.json`, installs dependencies, runs tests, builds **both** Windows packages, and verifies updater metadata. **It only then commits the version and lockfile to `main`, tags the commit, creates a draft, uploads both installers and `latest.yml`, and publishes the release.** No GitHub PAT is needed; the workflow uses the short-lived built-in `GITHUB_TOKEN` with `contents: write`. Never embed this token in the app.

If the workflow fails **before creating the tag**, fix the build and rerun the same version. If it fails **after tagging/publishing a draft**, do not simply rerun: open the draft release and determine whether to finish uploading/publishing it or delete the incomplete release and tag before retrying. Only delete an incomplete tag/release you intentionally created; deleting published tags may disrupt updates.

GitHub branch rules may prevent GitHub Actions from directly pushing the release version commit to `main`. If so, a repository admin must allow the workflow to write (or adapt the workflow to use a pull request). The workflow does not bypass branch protection.

## Which installer?

- **EXE**: Standard NSIS interactive installer. Recommended for most users, supports in-app updates with `electron-updater`.
- **MSI**: `msi-wrapped` target: an MSI wrapper containing the *same* NSIS setup. Useful for environments requiring an MSI deployment artifact while retaining the app's NSIS updater. This is **not** a fully native WiX MSI; install **either** MSI **or** EXE on a machine, not both. Both install the same FreeInk app and use the same GitHub update feed.
- **Standalone HTML / portable**: no automatic replacement of the application.

For testing changes without publishing a release, use [Actions → Windows installers (test build)](https://github.com/huythedev/freeink/actions/workflows/windows-build.yml). The successful run's **Artifacts** section contains `.exe` and `.msi` test installers. These builds do not create releases and are **not** production auto-update endpoints.

## How updates survive structural code changes

`updater.js` runs in Electron's main process, not the editor renderer. `electron-updater` downloads the full NSIS-based app via GitHub's `latest.yml` metadata and installer hash, with an explicit install-and-restart action from the user. Renaming the renderer files or reorganizing dependencies does not inherently break this whole-package update mechanism, as long as the updater and publishing format remain compatible.

Preserve `build.appId` (`org.freeink.prototype`), the repository `huythedev/freeink`, the stable MSI upgrade code, and the note-data origin `127.0.0.1:17873`. Changing them may cause duplicate installations, broken update feeds, or inaccessible local notes. Notebook storage schema changes require tested `migrateLibrary()` migrations and backups; the updater itself cannot repair broken data formats.

## Release testing and security

- Publish `v0.2.0` first and install it on Windows. Then make a small change, publish `v0.2.1` with Run workflow, and test **Updates → Check → Download → Install/restart**. Verify saved notes still open.
- Unsigned binaries can trigger SmartScreen warnings. For public distribution add Windows code signing and optionally release artifact checksums / provenance.
- A published GitHub Release must include the `.exe` and `latest.yml` metadata for the in-app updater. MSI alone is not sufficient.
- Avoid installing both variants simultaneously; the MSI wrapper launches the NSIS installer.
- Back up `.freeink` notes before testing major application/data migrations. No note data is stored in the GitHub repository.

## Local build on Windows

```powershell
npm install
npm test
$env:FREEINK_GITHUB_REPO='huythedev/freeink'
npm run release:win
```

Files are written to `dist/`; the local command **does not publish** anything. Publishing is deliberately handled by the manual GitHub Actions workflow after build verification.
