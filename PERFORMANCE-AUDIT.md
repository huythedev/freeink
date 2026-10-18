# Responsiveness, pixel eraser and document opening

The audit identified concrete sources of CPU work, large allocations and unsafe lifecycle behavior. These explain plausible FreeInk-related slowdowns; they do not establish the cause of every Windows “Not responding” report without a trace from the affected machine.

## Findings and changes

| Path | Previous behavior | Change |
|---|---|---|
| Long notebooks | Every page owned a full DPR-scaled canvas, even offscreen | Mount visible pages plus one page of overscan; free backing stores when pages leave the viewport; preserve the active pointer's page |
| Live handwriting | Repaint all older objects on every animation frame | Cache the finished page once per gesture and paint only the current stroke over it |
| Undo and duplicate | JSON-copy every point in the notebook for each history entry | Share unchanged immutable items; copy a stroke and its masks only before moving or resizing it; regenerate duplicate IDs |
| Autosave | Serialize the whole library after each edit; overlapping writes could show an incorrect saved status | Atomic per-note IndexedDB writes with revision tracking and retries; save errors remain visible |
| Close and updates | Unawaited unload writes; close could stop the local server before saving; update installation could continue after a failed save | Main/renderer close handshake; keep the app open on failure; stop the server only on final quit; successful save required before update installation |
| Imports and exports | Large JSON, DOCX and PDF conversion on the editor thread; concurrent drops; retained PDF resources and image bitmaps | One cancellable file operation at a time, conversion workers, cooperative page painting, PDF task cleanup and explicit bitmap/canvas release |
| Images | Full-resolution decoding and unbounded cache | Fit imported images to at most 4 million pixels / 4096-pixel edge, including images in backups; account for EXIF orientation; use an 8-entry / 64 MiB decoded-image cache |
| Input limits | Spread large point arrays into Math.min/Math.max; unbounded expanded DOCX archives; table text bypassed text limits | Iterative stroke bounds, 100 MiB expanded DOCX budget, page/text/item/point validation, graceful import errors |
| Navigation and menus | Scrolling could append unwanted blank pages, overwrite a focused title, and accumulate outside-click listeners | Scrolling only changes the viewport; title editing is preserved; a single outside-click listener |
| Desktop launch | Multiple application processes could compete for the fixed local port | Single-instance lock; forward OS document opens to the existing window |
| PDF images | Exported image coordinates inverted photographs | Correct image transform; repeated source images are encoded and embedded once per export |

The existing `127.0.0.1:17873` origin, app ID, profile and IndexedDB database version remain stable. Storage schema 3 uses `library-index` plus `note:<id>` records in the existing object store. A schema 2 library is removed only in the same successful transaction that creates every new record. Failed/missing-record reads do not create a replacement library. The fallback localStorage path refuses oversized writes and reports a save failure; it cannot provide IndexedDB capacity.

## Pixel eraser

`E` retains whole-object erasing. `Shift+E` selects the new pixel eraser; its width slider has an independent 2–100 page-pixel range. A drag stores a vector mask on affected existing strokes, shapes, text and images. It removes only touched pixels, including a narrow strip inside a broad pen stroke. New ink drawn later is unaffected.

Masks participate in undo/redo, move/duplicate with their object and scale with resized images. Onscreen rendering and PNG export reveal the original paper underneath. PDF export uses isolated vector forms and luminosity soft masks rather than flattening ink. `.freeink` backups retain the masks; older FreeInk versions without this feature will ignore them, so use this release to reopen pixel-erased backups.

## Windows .freeink association

The NSIS EXE and native MSI register `.freeink` with an application icon and a quoted document-open command. Keep the installer scope selected by the user; no forced machine-wide NSIS install or overwrite of Windows UserChoice is required. A pre-existing user-selected default can still be changed through Windows **Open with → FreeInk**.

A cold launch queues the file until the editor is ready. A later double-click restores/focuses the existing window and opens the file there. Only OS-supplied `.freeink` paths enter the bounded queue; the renderer cannot request arbitrary filesystem reads. Reads are asynchronous and limited to 75 MiB. Invalid or unavailable files report an error without replacing existing notes.

Opening a file imports an editable local copy, as the existing Import command does. Edits auto-save inside FreeInk. Use **Export → FreeInk file** to write an updated backup; the original file is not overwritten. Portable/browser builds do not install Windows associations.

## Validation

`npm test` covers real Skia rendering at 1×, 1.25× and 2×; partial masks on wide ink, images, shapes, text and later ink; editable backup round trips; vector PDF mask generation and image reuse; slow/coalesced input; interrupted editing; viewport canvas lifetimes; save failures and concurrent edits; atomic migration; real worker JSON/PDF/Mammoth conversion; image sizing/EXIF; worker cancellation; native file queues/single-instance/close behavior; updater guards; server disconnects; and generated standalone parity.

An additional independent MuPDF raster check confirmed PDF masks, surviving narrow stroke edges, new ink and upright image placement against canvas samples. It is a local validation, not part of the Node test suite.

`node scripts/benchmark.cjs` compares 45 retained undo states for 30,000 points in separate Node processes. On the development Linux runtime, JSON snapshots retained approximately **115.29 MiB** and took **586 ms** total; shared snapshots retained approximately **0.10 MiB** and took less than 1 ms total. These are synthetic V8 measurements, not Windows process/RAM measurements. The 200-page viewport regression mounts at most four canvases for an 800-pixel viewport at 100% zoom, plus an active gesture page when necessary.

Windows CI builds both installers, inspects the MSI association tables and verifies the registry command after a silent per-user NSIS installation on its disposable runner.

## Windows interactive checks before release

- Install one package format, double-click a `.freeink` file whose path contains spaces/non-ASCII characters; repeat while FreeInk is already running and minimized.
- Use a real Windows pen at 100%/125%/200% display scaling. Draw slowly, erase a narrow part of broad ink, undo/redo, move the object and export/reopen it.
- Import a 50-page PDF, scroll through it, draw on a late page and cancel a second import. Observe FreeInk CPU/private memory and other applications with Task Manager.
- Close immediately after writing or editing text; reopen and verify the last edit. Test an update between two installed release versions with unsaved changes.

The development runtime cannot reproduce Windows driver, GPU, antivirus or shell behavior. Installer build/registry checks and mocked lifecycle regressions do not replace those interactive checks.
