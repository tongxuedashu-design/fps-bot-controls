// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const {parameters}=require('./parameters');
const {BurstWindow}=require('./burst');
const {AimControl}=require('./aim');
const {SniperControl}=require('./sniper');
const {MotionControl}=require('./motion');
const {identity,fresh,vector,rotation,speed,direction,angularError,deepFreeze}=require('./math');

function basicReason(f,p){
  if(!f||!Number.isFinite(f.time)||!Number.isSafeInteger(f.sequence)||f.sequence<0||!identity(f.identity))return 'invalid_frame';
  if(f.active!==true||f.alive!==true)return 'inactive';
  const w=f.weapon,t=f.target,o=f.ownership,s=f.self;
  if(!w||typeof w.mode!=='string'||typeof w.class!=='string'||!['hitscan','projectile','custom'].includes(w.execution)||
    typeof w.ready!=='boolean'||typeof w.reloading!=='boolean'||typeof w.cycleBusy!=='boolean'||
    !Number.isFinite(w.ammo)||w.ammo<0||!s||!vector(s.position)||!vector(s.eye)||!vector(s.muzzle)||!vector(s.velocity)||
    !Number.isFinite(s.maximumGroundSpeed)||s.maximumGroundSpeed<=0||typeof s.walking!=='boolean'||!o||
    typeof o.nativeTaskPriority!=='boolean'||typeof o.navigationPriority!=='boolean'||
    !['idle','queued','moving','braking','settled'].includes(o.motion))return 'invalid_frame';
  if(o.nativeTaskPriority||o.navigationPriority||o.threatEvasionActive)return 'native_priority';
  if(!s.walking)return 'physics';
  if(!t||typeof t.id!=='string'||!t.id||t.alive!==true||t.hostile!==true||t.focused!==true)return 'target';
  if(!w.ready||w.reloading||w.cycleBusy||w.ammo<=0)return 'weapon_busy';
  for(const name of ['eyeClear','muzzleClear'])if(!fresh(t[name],f.time,p.fire.sampleMaxAgeSeconds)||t[name].value!==true)return 'blocked_or_stale';
  return null;
}

