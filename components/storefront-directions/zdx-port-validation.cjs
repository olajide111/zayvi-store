const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const swc=require('next/dist/build/swc');
require.extensions['.jsx']=(module,file)=>{const r=swc.transformSync(fs.readFileSync(file,'utf8'),{filename:file,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});module._compile(r.code,file);};
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
let rendered=0,interactions=0;
for(const family of ['showroom','editorial','market','atelier','fresh','spec'])for(const device of ['desktop','mobile']){
 const C=require('./generated/'+family+'-'+device+'.jsx').default;
 for(const screen of ['home','collection','product','bag']){const html=renderToStaticMarkup(React.createElement(C,{screen}));assert(html.length>1500,family+'/'+device+'/'+screen);assert(!html.includes('{{'), 'unresolved binding');rendered++;}
 const instance=new C({screen:'bag'});instance.setState=update=>{instance.state={...instance.state,...(typeof update==='function'?update(instance.state):update)};};
 let v=instance.renderVals();const count=v.count;v.setNG();v=instance.renderVals();assert(String(v.subtotal).startsWith('₦'),family+' explicit NGN');assert.equal(v.count,count);
 const lines=v.bagItems||v.bagRows||(v.groups||[]).flatMap(g=>g.items);assert(lines?.length,family+' bag lines');
 lines[0].inc();assert.equal(instance.renderVals().count,count+1,family+' increment');instance.renderVals();
 const next=instance.renderVals();const nl=next.bagItems||next.bagRows||(next.groups||[]).flatMap(g=>g.items);nl[0].dec();assert.equal(instance.renderVals().count,count,family+' decrement');interactions+=3;
}
console.log('PASS:',rendered,'screen renders;',interactions,'market and bag assertions across all 12 board ports.');
for(const device of ['desktop','mobile']){
 const C=require('./generated/showroom-'+device+'.jsx').default;const instance=new C({screen:'product'});instance.setState=u=>{instance.state={...instance.state,...u};};let v=instance.renderVals();v.sizes.at(-1).pick();instance.renderVals().colours[1].pick();const before=instance.renderVals().count;instance.renderVals().addToBag();v=instance.renderVals();assert.equal(v.count,before+1);assert(v.bagItems.some(b=>b.meta.includes('XL')),'size retained in sample bag');
 for(const family of ['market','spec','fresh']){const T=require('./generated/'+family+'-'+device+'.jsx').default;const i=new T({screen:'collection'});i.state={...i.state,zdxQuery:'NO_SUCH_SAMPLE_ITEM_987'};const v=i.renderVals();assert.equal((v.grid||v.rows).length,0,family+' query filters products');}
}
console.log('PASS: showroom size/colour selections enter the bag; all search listings filter on both devices.');
