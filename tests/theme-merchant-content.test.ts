import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {themeMerchantContent} from '../lib/theme-merchant-content';
import {MerchantStory,MerchantSocial} from '../components/themes/ThemeMerchantContent';
const ok=(data:unknown)=>({ok:true,status:200,data});
const missing={ok:false,status:404,data:null};
test('published content and only configured real social profiles are retained',()=>{
 const data=themeMerchantContent('NG',ok({entry:{title:'Our story',body:'Written by the merchant'}}),ok({links:{facebook:'https://www.facebook.com/zayvistore'}}));
 assert.equal(data.about.body,'Written by the merchant');assert.equal(data.market,'NG');
 const html=renderToStaticMarkup(React.createElement(MerchantSocial,{content:data}));
 assert.match(html,/facebook.com/);assert.doesNotMatch(html,/instagram.com/);
});
test('missing and unavailable pages remain distinct with no starter-page fallback',()=>{
 assert.equal(themeMerchantContent('GB',missing,ok({links:{}})).about.status,'missing');
 assert.equal(themeMerchantContent('GB',{...missing,status:503},ok({links:{}})).about.status,'unavailable');
 assert.equal(renderToStaticMarkup(React.createElement(MerchantSocial,{content:themeMerchantContent('GB',missing,ok({links:{}}))})), '');
});
test('merchant text is escaped and unsafe social links are rejected',()=>{
 const data=themeMerchantContent('GB',ok({entry:{title:'<script>bad</script>',body:'<img src=x onerror=bad>'}}),ok({links:{facebook:'javascript:bad'}}));
 const html=renderToStaticMarkup(React.createElement(MerchantStory,{content:data}));
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.equal(data.social.status,'unavailable');
});
