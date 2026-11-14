// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {MotionControl,AimControl,createRoster,LoadoutPlanner,DeploymentControl,DialogueControl,createController}=require('../src');
const {frame,evidence}=require('./helpers.cjs');
const {ShotCadence}=require('../src');
const candidate=(time=0)=>({id:'left',side:1,destination:{x:0,y:.5,z:0},reachable:evidence(true,time,1),clear:evidence(true,time,1)});
test('motion uses reachable host candidates once per group and brakes on time or distance',()=>{
  const m=new MotionControl(),f=frame(1,1,{motionCandidates:[candidate(1)]});
  let r=m.request(f,'group',1.32);assert.equal(r.accepted,true);assert.equal(r.phase,'queued');
  assert.equal(m.request(f,'group',1.32).reason,'duplicate');m.started(f);
  r=m.status(frame(1.1,2));assert.equal(r.phase,'moving');
  r=m.status(frame(1.25,3,{self:s=>({...s,velocity:{x:1,y:0,z:0}})}));assert.equal(r.phase,'braking');
  r=m.status(frame(1.3,4));assert.equal(r.phase,'settled');assert.equal(r.ready,true);
});
test('motion expires unstarted requests and yields to navigation or target change',()=>{
  const m=new MotionControl(),f=frame(1,1,{motionCandidates:[candidate(1)]});m.request(f,1,1.32);
  assert.equal(m.status(frame(1.6,2)).reason,'move_not_started');
  m.request(frame(2,3,{motionCandidates:[candidate(2)]}),2,2.32);
  assert.equal(m.status(frame(2.01,4,{ownership:o=>({...o,navigationPriority:true})})).phase,'native_priority');
  assert.equal(m.request(frame(3,5),3,3.32).reason,'no_reachable_candidate');
});
test('controller requests post-burst motion and owns braking until settled',()=>{
  const c=createController({motion:{enabled:true},fire:{windows:{smg:{fireSeconds:.1}}}});
  c.update(frame());let r=c.update(frame(.1,1,{motionCandidates:[candidate(.1)]}));
  const move=r.actions.find(a=>a.kind==='move');assert(move);assert.equal(r.lease,null);
  const receipt={id:'movement',kind:'motion-started',commandId:move.id,identity:move.identity,time:.1};
  r=c.update(frame(.15,2,{receipts:[receipt],self:s=>({...s,velocity:{x:1,y:0,z:0}})}));assert.equal(r.motion.phase,'moving');
  r=c.update(frame(.36,3,{self:s=>({...s,velocity:{x:1,y:0,z:0}})}));assert(r.actions.some(a=>a.kind==='brake'));
  assert.equal(r.lease,null);
});
test('aim accepts generic recoil in radians; changed target resets acquisition',()=>{
  const a=new AimControl({reactionSeconds:0,settleSeconds:0});
  const s={now:0,identity:'life',targetId:'enemy',verified:true,eligible:true,muzzle:{x:0,y:0,z:0},target:{x:10,y:0,z:0},
    targetVelocity:{x:0,y:0,z:0},selfVelocity:{x:0,y:0,z:0},inputView:{pitch:0,yaw:0},recoil:{pitch:0,yaw:0},speed:0,groundSpeed:6,radius:.3,visible:true,lineClear:true};
  assert.equal(a.step(s).fire,true);const r=a.step({...s,now:.1,recoil:{pitch:.01,yaw:0}});assert(r.compensation.pitch>0);
  assert.equal(a.step({...s,now:.2,targetId:'other'}).compensation.pitch,0);
});
test('library aim requires fresh actual geometry and actual gun alignment at discharge',()=>{
  const c=createController({aim:{authority:'library',reactionSeconds:0,settleSeconds:0}});
  const r=c.update(frame());assert(r.lease);assert(r.actions.some(a=>a.kind==='aim'));
  assert.equal(c.beforeDischarge(r.lease.id,frame(.01,1,{weapon:w=>({...w,effectiveView:evidence({pitch:0,yaw:1},.01)})})).allowed,false);
  assert.equal(c.beforeDischarge(r.lease.id,frame(.01,1,{weapon:w=>({...w,spreadRadians:evidence(.5,.01)})})).allowed,false);
});
test('relative roster survives team swap; capacity includes humans',()=>{
  const opts={matchId:'m',allyCount:2,enemyCount:3,playerTeam:'blue',opponentTeam:'red',maximumPlayers:6,names:{ally:['author'],enemy:['rival']}};
  const a=createRoster(opts),b=createRoster({...opts,playerTeam:'red',opponentTeam:'blue'});
  assert.equal(a[0].name,'author');assert.equal(a[2].name,'rival');assert.deepEqual(a.map(r=>r.id),b.map(r=>r.id));
  assert.equal(b[0].team,'red');assert.throws(()=>createRoster({...opts,maximumPlayers:5}));
});
test('whole loadouts stay stable per bot and round, with explicit admission and persistence',()=>{
  const options={seed:'seed',loadouts:[{id:'a',slots:{primary:'rifle',secondary:'pistol'}},{id:'b',slots:{primary:'smg',secondary:'pistol'}}]};
  const a=new LoadoutPlanner(options),picked=a.select('match','bot',1);assert.equal(a.select('match','bot',1),picked);
  const b=new LoadoutPlanner(options);b.restore(a.snapshot());assert.deepEqual(b.select('match','bot',1),picked);
  assert.throws(()=>new LoadoutPlanner({...options,admits:(slot,item)=>item!=='smg'}));
  assert.throws(()=>b.restore({seed:'other',assignments:[]}));
});
test('deployment requires per-bot ready receipts, one create per tick and freezes until all ready',()=>{
  const d=new DeploymentControl(),rows=[{id:'a'},{id:'b'}];assert.equal(d.begin('m',rows,0).freeze,true);
  let r=d.update(0),a=r.commands[0];assert.equal(r.commands.length,1);assert.equal(r.ready,false);
  assert.equal(d.update(.01).commands.length,0);
  r=d.update(.02,[{matchId:'m',botId:'a',commandId:a.id,kind:'ready',time:.01}]);const b=r.commands[0];assert.equal(b.botId,'b');assert.equal(r.freeze,true);
  r=d.update(.03,[{matchId:'m',botId:'b',commandId:b.id,kind:'ready',time:.02}]);assert.equal(r.ready,true);assert.equal(r.freeze,false);
  assert.equal(r.commands[0].kind,'unfreeze');
});
test('deployment timeout and host failure release freeze and return cleanup',()=>{
  const d=new DeploymentControl({timeoutSeconds:1});d.begin('m',[{id:'a'}],0);const issued=d.update(0).commands[0];
  assert.equal(d.update(.1,[{matchId:'old',botId:'a',commandId:issued.id,kind:'ready',time:.1}]).ready,false);
  const r=d.update(1);assert.equal(r.phase,'failed');assert(r.commands.some(c=>c.kind==='unfreeze'));assert(r.commands.some(c=>c.kind==='remove'));
});
test('opening sequence is ordered once per match, including repeated speaker, across rounds',()=>{
  const d=new DialogueControl();const lines=[{speaker:'ally',text:'hello'},{speaker:'ally2',text:'source'},
    {speaker:'enemy',text:'welcome'},{speaker:'enemy',text:'go'}];assert(d.startMatch('m',lines,0));
  for(let i=0;i<4;i++){const job=d.peek(i*3,i);assert.equal(job.text,lines[i].text);assert(d.commit(job.id,i*3));}
  assert.equal(d.startMatch('m',lines,20),false);assert.equal(d.peek(20,10),null);
});
test('chat is bounded, delayed, deduplicated and only committed after host delivery',()=>{
  const d=new DialogueControl({random:()=>0,phrases:{kill:['one','two']},probability:{kill:1},minimumDelaySeconds:1,maximumDelaySeconds:1});
  d.startMatch('m',[],0);assert(d.offer({id:'e',trigger:'kill',speaker:'bot',round:1,now:0}));
  assert.equal(d.offer({id:'e',trigger:'kill',speaker:'bot',round:1,now:0}),false);assert.equal(d.peek(.5,1),null);
  const job=d.peek(1,1);assert(job);assert.equal(d.peek(1,1).id,job.id);assert(d.commit(job.id,1));
  assert.equal(d.offer({id:'e2',trigger:'kill',speaker:'bot',round:1,now:2}),false);
  assert.equal(d.peek(50,2),null);
});
test('count cadence samples once per group and counts only physical terminal receipts',()=>{
  let draws=0;const c=new ShotCadence({random:()=>{draws++;return 0;}});
  assert(c.allows('life/weapon',0).allowed);assert(c.allows('life/weapon',.01).allowed);assert.equal(c.snapshot().shots,0);
  c.committed({id:'one',identity:'life/weapon',time:.02});assert.equal(draws,2);
  assert.equal(c.committed({id:'one',identity:'life/weapon',time:.03}),false);
  c.committed({id:'two',identity:'life/weapon',time:.04});assert.equal(draws,2);assert.equal(c.allows('life/weapon',.1).allowed,false);
  assert(c.allows('life/weapon',.321).allowed);c.committed({id:'three',identity:'life/weapon',time:.33});assert.equal(draws,4);
});
test('count cadence has bounded bursts and identity/clock reset semantics',()=>{
  const c=new ShotCadence({minimumShots:10,maximumShots:10,maximumBurstSeconds:.2,random:()=>0});
  c.committed({id:'one',identity:'a',time:1});assert.equal(c.allows('a',1.2).allowed,false);
  assert(c.allows('b',1.21).allowed);assert.equal(c.snapshot().shots,0);
  c.committed({id:'two',identity:'b',time:2});assert(c.allows('b',1.5).allowed);
});
test('old movement receipts never start or cancel a later movement group',()=>{
  for(const kind of ['motion-started','motion-ended']){
    const c=createController({motion:{enabled:true},fire:{windows:{smg:{fireSeconds:.1}}}});
    c.update(frame());const first=c.update(frame(.1,1,{motionCandidates:[candidate(.1)]})).actions.find(a=>a.kind==='move');
    c.update(frame(.66,2));
    const secondCandidate={...candidate(.76),id:'right',side:-1};
    const second=c.update(frame(.76,3,{motionCandidates:[secondCandidate]})).actions.find(a=>a.kind==='move');
    assert(first&&second&&first.id!==second.id);
    const next=c.update(frame(.77,4,{receipts:[{id:'old-'+kind,kind,commandId:first.id,identity:first.identity,time:.11}]}));
    assert.equal(next.motion.phase,'queued');assert.equal(next.motion.candidateId,'right');
  }
});
test('movement start uses actual receipt time when delivered after its queue deadline',()=>{
  const c=createController({motion:{enabled:true},fire:{windows:{smg:{fireSeconds:.1}}}});
  c.update(frame());const move=c.update(frame(.1,1,{motionCandidates:[candidate(.1)]})).actions.find(a=>a.kind==='move');
  assert(move);
  const next=c.update(frame(.66,2,{receipts:[{id:'actual-start',kind:'motion-started',commandId:move.id,identity:move.identity,time:.64}],
    self:s=>({...s,velocity:{x:1,y:0,z:0}})}));
  assert.equal(next.motion.startedAt,.64);assert.equal(next.motion.phase,'braking');assert(next.actions.some(a=>a.kind==='brake'));
});
test('late stopped receipts from a previous group do not acknowledge the current stop',()=>{
  const c=createController({fire:{windows:{smg:{fireSeconds:.1}}}});
  c.update(frame());const first=c.update(frame(.1,1)).actions.find(a=>a.kind==='release');
  c.update(frame(.43,2));const second=c.update(frame(.54,3)).actions.find(a=>a.kind==='release');assert(first&&second);
  c.update(frame(.55,4,{receipts:[{id:'old-stop',kind:'stopped',commandId:first.id,identity:first.identity,time:.11}]}));
  const retry=c.update(frame(.7,5));assert(retry.actions.some(a=>a.kind==='release'));
  c.update(frame(.71,6,{receipts:[{id:'current-stop',kind:'stopped',commandId:second.id,identity:second.identity,time:.7}]}));
  assert(!c.update(frame(.83,7)).actions.some(a=>a.kind==='release'));
});
test('new round admission clears old chat before speaker and queue checks',()=>{
  const d=new DialogueControl({random:()=>0,probability:{kill:1},phrases:{kill:['event']},maximumQueue:1,
    minimumDelaySeconds:0,maximumDelaySeconds:0,globalCooldownSeconds:0});
  d.startMatch('match',[],0);assert(d.offer({id:'r1',trigger:'kill',speaker:'bot',round:1,now:0}));
  const old=d.peek(0,1);
  assert(d.offer({id:'r2',trigger:'kill',speaker:'bot',round:2,now:.1}));assert.equal(d.commit(old.id,.1),false);
  assert.equal(d.offer({id:'late-r1',trigger:'kill',speaker:'other',round:1,now:.2}),false);
  assert.equal(d.peek(.2,1),null);const current=d.peek(.2,2);assert.equal(current.round,2);assert(d.commit(current.id,.2));
});
test('library aiming composes with sniper timing using actual gun alignment',()=>{
  const c=createController({aim:{authority:'library',reactionSeconds:0,settleSeconds:0},sniper:{enabled:true}});
  const sf=(time,sequence,yaw)=>frame(time,sequence,{
    self:s=>({...s,inputView:evidence({pitch:0,yaw},time)}),
    weapon:w=>({...w,class:'sniper',effectiveView:evidence({pitch:0,yaw},time),
      scope:evidence({active:true,requiredHoldSeconds:.2,stationarySpread:true},time)}),
    target:t=>({...t,aligned:evidence(false,time)})});
  const acquiring=c.update(sf(0,0,.3));assert(acquiring.actions.some(a=>a.kind==='aim'));assert.equal(acquiring.lease,null);
  c.update(sf(.05,1,0));const live=sf(.21,2,0),ready=c.update(live);
  assert(ready.actions.some(a=>a.kind==='aim'));assert(ready.lease?.singleShot);
  assert(c.beforeDischarge(ready.lease.id,live).allowed);
  assert.equal(c.beforeDischarge(ready.lease.id,sf(.22,3,.3)).allowed,false);
});
test('movement command deadline never outlives its path evidence',()=>{
  const c=createController({motion:{enabled:true},fire:{windows:{smg:{fireSeconds:.1}}}});
  c.update(frame());const point={...candidate(.1),clear:evidence(true,.1,.01),reachable:evidence(true,.1,.02)};
  const issued=c.update(frame(.1,1,{motionCandidates:[point]})),move=issued.actions.find(a=>a.kind==='move');assert(move);
  assert.equal(move.validUntil,point.clear.validUntil);
  const late=c.update(frame(.12,2));assert.equal(late.motion.phase,'idle');assert.equal(late.lease,null);
});
