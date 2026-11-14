// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
import controls = require('../..');
import type {Frame,Identity,Receipt,Vec3,Evidence,Parameters,Decision} from '../..';

const now=1;
const evidence=<T,>(value:T):Evidence<T>=>({value,sampledAt:now,validUntil:now+.18});
const position:Vec3={x:0,y:0,z:0};
const identity:Identity={world:'example',entity:'bot',life:'life-1',weapon:'smg-1'};
// Host aiming needs no target geometry, recoil model or engine angle units.
const frame:Frame={time:now,sequence:1,identity,active:true,alive:true,
  self:{position,eye:position,muzzle:position,velocity:position,walking:true,maximumGroundSpeed:6},
  weapon:{class:'smg',mode:'primary',execution:'hitscan',ready:true,reloading:false,cycleBusy:false,ammo:30},
  target:{id:'opponent',alive:true,hostile:true,focused:true,aligned:evidence(true),eyeClear:evidence(true),muzzleClear:evidence(true)},
  ownership:{nativeTaskPriority:false,navigationPriority:false,motion:'idle'}};
const c=controls.createController({fire:{windows:{smg:{fireSeconds:1}}}});
const decision:Decision=c.update(frame);
c.beforeDischarge(decision.lease?.id,frame);
for(const command of decision.actions){
  const receipt:Receipt={id:'physical-1',commandId:command.id,identity,time:now,kind:'shot',actualShots:1};
  c.recordShot(receipt);
}
c.reset('exit');
const explicit=new controls.BotController({aim:{authority:'host'}});
explicit.update(frame);
const config=controls.parameters({motion:{enabled:true}});
const original:Parameters['fire']['windows']=config.fire.windows;
void original;
// @ts-expect-error Parameters are immutable, just like their runtime value.
config.fire.sampleMaxAgeSeconds=.9;
if(controls.DEFAULT_PARAMETERS.fire.windows.smg){
  // @ts-expect-error Default nested parameters are immutable.
  controls.DEFAULT_PARAMETERS.fire.windows.smg.fireSeconds=5;
}
// @ts-expect-error No difficulty preset selector in the reusable API.
controls.createController({difficulty:'hard'});
// @ts-expect-error Execution modes have explicit allowed types.
controls.createController({fire:{eligibleModes:[{mode:'primary',execution:'laser-only'}]}});
// @ts-expect-error Every life identifies its owning weapon.
const incompleteIdentity:Identity={world:'example',entity:'bot',life:'life-1'};
void incompleteIdentity;
// @ts-expect-error Decisions are read-only runtime snapshots.
decision.metrics.shots=12;

const burst=new controls.BurstWindow(.4,.32);burst.begin(now);burst.advance(now+.4);burst.end(now+.5);burst.snapshot();burst.reset();
const cadence=new controls.ShotCadence({random:()=>.5});cadence.allows('life/weapon',now);
cadence.committed({id:'single-1',identity:'life/weapon',time:now});cadence.end(now);cadence.snapshot();cadence.reset();
const aim=new controls.AimControl({reactionSeconds:0});
aim.step({now,identity:'life/weapon',targetId:'enemy',verified:true,eligible:true,muzzle:position,target:{x:10,y:0,z:0},
  targetVelocity:position,selfVelocity:position,inputView:{pitch:0,yaw:0},recoil:{pitch:0,yaw:0},speed:0,groundSpeed:6,radius:.3,visible:true,lineClear:true});aim.reset();
const sniper=new controls.SniperControl();
sniper.step({now,identity:'life/weapon',target:'enemy',eligible:true,busy:false,reload:false,visible:true,speed:0,groundSpeed:6,
  stationarySpread:true,aligned:true,scope:1,nativeScopeTime:.2});sniper.entered(now);sniper.fired(now);sniper.release(now,'exit',false);sniper.reset();
const motion=new controls.MotionControl();motion.request(frame,1,now+.32);motion.started(frame);motion.status(frame);motion.cancel();motion.reset();
const target=new controls.TargetStability();target.select(now,[{id:'enemy',distance:10,alive:true,hostile:true,visible:true}],'enemy');target.reset();
const roster=controls.createRoster({matchId:'match',allyCount:1,enemyCount:1,playerTeam:'blue',opponentTeam:'red',maximumPlayers:3});
const planner=new controls.LoadoutPlanner({seed:'seed',loadouts:[{id:'a',slots:{primary:'smg'}}],admits:()=>true});
const selected=planner.select('match','bot',1);planner.restore(planner.snapshot());planner.clear();
// @ts-expect-error Returned equipment slots are immutable.
selected.slots.primary='another-item';
const deployment=new controls.DeploymentControl();deployment.begin('match',roster,now);deployment.update(now);deployment.cancel();deployment.reset();
deployment.begin('another-match',[{id:'minimal-row'}],now);deployment.cancel();
const dialogue=new controls.DialogueControl({phrases:{kill:['hello']},probability:{kill:1},random:()=>0});
dialogue.startMatch('match',[{speaker:'bot',text:'hello'}],now);dialogue.offer({id:'kill-1',trigger:'kill',speaker:'bot',round:1,now});
const message=dialogue.peek(now,1);if(message)dialogue.commit(message.id,now);dialogue.clear();dialogue.reset();
controls.math.direction(position,{x:1,y:0,z:0});controls.math.fresh(evidence(true),now);controls.math.identity(identity);
