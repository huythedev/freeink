'use strict';
/* npm run release:win -- with FREEINK_GITHUB_REPO=owner/repo or GITHUB_REPOSITORY
   The public GitHub owner/repo is resolved at BUILD TIME and written into
   app-update.yml, allowing the app's GitHub Release feed to survive code reorganizations.
 */
const {Platform,build}=require('electron-builder');
const pkg=require('../package.json');
const repo=process.env.FREEINK_GITHUB_REPO||process.env.GITHUB_REPOSITORY||'';
const match=/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(repo);
if(!match){console.error('Set FREEINK_GITHUB_REPO=your-name/freeink before releasing.');process.exit(1)}
if(process.env.GITHUB_REF_TYPE==='tag'){
 const tag=process.env.GITHUB_REF_NAME;
 if(tag!==`v${pkg.version}`){console.error(`Release tag ${tag} does not match package version v${pkg.version}`);process.exit(1)}
}
const publish={provider:'github',owner:match[1],repo:match[2],releaseType:'release'};
const config={...pkg.build,publish};
build({targets:Platform.WINDOWS.createTarget(['nsis']),config,publish:process.env.CI?'always':'never'})
  .then(()=>console.log('Windows NSIS build complete.'))
  .catch(err=>{console.error(err);process.exitCode=1});
