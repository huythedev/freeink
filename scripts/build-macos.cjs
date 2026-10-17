'use strict';
/** Build a Universal (Intel + Apple Silicon) DMG and ZIP.
 * GitHub release publishing is a separate, explicit workflow step.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const {build,Platform,Arch} = require('electron-builder');
const pkg = require('../package.json');
const repo = process.env.FREEINK_GITHUB_REPO || process.env.GITHUB_REPOSITORY || 'huythedev/freeink';
const match = /^([\w.-]+)\/([\w.-]+)$/.exec(repo);
if (!match) throw new Error('Invalid FreeInk repository: expected owner/name');
if (process.platform !== 'darwin') throw new Error('Build macOS packages on a macOS runner');
const signingCert = !!process.env.CSC_LINK && !!process.env.CSC_KEY_PASSWORD;
const notarizeCreds = !!process.env.APPLE_ID && !!process.env.APPLE_APP_SPECIFIC_PASSWORD && !!process.env.APPLE_TEAM_ID;
if (process.env.FREEINK_REQUIRE_SIGNED === 'true' && (!signingCert || !notarizeCreds)) {
  throw new Error('Public Mac release requires CSC_LINK, CSC_KEY_PASSWORD, APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID');
}
const signed = signingCert && notarizeCreds;
(async()=>{
  const icon=path.resolve(__dirname,'../assets/app.icns');
  await fs.access(icon);
  const publish={provider:'github',owner:match[1],repo:match[2]};
  const dir=path.resolve(__dirname,'../dist-mac');
  await fs.rm(dir,{recursive:true,force:true});
  await build({
    targets:Platform.MAC.createTarget(['dmg','zip'],Arch.universal),
    config:{
      ...pkg.build,
      directories:{...pkg.build.directories,output:dir},
      publish,
      extraMetadata:{freeinkMacSigned:signed},
      mac:{category:'public.app-category.productivity',icon:'assets/app.icns',hardenedRuntime:true,
        gatekeeperAssess:false,notarize:signed,
        target:[{target:'dmg',arch:['universal']},{target:'zip',arch:['universal']}],
        artifactName:'FreeInk-${version}-mac-${arch}.${ext}'},
    },
    publish:'never',
  });
  const files=await fs.readdir(dir);
  for(const ext of ['.dmg','.zip'])if(!files.some(x=>x.endsWith(ext)))throw new Error(`Missing macOS ${ext} package`);
  if(signed&&!files.includes('latest-mac.yml'))throw new Error('Signed macOS build lacks updater metadata');
  console.log(`macOS universal build complete (${signed?'signed and notarized':'unsigned test package'}):`,files);
})().catch(error=>{console.error(error);process.exitCode=1});
