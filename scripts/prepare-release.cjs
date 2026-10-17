'use strict';
/** Validates a manual release version and updates package.json before packaging.
 * The GitHub workflow commits the version only after tests and both installers build.
 */
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const requested = (process.env.RELEASE_VERSION || process.argv[2] || '').trim();
const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
if (!pattern.test(requested)) {
  console.error('Release version must be a stable SemVer, e.g. 0.2.0 or 0.2.1.');
  process.exit(1);
}
if (!pattern.test(pkg.version)) {
  console.error(`Unsupported version in package.json: ${pkg.version}`);
  process.exit(1);
}
const currentParts = pkg.version.split('.').map(Number);
const nextParts = requested.split('.').map(Number);
const comparison = nextParts[0] - currentParts[0] || nextParts[1] - currentParts[1] || nextParts[2] - currentParts[2];
if (comparison < 0) {
  console.error(`Refusing to release ${requested}: package.json is already ${pkg.version}.`);
  process.exit(1);
}
if (requested !== pkg.version) {
  pkg.version = requested;
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}
console.log(`Prepared FreeInk v${requested} (prior version: ${currentParts.join('.')}).`);
