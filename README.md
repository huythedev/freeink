# FreeInk v0.2 — free, offline-first Windows handwriting prototype

[**GitHub repository**](https://github.com/huythedev/freeink) · [**Latest releases**](https://github.com/huythedev/freeink/releases)

FreeInk is an independent Scrble Ink–inspired notebook editor. It is not affiliated with Scrble or Microsoft. It is MIT-licensed and does not require accounts or subscriptions.

## Run on Windows

**No install:** Double-click `OPEN-WITHOUT-INSTALL.bat` or open `FreeInk-Standalone.html` in Microsoft Edge/Chrome. The standalone version supports writing, pasting images/text, drawing shapes, local saving, editable backups and **vector PDF export**. The standalone HTML has **no self-update, PDF import or DOCX import** because those require installed dependencies.

**Development desktop:** Install [Node.js LTS](https://nodejs.org/), then run `START-WINDOWS.bat` (or run `npm install` followed by `npm start`). It may download packages on the first run. `npm run dev` starts a local browser preview on `http://127.0.0.1:17873`.

**Installable desktop:** On Windows, run `npm run dist:win` after `npm install` to build both the normal NSIS `.exe` installer and an MSI-wrapped NSIS `.msi` installer in `dist/`. Both install the same app; **choose only one installer format** for a machine. FreeInk updates through the underlying installed NSIS app and GitHub Releases. The `.msi` is a wrapper for Windows MSI deployment, **not a separate native MSI installation implementation**. A separate `npm run dist:portable` creates a portable build that DOES NOT support reliable in-place automatic updates.

**Windows installer without publishing:** The [Windows installer test-build workflow](https://github.com/huythedev/freeink/actions/workflows/windows-build.yml) runs on pushes to `main` (and can be started manually under Actions). When successful, download the workflow artifact `FreeInk-Windows-EXE-and-MSI`. The unsigned test packages are **not** published GitHub Releases; public auto-updates require the manually run [Publish Windows release](.github/workflows/windows-release.yml) action.

## Main features

- Pen, pencil, pressure-aware strokes, highlighter, whole-object eraser and lasso for moving and duplicating strokes.
- Line, rectangle, ellipse, triangle and arrow shapes; typed editable text blocks.
- Clipboard paste (`Ctrl+V`) of PNG/JPEG/etc. screenshots and normal text while focused on the editor; drag and drop images onto pages; import image files.
- Move and resize inserted images with Lasso: select an image and drag its bottom-right selection handle.
- Ruled, plain, grid, dots, music and dark paper; many pages per note and searchable local gallery.
- **Resolution-independent PDF export:** ink paths, shapes, lines and paper patterns use PDF vector drawing commands, not flattened JPEG page screenshots. Standard Latin text is native PDF text. Images/photographs and imported scanned PDF page backgrounds remain raster assets, so their sharpness is limited by original resolution. For text characters outside the builtin PDF WinAnsi encoding, see limitation below.
- PDF import to annotate as editable ink overlay (**desktop/npm preview**, maximum 50 PDF pages). PDF backgrounds are currently rendered at ~2.4× page scale and embedded as images, not as source PDF vectors.
- DOCX import into editable FreeInk pages via locally installed Mammoth browser bundle (**desktop/npm preview**). Paragraphs, headings, simple tables and embedded inline images import in approximate reading order. This is a *reflowed document import*, not pixel-perfect Word page layout; sophisticated formatting, headers, tracked changes and equations are not preserved. Old binary `.doc` is not supported.
- Undo/redo, local IndexedDB persistence, PNG export, `.freeink` JSON backup/import.
- An **Updates** button on the desktop top bar. Installed GitHub-release NSIS apps check GitHub Releases for new versions, let the user download, and then explicitly restart into the newly installed version.

## GitHub update system

See **[GITHUB-RELEASES.md](GITHUB-RELEASES.md)** for complete setup steps and safeguards.

- **Updater location:** `updater.js` runs in the Electron main process and is kept distinct from the notebook UI. `preload.js` provides only three allowlisted updater actions through an IPC bridge: `check`, `download`, `install`. The browser version never receives updater privileges.
- **Update mechanism:** `electron-updater` reads the installed app's embedded GitHub provider configuration, compares version info in GitHub Releases `latest.yml`, downloads the corresponding NSIS update (integrity verified using manifest hashes) and calls `quitAndInstall` after the user confirms. No hot-swap of random source files or `eval` of fetched code.
- **App structure changes:** new releases replace the packaged application as a whole. Main-process, renderer, asset, package and folder changes are all included in the next installer, so update logic does not depend on per-file patches. Keep the Windows `appId`, release origin/owner, and app data profile stable. Schema/data format changes still require explicit versioned migrations.
- **Data safety:** FreeInk saves notes via IndexedDB. The HTTP origin remains `127.0.0.1:17873` so existing Electron notes retain their storage origin across versions. The renderer flushes unsaved notes before invoking install. Export `.freeink` backups before major migration/release changes.
- **Release automation:** `.github/workflows/windows-release.yml` is started by clicking **Actions → Publish Windows release (EXE + MSI) → Run workflow** and entering `0.2.0` (first release) or a higher version like `0.2.1`. It builds both installers, verifies `latest.yml`, commits the version to `main`, creates the version tag and publishes installers, blockmap, and update manifest to GitHub Releases. A tag push alone does not publish a release.

## Build and test

```
npm install
npm test
npm start
npm run dist:win
```

`npm test` checks the standalone PDF writer and generates a two-page test PDF for external inspection when run in this prototype environment. Type checks can be run via `node --check app.js` etc. The updater still needs end-to-end testing between two published versions on Windows. The release workflow builds both formats on a Windows GitHub runner and refuses to publish if either package or the updater manifest is missing.

## Limitations and privacy

- PDF drawing is fully vector for new ink and shapes. Photographs, raster annotations, and imported PDF page backgrounds are not magically made vector. Standard built-in PDF fonts do not contain every Unicode glyph; non-WinAnsi text (including some Vietnamese characters and emoji) can be substituted in PDF export. The in-app canvas and editable `.freeink` preserve the original Unicode text. Full embedded Unicode font support remains a planned improvement.
- PDF and DOCX imports require the `npm install` dependencies; these are bundled into installed builds, but the single-file standalone HTML cannot include them without significantly increasing size.
- Automatic updates only work for installed NSIS-based versions (including the wrapped MSI) built with valid GitHub publishing metadata. Development, browser, and portable modes do not self-update. GitHub owner/repo and release access must be configured when producing release installers. The unsigned Windows installer may trigger Microsoft SmartScreen; obtain code signing before widespread distribution.
- Not a complete commercial-feature clone: no handwriting OCR, polished palm rejection, precise ruler tools, collaboration, sync, layout-faithful DOCX importer or lossless vector-preserving import of existing PDFs yet.
- Notes are private and stored on this device. No analytics, tracking, remote sync or telemetry. External access is only used for app update checks in the packaged installed desktop version, as expected by the feature.

**Release with a click:** Open [Actions → Publish Windows release (EXE + MSI)](https://github.com/huythedev/freeink/actions/workflows/windows-release.yml), click **Run workflow** on `main`, enter a version and start. Read [GITHUB-RELEASES.md](GITHUB-RELEASES.md) for recovery notes, unsigned installer warnings, and update tests.

Source code: MIT License. `index.html`, `style.css`, `app.js`, `vector-pdf.js` form the editor; `electron.js`, `preload.js`, `updater.js`, `server.js` form the desktop shell, native bridge, updater and localhost static server.
