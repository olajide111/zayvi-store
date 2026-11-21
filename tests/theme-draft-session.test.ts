import test from 'node:test';
import assert from 'node:assert/strict';
import {draftSaveBlocked} from '../lib/theme-draft-session';
test('a history refresh cannot silently advance an older editor baseline',()=>{
 assert.equal(draftSaveBlocked(4,4),false);
 assert.equal(draftSaveBlocked(4,5),true);
 assert.equal(draftSaveBlocked(null,5),true);
 assert.equal(draftSaveBlocked(4,null),true);
 assert.equal(draftSaveBlocked(5,5),false);
 assert.equal(draftSaveBlocked(0,0),false);
});
