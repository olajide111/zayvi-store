import {build} from 'esbuild';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
const temporary=await mkdtemp(join(process.cwd(),'.zayvi-storefront-tests-'));
try{
  await build({entryPoints:['tests/hammy-shopping.test.tsx','tests/hammy-seamless-shopping.test.tsx','tests/hammy-cart-feedback.test.tsx','tests/hammy-pilot.test.tsx','tests/default-store-baseline.test.tsx'],
    bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',outdir:temporary,outExtension:{'.js':'.cjs'},logLevel:'warning',
    plugins:[{name:'css-module-test-names',setup(build){
      // SSR behavioural assertions need class keys, not stylesheet processing.
      build.onLoad({filter:/\.module\.css$/},()=>({contents:'export default new Proxy({}, { get:(_target,key)=>String(key) });',loader:'js'}));
    }}]});
  const files=(await readdir(temporary)).filter(file=>file.endsWith('.cjs')).map(file=>join(temporary,file));
  const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
  if(result.error)throw result.error;process.exitCode=result.status??1;
}finally{await rm(temporary,{recursive:true,force:true});}
