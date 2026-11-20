const fs=require('node:fs'),assert=require('node:assert/strict'),swc=require('next/dist/build/swc');
for(const ext of ['.tsx','.ts','.jsx'])require.extensions[ext]=(m,file)=>{const result=swc.transformSync(fs.readFileSync(file,'utf8'),{filename:file,jsc:{parser:{syntax:ext==='.jsx'?'ecmascript':'typescript',tsx:ext==='.tsx',jsx:ext==='.jsx'},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});m._compile(result.code,file);};
require.extensions['.css']=(m)=>{m.exports={__esModule:true,default:new Proxy({}, {get:(_,key)=>String(key)})};};
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{FreshMarket,AfricanEditorial,SpecSheet}=require('./ZdxRefinedStorefronts.tsx'),{ZdxAppearanceContext}=require('./zdx-runtime.jsx');
let renders=0;
for(const [C,family,phrase] of [[FreshMarket,'fresh-market','A little fresh.'],[AfricanEditorial,'african-editorial','Wear'],[SpecSheet,'spec-sheet','Less guesswork.']]){
 for(const screen of ['home','collection','product','bag']){
  const html=renderToStaticMarkup(React.createElement(C,{initialScreen:screen}));
  assert(html.includes(`data-refined="${family}"`));assert(!html.includes('action="/api/'));
  if(screen==='home')assert(html.includes(phrase));
  if(screen==='bag')assert(html.includes('sample bag is empty')||html.includes('Start with the right details.'));
  if(screen==='product'&&family==='african-editorial')assert(html.includes('Choose your size'));
  if(screen==='product'&&family==='spec-sheet')assert(html.includes('Manufacturer datasheet not supplied'));
  if(screen==='home'&&family==='fresh-market')assert(html.includes('Your basket'));
  renders++;
 }
 const custom=renderToStaticMarkup(React.createElement(ZdxAppearanceContext.Provider,{value:{brand:'My custom shop',colours:{canvas:'#121212',ink:'#ffffff',accent:'#cccccc',accentInk:'#000000'},font:'Georgia,serif',replacements:{}}},React.createElement(C)));
 assert(custom.includes('My custom shop'));assert(custom.includes('--r-bg:#121212'));assert(custom.includes('--r-on:#000000'));assert(custom.includes('--r-display:Georgia,serif'));
}
console.log(`PASS: ${renders} initial-screen renders across three refined themes, with custom brand / colours / fonts.`);
