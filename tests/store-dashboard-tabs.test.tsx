import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {adminGroups,isAdminRouteActive} from '../components/admin/admin-navigation';
import DefaultStorePage from '../app/admin/pilots/default/page';
import HammyStorePage from '../app/admin/pilots/hammy/page';
test('Default and Hammy have independent store tabs with exclusive active routes',()=>{
 const stores=adminGroups.find(group=>group.label==='Stores');assert(stores);
 assert.deepEqual(stores.items.map(item=>[item.title,item.href]),[['Store Templates','/admin/pilots/default'],['My Store — Hammy','/admin/pilots/hammy']]);
 for(const suffix of ['','/photos','/preview']){
  assert(isAdminRouteActive('/admin/pilots/hammy'+suffix,'/admin/pilots/hammy'));
  assert(!isAdminRouteActive('/admin/pilots/hammy'+suffix,'/admin/pilots/default'));
 }
 assert(isAdminRouteActive('/admin/pilots/default/demo','/admin/pilots/default'));
 assert(!isAdminRouteActive('/admin/pilots/default/demo','/admin/pilots/hammy'));
});
test('Default Store overview is a baseline reference rather than a combined Hammy page',()=>{
 const html=renderToStaticMarkup(<DefaultStorePage/>);
 assert.match(html,/>Store Templates<\/h1>/);assert.match(html,/Saved baseline · Version 1/);assert.match(html,/Design reference/);
 assert.doesNotMatch(html,/Open Hammy Store|\/pilots\/hammy/);
});
test('Hammy has its own working overview and keeps deferred photo tools collapsed',()=>{
 const html=renderToStaticMarkup(<HammyStorePage/>);
 assert.match(html,/>Hammy Store<\/h1>/);assert.match(html,/YOUR WORKSPACE/);assert.match(html,/Continue building Hammy/);
 assert.match(html,/The path to a selling store/);assert.match(html,/not verified completions/);
 assert.match(html,/Product pictures · saved for later/);assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
 assert.doesNotMatch(html,/Saved baseline · Version 1|Select photos first/);
});
