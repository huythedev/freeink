'use strict';
/**
 * Build both installer formats for the same application/version:
 * - FreeInk-<version>-x64.exe: NSIS installer (in-app electron-updater supported)
 * - FreeInk-<version>-x64.msi: native Windows Installer (MSI-managed upgrades)
 *
 * The GitHub release workflow deliberately publishes verified assets itself,
 * rather than giving the build process permission to publish half a release.
 */
const { Platform, build } = require('electron-builder');
const fs = require('node:fs/promises');
const path = require('node:path');
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
async function main() {
  const output = path.join(__dirname, '..', 'dist');
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  // Electron Builder cleans each output directory; use independent staging
  // folders so building an MSI cannot delete the previously built NSIS EXE.
  for (const target of ['nsis', 'msi']) {
    console.log(`Building FreeInk ${pkg.version} (${target})...`);
    const stage = path.join(output, target);
    await build({
      targets: Platform.WINDOWS.createTarget([target]),
      config: {
        ...config,
        extraMetadata: { freeinkInstallerType: target },
        directories: { ...(pkg.build.directories || {}), output: stage },
      },
      publish: 'never',
    });
    const files = await fs.readdir(stage, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile()) continue;
      if (!/\.(exe|msi|blockmap)$/i.test(file.name) && file.name !== 'latest.yml') continue;
      await fs.copyFile(path.join(stage, file.name), path.join(output, file.name));
      console.log(`Staged ${file.name}`);
    }
  }
  console.log('Windows NSIS EXE + native MSI installers built. Publishing is a separate, manual action.');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
