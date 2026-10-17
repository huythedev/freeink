'use strict';
/**
 * Build both installer formats for the same application/version:
 * - FreeInk-<version>-x64.exe: NSIS installer (in-app electron-updater supported)
 * - FreeInk-<version>-x64.msi: MSI-wrapped NSIS installer (same update channel)
 *
 * The GitHub release workflow deliberately publishes verified assets itself,
 * rather than giving the build process permission to publish half a release.
 */
const { Platform, build } = require('electron-builder');
const pkg = require('../package.json');
const repo = process.env.FREEINK_GITHUB_REPO || process.env.GITHUB_REPOSITORY || 'huythedev/freeink';
const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(repo);
if (!match) {
  console.error('FREEINK_GITHUB_REPO must be owner/repository');
  process.exit(1);
}
if (process.env.FREEINK_RELEASE_VERSION && process.env.FREEINK_RELEASE_VERSION !== pkg.version) {
  console.error(`Requested release ${process.env.FREEINK_RELEASE_VERSION} does not match package version ${pkg.version}`);
  process.exit(1);
}
const config = {
  ...pkg.build,
  publish: { provider: 'github', owner: match[1], repo: match[2], releaseType: 'release' },
};
build({
  targets: Platform.WINDOWS.createTarget(['nsis', 'msi-wrapped']),
  config,
  publish: 'never',
})
  .then(() => console.log('Windows EXE + MSI installers built. Artifacts remain local until the release workflow uploads them.'))
  .catch(err => { console.error(err); process.exitCode = 1; });