class BotController {
  constructor(options={}){
    this.parameters=parameters(options);this.aim=new AimControl(this.parameters.aim);
    this.sniper=new SniperControl(this.parameters.sniper);this.motion=new MotionControl(this.parameters.motion);
    this.serial=0;this.groupSerial=0;this.receiptIds=new Map();this.commands=new Map();this.receiptPermits=new Map();this.pendingStopCommands=new Set();
    this.metrics={shots:0,accepted:0,rejected:0,ignoredReceipts:0,groups:0};
    this.key=null;this.id=null;this.lastTime=null;this.lastSequence=-1;this.window=null;this.profile=null;
    this.lease=null;this.groupTarget=null;this.nextStart=0;this.nextStop=0;this.stopPending=false;this.startOwned=false;
    this.scopeOwned=false;
    this.sampleUntil=0;this.groupStartedAt=0;
  }
  command(kind,time,identityValue=this.id,extra={}){
    const cmd=deepFreeze({id:'command-'+(++this.serial),kind,identity:{...identityValue},time,...extra});
    this.commands.set(cmd.id,cmd);if(kind==='release'&&this.stopPending)this.pendingStopCommands.add(cmd.id);
    while(this.commands.size>256){const oldest=this.commands.keys().next().value;this.commands.delete(oldest);this.pendingStopCommands.delete(oldest);}
    return cmd;
  }
  reset(reason='reset'){
    const cleanup=this.id?[this.command('release',this.lastTime??0,this.id,{reason,cleanup:true}),
      this.command('delegate',this.lastTime??0,this.id,{reason,cleanup:true})]:[];
    if(this.id&&this.scopeOwned)cleanup.push(this.command('scope-release',this.lastTime??0,this.id,{reason,cleanup:true}));
    this.key=null;this.id=null;this.lastTime=null;this.lastSequence=-1;this.window=null;this.profile=null;
    this.lease=null;this.groupTarget=null;this.nextStart=this.nextStop=0;this.stopPending=this.startOwned=false;
    this.scopeOwned=false;
    this.sampleUntil=0;this.groupStartedAt=0;
    this.aim.reset();this.sniper.reset();this.motion.reset();this.commands.clear();this.receiptIds.clear();this.receiptPermits.clear();this.pendingStopCommands.clear();
    return cleanup;
  }
  revokePermit(time){
    const permit=this.lease&&this.receiptPermits.get(this.lease.id);
    if(permit)permit.validUntil=Math.min(permit.validUntil,time);
  }
  receipts(rows,frame){
    for(const r of Array.isArray(rows)?rows:[]){
      const cmd=r&&this.commands.get(r.commandId);
      if(!r||typeof r.id!=='string'||!r.id||this.receiptIds.has(r.id)||!cmd||identity(r.identity)!==this.key||
        !Number.isFinite(r.time)||r.time<cmd.time||r.time>frame.time){this.metrics.ignoredReceipts++;continue;}
      this.receiptIds.set(r.id,r.time);while(this.receiptIds.size>512)this.receiptIds.delete(this.receiptIds.keys().next().value);
      if(r.kind==='accepted')this.metrics.accepted++;
      else if(r.kind==='rejected')this.metrics.rejected++;
      else if(r.kind==='stopped'&&cmd.kind==='release'&&this.pendingStopCommands.has(cmd.id)){this.stopPending=false;this.pendingStopCommands.clear();}
      else if(r.kind==='motion-started'&&cmd.kind==='move'&&cmd.group===this.motion.current?.group)this.motion.started({...frame,time:r.time});
      else if(r.kind==='motion-ended'&&cmd.kind==='move'&&cmd.group===this.motion.current?.group)this.motion.cancel('completed');
      else if(r.kind==='shot'&&cmd.kind==='hold'&&Number.isSafeInteger(r.actualShots)&&r.actualShots>0&&cmd.lease){
        const permit=this.receiptPermits.get(cmd.lease.id);
        if(!permit||permit.consumed||r.time<permit.startedAt||r.time>=permit.fireUntil||r.time>permit.validUntil||
          permit.singleShot&&r.actualShots!==1){this.metrics.ignoredReceipts++;continue;}
        this.metrics.shots+=r.actualShots;
        if(permit.singleShot){permit.consumed=true;
          if(this.lease?.id===cmd.lease.id){this.sniper.fired(r.time);this.lease=null;this.startOwned=false;}}
      }
    }
  }
  isSupported(frame){return this.parameters.fire.eligibleModes.some(m=>m.mode===frame.weapon.mode&&m.execution===frame.weapon.execution);}
  libraryAimReason(frame){
    const p=this.parameters,s=frame.self,w=frame.weapon,t=frame.target,now=frame.time;
    if(!s||!w||!t||!vector(s.muzzle)||!fresh(w.effectiveView,now,p.fire.sampleMaxAgeSeconds)||!rotation(w.effectiveView.value)||
      !fresh(t.position,now,p.fire.sampleMaxAgeSeconds)||!vector(t.position.value)||!Number.isFinite(t.radius)||t.radius<=0)return 'stale_aim';
    const desired=direction(s.muzzle,t.position.value),radius=Math.atan2(t.radius,Math.hypot(t.position.value.x-s.muzzle.x,t.position.value.y-s.muzzle.y,t.position.value.z-s.muzzle.z));
    if(!Number.isFinite(radius)||radius<=0||angularError(w.effectiveView.value,desired)>Math.min(p.aim.maximumToleranceRadians,radius*p.aim.knownSpreadToleranceRatio))return 'tracking';
    if(w.spreadRadians!==undefined&&(!fresh(w.spreadRadians,now,p.fire.sampleMaxAgeSeconds)||
      !Number.isFinite(w.spreadRadians.value)||w.spreadRadians.value<0||w.spreadRadians.value+angularError(w.effectiveView.value,desired)>radius*p.aim.holdSpreadRatio))return 'spread';
    return null;
  }
  sniperSample(frame,eligible){
    const age=this.parameters.fire.sampleMaxAgeSeconds,now=frame.time,scope=frame.weapon?.scope,t=frame.target;
    const scopeValid=fresh(scope,now,age)&&scope.value&&typeof scope.value.active==='boolean'&&
      typeof scope.value.stationarySpread==='boolean'&&Number.isFinite(scope.value.requiredHoldSeconds)&&scope.value.requiredHoldSeconds>=0;
    return {now,identity:this.key,target:t?.id,eligible:eligible&&!!scopeValid,
      busy:frame.weapon?.cycleBusy||frame.weapon?.reloading||!frame.weapon?.ready,reload:frame.weapon?.reloading,
      visible:['eyeClear','muzzleClear'].every(k=>fresh(t?.[k],now,age)&&t[k].value===true),
      speed:vector(frame.self?.velocity)?speed(frame.self.velocity):Infinity,groundSpeed:frame.self?.maximumGroundSpeed,
      stationarySpread:scopeValid&&scope.value.stationarySpread,
      aligned:this.parameters.aim.authority==='library'?this.libraryAimReason(frame)===null:fresh(t?.aligned,now,age)&&t.aligned.value===true,
      scope:scopeValid&&scope.value.active?1:0,
      nativeScopeTime:scopeValid?scope.value.requiredHoldSeconds:NaN};
  }
  endGroup(frame,actions){
    if(this.window?.end(frame.time))this.groupEnded(frame,actions);
    else if(this.lease){this.revokePermit(frame.time);this.lease=null;this.stopPending=true;this.pendingStopCommands.clear();actions.push(this.command('release',frame.time));this.nextStop=frame.time+this.parameters.fire.stopRetrySeconds;}
  }
  groupEnded(frame,actions){
    this.revokePermit(frame.time);this.lease=null;this.stopPending=true;this.startOwned=false;this.pendingStopCommands.clear();
    actions.push(this.command('release',frame.time));this.nextStop=frame.time+this.parameters.fire.stopRetrySeconds;
    if(this.parameters.motion.enabled&&frame.target?.id===this.groupTarget&&!basicReason(frame,this.parameters)&&
      JSON.stringify([frame.weapon.class,frame.weapon.mode,frame.weapon.execution])===this.profile){
      const request=this.motion.request(frame,this.groupSerial,this.window.restUntil);
      if(request.accepted)actions.push(this.command('move',frame.time,this.id,{candidateId:request.candidateId,
        group:this.groupSerial,validUntil:request.deadline}));
    }
  }
  update(frame){
    const actions=[],now=frame?.time,key=identity(frame?.identity),p=this.parameters;
    const output=(reason,aim=null)=>deepFreeze({sequence:frame?.sequence??-1,identity:this.id?{...this.id}:null,
      time:Number.isFinite(now)?now:0,reason,actions,aim,lease:this.lease?{...this.lease}:null,
      phase:this.window?.phase??'idle',motion:this.id?this.motion.status(frame):{phase:'idle',ready:true,hold:false},metrics:{...this.metrics}});
    if(!Number.isFinite(now)||!key||!Number.isSafeInteger(frame.sequence)||frame.sequence<0){actions.push(...this.reset('invalid_frame'));return output('invalid_frame');}
    if(this.key!==key||this.lastTime!==null&&now<this.lastTime){actions.push(...this.reset(this.key===key?'clock_reversal':'identity_change'));this.key=key;this.id={...frame.identity};}
    if(frame.sequence<=this.lastSequence){this.revokePermit(now);this.lease=null;actions.push(this.command('release',now));return output('out_of_order');}
    this.lastSequence=frame.sequence;this.lastTime=now;this.receipts(frame.receipts,frame);
    if(this.window?.phase==='fire'&&now>this.sampleUntil)this.endGroup(frame,actions);
    let reason=basicReason(frame,p);
    const supported=frame.weapon&&this.isSupported(frame);
    const isSniper=frame.weapon?.class==='sniper'&&p.sniper.enabled;
    const window=p.fire.windows[frame.weapon?.class];
    if(!reason&&(!supported||!window&&!isSniper))reason='unsupported_weapon_mode';
    const profile=frame.weapon?JSON.stringify([frame.weapon.class,frame.weapon.mode,frame.weapon.execution]):null;
    if(this.profile!==profile){
      if(this.profile!==null){this.endGroup(frame,actions);this.lease=null;this.aim.reset();this.sniper.reset();this.motion.cancel('mode_change');}
      this.profile=profile;
      // Mode changes retain the old recovery deadline rather than granting a new burst.
      const oldRest=this.window?.phase==='rest'?this.window.restUntil:0;
      this.window=window?new BurstWindow(window.fireSeconds,window.restSeconds):null;
      if(this.window&&oldRest>now){this.window.phase='rest';this.window.restUntil=oldRest;}
    }
    if(this.window?.advance(now))this.groupEnded(frame,actions);
    if(this.window?.phase==='fire'&&frame.target?.id!==this.groupTarget)this.endGroup(frame,actions);
    if(reason){
      this.endGroup(frame,actions);this.lease=null;this.aim.reset();this.motion.cancel(reason);
      if(isSniper){
        const eligible=['weapon_busy','blocked_or_stale'].includes(reason)&&frame.alive&&frame.active&&
          frame.target?.alive&&frame.target?.hostile&&frame.target?.focused;
        const result=this.sniper.step(this.sniperSample(frame,eligible));
        if(result.release&&this.scopeOwned){actions.push(this.command('scope-release',now));this.scopeOwned=false;}
      }else if(this.scopeOwned){actions.push(this.command('scope-release',now));this.scopeOwned=false;this.sniper.reset();}
      if(this.stopPending&&now>=this.nextStop){actions.push(this.command('release',now));this.nextStop=now+p.fire.stopRetrySeconds;}
      actions.push(this.command('delegate',now,this.id,{reason}));return output(reason);
    }
    const motion=this.motion.status(frame);
    if(motion.hold)actions.push(this.command('brake',now));
    const moving=['queued','moving','braking'].includes(motion.phase)||['queued','moving','braking'].includes(frame.ownership.motion);
    let aim=null,ready=!moving;
    if(isSniper){
      const s=this.sniper.step(this.sniperSample(frame,true));
      ready=ready&&s.fire;if(s.brake)actions.push(this.command('brake',now));
      if(s.enter){actions.push(this.command('scope-enter',now));this.scopeOwned=true;}
      if(s.release&&this.scopeOwned){actions.push(this.command('scope-release',now));this.scopeOwned=false;}
      if(!ready)reason=s.reason;
    }
    if(p.aim.authority==='library'){
      const t=frame.target,w=frame.weapon,s=frame.self;
      const samples=[t.position,t.velocity,s.inputView,w.recoilOffset];
      const valid=samples.every(e=>fresh(e,now,p.fire.sampleMaxAgeSeconds));
      const spread=fresh(w.spreadRadians,now,p.fire.sampleMaxAgeSeconds)?w.spreadRadians.value:undefined;
      aim=this.aim.step({now,identity:key,targetId:t.id,verified:valid,eligible:true,
        muzzle:s.muzzle,target:t.position?.value,targetVelocity:t.velocity?.value,selfVelocity:s.velocity,
        inputView:s.inputView?.value,recoil:w.recoilOffset?.value,speed:speed(s.velocity),groundSpeed:s.maximumGroundSpeed,
        radius:t.radius,spreadRadians:spread,visible:true,lineClear:true,reloading:false,weaponReady:true,
        recoverUntil:this.window?.restUntil,postBurstMoving:moving});
      ready=ready&&aim.fire;
      if(aim.mode==='control')actions.push(this.command('aim',now,this.id,{goal:aim.inputGoal,maximumTurnRateRadPerSecond:aim.maxTurnRate}));
      if(!aim.fire)reason=aim.reason;
    }
    if(!ready){
      const temporary=aim?.mode==='control'&&['tracking','settling'].includes(aim.reason)&&!moving;
      if(temporary&&this.window?.phase==='fire'){
        this.sampleUntil=now+p.fire.sampleMaxAgeSeconds;this.revokePermit(now);this.lease=null;
        if(this.startOwned){actions.push(this.command('release',now));this.startOwned=false;}
      }else this.endGroup(frame,actions);
      return output(reason||(moving?'post_burst_move':'waiting'),aim);
    }
    if(this.window?.begin(now)||isSniper&&!this.lease){this.groupSerial++;this.groupTarget=frame.target.id;
      this.metrics.groups++;this.nextStart=now;this.stopPending=false;this.pendingStopCommands.clear();this.groupStartedAt=now;}
    const fireUntil=isSniper?now+p.fire.sampleMaxAgeSeconds:this.window?.fireUntil;
    if(isSniper||this.window?.phase==='fire'){
      const validUntil=Math.min(fireUntil,now+p.fire.sampleMaxAgeSeconds,frame.target.eyeClear.validUntil,frame.target.muzzleClear.validUntil);
      this.sampleUntil=validUntil;
      this.lease=deepFreeze({id:'lease-'+this.groupSerial,identity:{...this.id},target:frame.target.id,
        mode:frame.weapon.mode,execution:frame.weapon.execution,weaponClass:frame.weapon.class,
        group:this.groupSerial,startedAt:this.groupStartedAt,fireUntil,validUntil,singleShot:isSniper});
      // A hold command can outlive its immutable first sample. Count emissions
      // against the group's refreshed authority, including delayed receipts.
      this.receiptPermits.set(this.lease.id,{...this.lease,consumed:false});
      while(this.receiptPermits.size>256)this.receiptPermits.delete(this.receiptPermits.keys().next().value);
      if(now>=this.nextStart){actions.push(this.command('hold',now,this.id,{lease:this.lease}));
        this.nextStart=now+p.fire.restartRetrySeconds;this.startOwned=true;}
      return output('fire_window',aim);
    }
    this.lease=null;
    if(this.stopPending&&now>=this.nextStop){actions.push(this.command('release',now));this.nextStop=now+p.fire.stopRetrySeconds;}
    return output('recovery',aim);
  }
  beforeDischarge(leaseId,frame){
    const l=this.lease,p=this.parameters,deny=reason=>({allowed:false,reason});
    if(!l||l.id!==leaseId)return deny('no_current_lease');
    if(identity(frame?.identity)!==this.key||!Number.isFinite(frame.time)||frame.time<this.lastTime||
      frame.time<l.startedAt||frame.time>=l.fireUntil||frame.time>l.validUntil||frame.sequence<this.lastSequence)return deny('expired_or_wrong_life');
    const reason=basicReason(frame,p);if(reason)return deny(reason);
    if(frame.target.id!==l.target||frame.weapon.mode!==l.mode||frame.weapon.execution!==l.execution||
      frame.weapon.class!==l.weaponClass)return deny('changed_target_or_mode');
    if(['queued','moving','braking'].includes(frame.ownership.motion)||!this.motion.status(frame).ready)return deny('post_burst_move');
    if(l.singleShot){
      const scope=frame.weapon.scope;
      if(!fresh(scope,frame.time,p.fire.sampleMaxAgeSeconds)||scope.value?.active!==true||scope.value?.stationarySpread!==true||
        speed(frame.self.velocity)>frame.self.maximumGroundSpeed*p.sniper.stopSpeedRatio)return deny('scope_or_stability');
    }
    if(p.aim.authority==='library'){
      const aimReason=this.libraryAimReason(frame);if(aimReason)return deny(aimReason);
    }else if(!fresh(frame.target.aligned,frame.time,p.fire.sampleMaxAgeSeconds)||frame.target.aligned.value!==true)return deny('host_aim_permission');
    return {allowed:true,reason:'per_discharge_verified',lease:l};
  }
  recordShot(receipt){
    if(!receipt||receipt.kind!=='shot'||!Number.isFinite(receipt.time)||this.lastTime===null||receipt.time<this.lastTime)return false;
    const before=this.metrics.shots;
    this.receipts([receipt],{time:receipt.time});
    return this.metrics.shots>before;
  }
}
function createController(options){return new BotController(options);}
module.exports={BotController,createController};
