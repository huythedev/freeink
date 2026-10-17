# Code signing, SmartScreen, and macOS Gatekeeper

## Windows: reduce Microsoft Defender SmartScreen warnings

SmartScreen reputation is not the same as a malware scan. The current unsigned FreeInk installers can show **Windows protected your PC** or **Unknown publisher**. Never ask users to disable SmartScreen, Defender, or Smart App Control.

**Production routes:**
1. Publish through the **Microsoft Store** for Microsoft-signed Store-distributed apps. Microsoft states this avoids SmartScreen download warnings.
2. For GitHub Releases, obtain a legitimate trusted **OV/EV code-signing certificate** or use **Microsoft Artifact Signing (formerly Trusted Signing)**. Sign *every* release with the same verified publisher identity, including `.exe` and `.msi` files, with timestamping. A valid certificate identifies your publisher and lets reputation accumulate; it **does not instantly eliminate warnings**. EV no longer automatically bypasses SmartScreen.
3. If using an exportable OV/EV PFX certificate with electron-builder, configure repository **Settings → Secrets and variables → Actions**:
   - `WIN_CSC_LINK`: a secure certificate source (e.g. base64-encoded PFX content, if supported by the build tool).
   - `WIN_CSC_KEY_PASSWORD`: the PFX password.
   The manual Windows release workflow forwards these secrets to electron-builder during packaging. This does **not** configure Artifact Signing; that service requires Azure credentials, a verified signing identity and its signing integration separately.
4. Inspect signatures with PowerShell: `Get-AuthenticodeSignature .\FreeInk-*.exe` and `.msi` after signing. Test clean Windows installations and upgrades before publishing.

**Important:** Never store certificates or passwords in the repository. Do not tell users to turn off security features. For falsely reported malware, use Microsoft Security Intelligence's submission portal, rather than attempting to game reputation.

Official Microsoft guidance: https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation

## macOS: Developer ID + notarization

The unsigned DMG/ZIP **test build** is intended for development/testing, not smooth public installation. For public downloads from GitHub, enroll in the Apple Developer Program and use a **Developer ID Application** signing identity plus Apple notarization.

In **GitHub → Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `MAC_CSC_LINK` | Base64-exported Developer ID Application `.p12` certificate |
| `MAC_CSC_KEY_PASSWORD` | Certificate export password |
| `APPLE_ID` | Apple Developer account Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

**Procedure:**
1. Use **Publish Windows release (EXE + MSI)** on branch `main` to create the next version tag, e.g. `0.2.1` (do not overwrite existing `v0.2.0`).
2. After it succeeds, use **Publish signed macOS release** from `main`, enter the **same version** (`0.2.1`). It builds the tagged source and adds a universal Mac DMG, ZIP and update metadata to the existing GitHub release.
3. Sign + notarization must succeed; unsigned Mac builds are **never** automatically published to releases by this workflow.
4. On macOS verify Gatekeeper: `spctl --assess --type exec --verbose /path/to/FreeInk.app` and signature: `codesign --verify --deep --strict --verbose=2 /path/to/FreeInk.app`.

Do not disable Gatekeeper to work around an unsigned build. Apple Developer guide: https://developer.apple.com/developer-id/

## CI layout

- `.github/workflows/ci.yml`: JavaScript and vector-PDF tests.
- `.github/workflows/windows-build.yml`: test Windows EXE/MSI (unsigned) on each push.
- `.github/workflows/windows-release.yml`: manual production Windows release, optionally signed if certificate secrets are set.
- `.github/workflows/macos-build.yml`: universal unsigned Mac smoke build on each push, uploaded only as an expiring Actions artifact.
- `.github/workflows/macos-release.yml`: **manual** signed/notarized Mac attachment to an already published matching Windows release.

Users receive only the versions you explicitly publish. The app's source code is shared across both platforms, but Windows and macOS have distinct installers and signing requirements.

## Free and low-cost routes: what they actually achieve

- **Windows / Microsoft Store (free):** Microsoft currently offers free individual-developer onboarding and signs Store-distributed **MSIX** submissions after certification. Our GitHub-hosted EXE/MSI binaries are **not** re-signed by the Store. A separate Store-compatible MSIX package and Store developer account are required. See https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options and https://learn.microsoft.com/windows/apps/publish/whats-new-individual-developer.
- **Windows / SignPath Foundation (potentially free):** https://signpath.org offers certificate-based signing to **approved, qualifying open-source projects**. FreeInk uses MIT licensing, but acceptance is not automatic. Follow SignPath's policies, then separately integrate its signing service into GitHub Actions; the current WIN_CSC_LINK flow is not a SignPath integration. Code signing does not guarantee instant SmartScreen reputation. See https://signpath.org/terms.html.
- **Windows / self-signed certificate (free):** useful only on developer-managed or enterprise devices where the certificate is explicitly trusted; it **will not solve SmartScreen** for arbitrary GitHub downloads.
- **macOS / ad-hoc or no Developer ID signing (free):** a DMG can be created, downloaded and copied into Applications without paid signing, but Apple Gatekeeper may block launching it. Free ad-hoc signing **does not** substitute for trusted Developer ID signing and Apple notarization. Most individuals need a paid Apple Developer Program membership (currently US$99/year) for public Developer ID distribution. See https://developer.apple.com/developer-id/.
- **Unsigned macOS test release (no Apple membership required):** after the Windows version has been published and its version tag exists, open [Publish unsigned macOS test DMG](https://github.com/huythedev/freeink/actions/workflows/macos-unsigned-release.yml), select `main`, enter an existing published version (e.g. `0.2.1`), explicitly acknowledge Gatekeeper limitations, then click **Run workflow**. It attaches the DMG, ZIP, hashes, and a warning notice to that same GitHub Release. **It does not publish `latest-mac.yml` and does not enable Mac auto-updates.** The signed workflow remains available separately.

For unsigned macOS testing, users should validate the source and checksum and follow Apple's per-app **Open Anyway** guidance only if they trust the file (https://support.apple.com/102445). Do not recommend disabling Gatekeeper globally, bypassing malware scanning or removing quarantine flags.
