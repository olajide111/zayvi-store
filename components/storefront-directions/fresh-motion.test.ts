import test from 'node:test';
import assert from 'node:assert/strict';
import {freshMotionAllowed} from './useFreshShoppingMotion';
test('fresh market motion obeys device, local and studio settings independently',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
 let reduced=false;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{matchMedia:()=>({matches:reduced})}});
 try{
  const root={closest:()=>null} as unknown as HTMLElement;
  assert.equal(freshMotionAllowed(root),true);
  assert.equal(freshMotionAllowed(root,false),false);
  reduced=true;assert.equal(freshMotionAllowed(root),false);
  reduced=false;
  const studioOff={closest:()=>({className:'zdx-motion-off'})} as unknown as HTMLElement;
  assert.equal(freshMotionAllowed(studioOff),false);
  assert.equal(freshMotionAllowed(null),false);
 }finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});
