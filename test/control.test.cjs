// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createController,BurstWindow,parameters,DEFAULT_PARAMETERS,SniperControl}=require('../src');
const {frame,evidence}=require('./helpers.cjs');

test('four profile windows run to their original deadlines and recover without counting calls',()=>{
  for(const [kind,seconds] of Object.entries({rifle:.4,smg:1,machinegun:1.5,pistol:.4})){
    const c=createController();let seq=0,last;
    for(let t=0;t<seconds-.00001;t+=.04){
      const f=frame(t,seq++,{weapon:w=>({...w,class:kind})});last=c.update(f);
      assert.equal(last.reason,'fire_window');assert.equal(last.lease.fireUntil,seconds);
      assert.equal(c.beforeDischarge(last.lease.id,f).allowed,true);
    }
    const stop=c.update(frame(seconds,seq++,{weapon:w=>({...w,class:kind})}));
    assert.equal(stop.phase,'rest');assert.equal(stop.lease,null);assert(stop.actions.some(a=>a.kind==='release'));
    const retry=c.update(frame(seconds+.16,seq++,{weapon:w=>({...w,class:kind})}));
    assert.equal(retry.phase,'rest');assert(retry.actions.some(a=>a.kind==='release'));
    const next=c.update(frame(seconds+.321,seq++,{weapon:w=>({...w,class:kind})}));
    assert.equal(next.reason,'fire_window');assert(next.lease.group>last.lease.group);
  }
});
test('each live discharge rechecks identity, mode, target, visibility, aim and host priority',()=>{
  const changes=[{identity:i=>({...i,life:'other'})},{identity:i=>({...i,world:'other'})},
    {identity:i=>({...i,weapon:'other'})},{weapon:w=>({...w,mode:'alternate'})},
    {target:t=>({...t,id:'other'})},{target:t=>({...t,hostile:false})},{target:t=>({...t,focused:false})},
    {target:t=>({...t,alive:false})},{target:t=>({...t,eyeClear:evidence(false,.01)})},
    {target:t=>({...t,muzzleClear:evidence(false,.01)})},{target:t=>({...t,aligned:evidence(false,.01)})},
    {ownership:o=>({...o,navigationPriority:true})},{ownership:o=>({...o,motion:'moving'})},
    {weapon:w=>({...w,reloading:true})},{weapon:w=>({...w,ammo:0})},{alive:false}];
  for(const change of changes){const c=createController(),r=c.update(frame());
    assert.equal(c.beforeDischarge(r.lease.id,frame(.01,1,change)).allowed,false,JSON.stringify(change));}
});
test('lease expires during a stalled update and fresh samples retain recovery',()=>{
  const c=createController(),r=c.update(frame());
  assert.equal(c.beforeDischarge(r.lease.id,frame(.181,1)).allowed,false);
  const next=c.update(frame(.2,1));assert.equal(next.phase,'rest');assert.equal(next.lease,null);
  assert.equal(c.update(frame(.3,2)).phase,'rest');
});
test('target changes end old firing but do not gift a fresh firing window',()=>{
  const c=createController();c.update(frame());
  const f=frame(.1,1,{target:t=>({...t,id:'enemy-2'})});
  const r=c.update(f);assert.equal(r.phase,'rest');assert.equal(r.lease,null);
  assert.equal(c.update(frame(.2,2)).phase,'rest');
});
test('weapon mode round-trip preserves recovery and releases held input',()=>{
  const c=createController();c.update(frame());
  const r=c.update(frame(.1,1,{weapon:w=>({...w,mode:'secondary'})}));
  assert.equal(r.reason,'unsupported_weapon_mode');assert(r.actions.some(a=>a.kind==='release'));
  assert.equal(c.update(frame(.2,2)).phase,'rest');
});
test('identity reset returns scoped cleanup and old receipts/leases never control new life',()=>{
  const c=createController(),r=c.update(frame()),old=r.actions.find(a=>a.kind==='hold');
  const f=frame(.05,1,{identity:i=>({...i,life:'life-2'}),receipts:[{id:'late',kind:'shot',commandId:old.id,identity:old.identity,time:.01,actualShots:1}]});
  const r2=c.update(f);assert(r2.actions.some(a=>a.cleanup&&a.identity.life==='life-1'));
  assert.equal(r2.metrics.shots,0);assert.equal(c.beforeDischarge(r.lease.id,f).allowed,false);
  assert.notEqual(r2.lease.id,r.lease.id);
  const cleanup=c.reset('exit');assert(cleanup.some(a=>a.kind==='release'));assert.equal(c.lease,null);
});
test('accepted calls, real shots and duplicate receipts are distinct',()=>{
  const c=createController(),r=c.update(frame()),cmd=r.actions.find(a=>a.kind==='hold');
  const base={commandId:cmd.id,identity:cmd.identity,time:.02};
  let result=c.update(frame(.04,1,{receipts:[{...base,id:'a',kind:'accepted'}]}));assert.equal(result.metrics.shots,0);
  const shot={...base,id:'s',kind:'shot',actualShots:1};
  result=c.update(frame(.08,2,{receipts:[shot,shot]}));assert.equal(result.metrics.shots,1);assert.equal(result.metrics.accepted,1);
  assert.equal(result.lease.fireUntil,1);
});
test('start retry is timed, not an assumed physical shot',()=>{
  const c=createController();assert(c.update(frame()).actions.some(a=>a.kind==='hold'));
  assert(!c.update(frame(.04,1)).actions.some(a=>a.kind==='hold'));
  assert(c.update(frame(.12,2)).actions.some(a=>a.kind==='hold'));
});
test('renewed groups count shots from a held command beyond its first sample deadline',()=>{
  const c=createController({fire:{restartRetrySeconds:2}});
  const first=c.update(frame()),hold=first.actions.find(a=>a.kind==='hold');
  let n=1;
  for(let t=.1;t<=.6;t+=.1){
    const r=c.update(frame(t,n++));assert(!r.actions.some(a=>a.kind==='hold'));
  }
  const live=frame(.61,n);assert(c.beforeDischarge(first.lease.id,live).allowed);
  const delayed={id:'late-real-shot',kind:'shot',commandId:hold.id,identity:hold.identity,time:.61,actualShots:1};
  // Deliver after the group ended, without manufacturing a new hold command.
  c.update(frame(.7,n++));c.update(frame(.8,n++));c.update(frame(.9,n++));c.update(frame(1,n++));
  const result=c.update(frame(1.04,n++,{receipts:[delayed,delayed]}));
  assert.equal(result.metrics.shots,1);assert.equal(result.phase,'rest');
  assert.equal(c.recordShot({...delayed,id:'after-window',time:1.05}),false);
});
test('one sniper authorization consumes exactly one physical shot across renewed samples',()=>{
  const c=createController({sniper:{enabled:true},fire:{restartRetrySeconds:2}});
  const sf=(t,n)=>frame(t,n,{weapon:w=>({...w,class:'sniper',scope:evidence({active:true,requiredHoldSeconds:.2,stationarySpread:true},t)})});
  c.update(sf(0,0));const first=c.update(sf(.21,1)),hold=first.actions.find(a=>a.kind==='hold');
  c.update(sf(.35,2));c.update(sf(.49,3));
  assert(c.beforeDischarge(first.lease.id,sf(.5,4)).allowed);
  const shot={id:'single',kind:'shot',commandId:hold.id,identity:hold.identity,time:.5,actualShots:1};
  assert.equal(c.recordShot({...shot,id:'bad-count',actualShots:2}),false);
  assert.equal(c.recordShot(shot),true);assert.equal(c.lease,null);
  assert.equal(c.recordShot({...shot,id:'second-terminal-call'}),false);
  assert.equal(c.metrics.shots,1);
});
test('out-of-order frames revoke leases and clock reversal creates a clean epoch',()=>{
  const c=createController();const r=c.update(frame(2,5));
  assert.equal(c.update(frame(2.01,4)).reason,'out_of_order');assert.equal(c.beforeDischarge(r.lease.id,frame(2.01,6)).allowed,false);
  const n=c.update(frame(1,0));assert(n.actions.some(a=>a.cleanup));assert.equal(n.reason,'fire_window');
});
test('invalid runtime input yields cleanup rather than throwing',()=>{
  const c=createController();c.update(frame());
  assert.doesNotThrow(()=>c.update(null));assert.equal(c.lease,null);
  const r=c.update(frame(.1,1,{weapon:null}));assert.equal(r.reason,'invalid_frame');
});
test('parameters are strict, detached and immutable; no grade selector',()=>{
  assert.throws(()=>parameters({difficulty:'hard'}));
  assert.throws(()=>parameters({fire:{windows:{smg:{fireSeconds:0}}}}));
  assert.throws(()=>parameters({aim:{trackingResponseSeconds:0}}));
  const input={fire:{windows:{smg:{fireSeconds:.8}}}};const p=parameters(input);input.fire.windows.smg.fireSeconds=2;
  assert.equal(p.fire.windows.smg.fireSeconds,.8);assert.equal(p.fire.windows.smg.restSeconds,.32);assert(Object.isFrozen(p.fire.windows));
  assert.equal(DEFAULT_PARAMETERS.aim.authority,'host');
  assert.equal(parameters({fire:{windows:{shotgun:{fireSeconds:.2,restSeconds:.5}}}}).fire.windows.shotgun.restSeconds,.5);
});
test('standalone sniper timing respects custom native scope time, loss and reload',()=>{
  const s=new SniperControl({minimumScopeHoldSeconds:.3});
  const f={now:0,identity:'one',target:'enemy',eligible:true,busy:false,reload:false,visible:true,speed:0,groundSpeed:6,stationarySpread:true,aligned:true,scope:1,nativeScopeTime:.4};
  assert.equal(s.step(f).fire,false);assert.equal(s.step({...f,now:.39}).fire,false);assert.equal(s.step({...f,now:.41}).fire,true);
  assert.equal(s.step({...f,now:.42,visible:false}).fire,false);
  assert.equal(s.step({...f,now:.7,visible:false}).release,true);
  assert.equal(s.step({...f,now:.8}).reason,'retry_backoff');
});
test('controller optional sniper uses real scope feedback before granting a lease',()=>{
  const c=createController({sniper:{enabled:true}});
  const sf=(t,n,active)=>frame(t,n,{weapon:w=>({...w,class:'sniper',scope:evidence({active,requiredHoldSeconds:.2,stationarySpread:true},t)})});
  let r=c.update(sf(0,0,false));assert.equal(r.lease,null);assert(r.actions.some(a=>a.kind==='scope-enter'));
  c.update(sf(.04,1,true));c.update(sf(.12,2,true));r=c.update(sf(.25,3,true));
  assert(r.lease?.singleShot);assert.equal(c.beforeDischarge(r.lease.id,sf(.25,3,true)).allowed,true);
});
test('raw burst preserves exact endpoint and early-stop semantics',()=>{
  const b=new BurstWindow(1,.32);b.begin(5);b.advance(5.999);assert.equal(b.phase,'fire');b.advance(6);assert.equal(b.restUntil,6.32);
  b.advance(6.32);assert.equal(b.phase,'idle');b.begin(7);b.end(7.1);assert(Math.abs(b.restUntil-7.42)<1e-10);
});
test('sniper reload passes through timing state and scoped cleanup is explicit',()=>{
  const c=createController({sniper:{enabled:true}});
  const sf=(t,n,scope,reloading=false)=>frame(t,n,{weapon:w=>({...w,class:'sniper',reloading,
    scope:evidence({active:scope,requiredHoldSeconds:.2,stationarySpread:true},t)})});
  c.update(sf(0,0,false));c.update(sf(.05,1,true));
  const r=c.update(sf(.1,2,true,true));assert.equal(r.lease,null);assert(r.actions.some(a=>a.kind==='scope-release'));
  c.update(sf(.2,3,false));const cleanup=c.reset('exit');assert(cleanup.some(a=>a.kind==='scope-release'));
});
test('live sniper discharge rechecks scope and stationary spread between updates',()=>{
  const c=createController({sniper:{enabled:true}});
  const sf=(t,n)=>frame(t,n,{weapon:w=>({...w,class:'sniper',scope:evidence({active:true,requiredHoldSeconds:.2,stationarySpread:true},t)})});
  c.update(sf(0,0));const f=sf(.21,1),r=c.update(f);assert(r.lease);
  const lost=sf(.22,2);lost.weapon.scope=evidence({active:false,requiredHoldSeconds:.2,stationarySpread:false},.22);
  assert.equal(c.beforeDischarge(r.lease.id,lost).allowed,false);
});
