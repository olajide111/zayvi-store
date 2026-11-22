import {build} from 'esbuild';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
const temporary=await mkdtemp(join(process.cwd(),'.zayvi-access-tests-'));
try {
  await build({banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},entryPoints:[
    'tests/security-domain.test.ts','tests/store-access.test.ts','tests/store-database.test.ts',
    'tests/owner-identity.test.ts','tests/tenant-membership-directory.test.ts','tests/tenant-membership-postgres.test.ts',
  ],bundle:true,platform:'node',format:'esm',packages:'external',outdir:temporary,outExtension:{'.js':'.mjs'},logLevel:'warning'});
  const files=(await readdir(temporary)).filter(file=>file.endsWith('.mjs')).map(file=>join(temporary,file));
  const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
  if(result.error)throw result.error;
  process.exitCode=result.status??1;
} finally {await rm(temporary,{recursive:true,force:true});}
