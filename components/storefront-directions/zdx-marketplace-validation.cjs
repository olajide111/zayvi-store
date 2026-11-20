const fs=require('node:fs'),assert=require('node:assert/strict'),swc=require('next/dist/build/swc');
for(const ext of ['.tsx','.ts','.jsx'])require.extensions[ext]=(m,file)=>{const result=swc.transformSync(fs.readFileSync(file,'utf8'),{filename:file,jsc:{parser:{syntax:ext==='.jsx'?'ecmascript':'typescript',tsx:ext==='.tsx',jsx:ext==='.jsx'},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});m._compile(result.code,file);};
require.extensions['.css']=(m)=>{m.exports={__esModule:true,default:new Proxy({}, {get:(_,key)=>String(key)})};};
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),Market=require('./ZdxMarketplacePreview.tsx').default,{ZdxAppearanceContext}=require('./zdx-runtime.jsx');
for(const screen of ['home','collection','product','bag']){
 const html=renderToStaticMarkup(React.createElement(Market,{initialScreen:screen}));
 assert(html.includes('data-zdx-direction="modern-marketplace"'));
 assert(html.includes('Mobile navigation'));
 if(screen==='home'){assert(html.includes('/demo-photos/textiles-display.webp'));assert(html.includes('Your kind of market.'));}
 if(screen==='collection'){assert(html.includes('6 sample'));assert(html.includes('Jollof Spice Blend'));}
 if(screen==='product')assert(html.includes('Add to sample bag'));
 if(screen==='bag')assert(html.includes('Your bag is empty'));
 assert(!html.includes('action="/api/'));
}
const custom=renderToStaticMarkup(React.createElement(ZdxAppearanceContext.Provider,{value:{brand:'Custom market',colours:{canvas:'#121212',ink:'#ffffff',accent:'#cccccc',accentInk:'#000000'},font:'Georgia,serif',replacements:{}}},React.createElement(Market)));
assert(custom.includes('Custom market'));assert(custom.includes('--market-bg:#121212'));assert(custom.includes('--market-on-green:#000000'));assert(custom.includes('font-family:Georgia,serif'));
console.log('PASS: redesigned marketplace renders all four initial screens, an empty bag, and custom brand / palette / font.');
