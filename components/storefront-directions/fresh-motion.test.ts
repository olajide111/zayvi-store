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

test('produce is picked up at a readable size then dropped vertically without shrinking away',async()=>{
 const {freshDropFlight}=await import('./useFreshShoppingMotion');
 for(const viewport of [390,1440]){
  const f=freshDropFlight({left:20,top:100,width:150,height:125},{left:30,top:700,width:51,height:41},viewport);
  assert(f.width>=176);assert(f.duration>=1000);
  assert(f.frames.every(frame=>frame.opacity===1));
  const hover=f.frames.at(-2)!,drop=f.frames.at(-1)!;
  assert(hover.transform.includes('scale(0.98)'));
  assert(drop.transform.includes('scale(0.94)'));
  assert.equal(hover.clipPath,'inset(0 0 0 0)');
  assert.equal(drop.clipPath,'inset(0 0 100% 0)');
  assert.equal(hover.transform.split('px,')[0],drop.transform.split('px,')[0]);
 }
});
