# FreeInk product website (GitHub Pages)

This branch intentionally contains **only the static product website**, not the Electron application's source files. Application development and releases continue on `main`.

**Expected URL:** https://huythedev.github.io/freeink/

## Enable GitHub Pages once

1. Open `https://github.com/huythedev/freeink/settings/pages` as a repository admin.
2. Under **Build and deployment** set **Source: Deploy from a branch**.
3. Select **Branch: `gh-pages`** and folder **`/(root)`**, then click **Save**.
4. Wait for the Pages deployment and open the URL above. GitHub Pages may take a few minutes to publish.

The connected GitHub integration used to publish this branch does **not** expose repository Pages settings, so initial deployment source selection must be completed by the repository admin in GitHub's UI.

## Files

- `index.html` — accessible responsive landing page with English/Vietnamese copy.
- `styles.css` — design and responsive layout.
- `main.js` — language switch, mobile navigation, current release detection with safe fallback.
- `assets/freeink-editor.png` — actual capture from an earlier FreeInk editor prototype (identified as such).
- `assets/favicon.svg` — vector logo.
- `.nojekyll`, `404.html`, `robots.txt`, `sitemap.xml` — static publishing metadata.

## Updating downloads

The page asks GitHub's public Releases API for the newest release and picks existing `.exe`, `.msi` and `.dmg` assets by filename. If an API request fails, links fall back to the known v0.2.1 release. If a new release lacks a Mac DMG, the Mac link opens the Releases page rather than pretending a new DMG exists.

The Mac build is currently **unsigned**. Do not remove its first-launch warning until signed + notarized binaries are publicly available.

## Development

Serve the folder with `python -m http.server 8080`, then open `http://localhost:8080`. No Node or external build tools are required. Before editing the website, switch to branch `gh-pages` so application `main` stays separate.
