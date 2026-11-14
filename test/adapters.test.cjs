// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {run}=require('../examples/minimal-host.cjs');
const {MetersRadiansHost,CentimetersDegreesHost}=require('../examples/adapters.cjs');
const {createController,TargetStability}=require('../src');
const {frame,evidence}=require('./helpers.cjs');
test('two host conventions execute the same controls, actual host shots and cleanup',()=>{
  const a=run(MetersRadiansHost),b=run(CentimetersDegreesHost);assert.deepEqual(a,b);assert(a.shots>0);
});
test('actual weapon loop honours lease expiration even when controller update stalls',()=>{
  const host=new MetersRadiansHost(),c=createController(),f=host.frame(0,0);host.apply(c.update(f),f);
  for(let i=0;i<100;i++)host.tick(c,i/100,i);
  assert(host.shots<=3);assert.equal(c.metrics.shots,host.shots);host.close(c);
});
test('native weapon cooldown remains under host control',()=>{
  const a=new MetersRadiansHost(),b=new MetersRadiansHost();b.interval=.2;
  for(const host of [a,b]){const c=createController();for(let i=0;i<100;i++){
    const t=i/100;if(i%4===0){const f=host.frame(t,i);host.apply(c.update(f),f);}host.tick(c,t,i);}}
  assert(a.shots>b.shots);
});
test('sniper immediate physical-shot feedback consumes a single-shot lease',()=>{
  const c=createController({sniper:{enabled:true}});
  const sf=(t,n)=>frame(t,n,{weapon:w=>({...w,class:'sniper',scope:evidence({active:true,requiredHoldSeconds:.2,stationarySpread:true},t)})});
  c.update(sf(0,0));const f=sf(.21,1),r=c.update(f),cmd=r.actions.find(a=>a.kind==='hold');
  assert(cmd);assert(c.beforeDischarge(r.lease.id,f).allowed);
  assert(c.recordShot({id:'one',kind:'shot',commandId:cmd.id,identity:cmd.identity,time:.21,actualShots:1}));
  assert.equal(c.beforeDischarge(r.lease.id,f).allowed,false);
});
test('stable target retains recent valid target but yields to a much closer threat',()=>{
  const t=new TargetStability(),candidate=(id,distance)=>({id,distance,alive:true,hostile:true,visible:true});
  t.select(0,[candidate('a',10)],'a');
  assert.equal(t.select(.1,[candidate('a',10),candidate('b',8)],'b'),'a');
  assert.equal(t.select(.2,[candidate('a',10),candidate('b',4)],'b'),'b');
  assert.equal(t.select(.3,[candidate('a',10)],'a'),'a');
});
