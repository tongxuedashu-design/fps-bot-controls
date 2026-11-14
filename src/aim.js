// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const {parameters}=require('./parameters');
const {clamp,wrap,vector,rotation,direction,angularError}=require('./math');
// Radians and metres. The host supplies the actual weapon recoil offset.
class AimControl {
  constructor(options={}){this.options=parameters({aim:options}).aim;this.reset();}
  reset(){this.identity=null;this.last=null;this.acquired=null;this.settled=null;
    this.comp={pitch:0,yaw:0};this.velocity={x:0,y:0,z:0};this.wasReady=false;}
  step(s){
    const p=this.options,reject=reason=>({mode:'delegate',fire:false,reason});
    if(!s||s.verified!==true||!Number.isFinite(s.now)||!vector(s.muzzle)||!vector(s.target)||
       !rotation(s.inputView)||!rotation(s.recoil)||!vector(s.targetVelocity)||!vector(s.selfVelocity)||
       ![s.speed,s.groundSpeed,s.radius].every(Number.isFinite)||s.speed<0||s.groundSpeed<=0||s.radius<=0||
       Math.abs(s.recoil.pitch)>p.maximumRecoilRadians||Math.abs(s.recoil.yaw)>p.maximumRecoilRadians||
       s.spreadRadians!==undefined&&(!Number.isFinite(s.spreadRadians)||s.spreadRadians<0)){
      this.reset();return reject('unverified_sample');
    }
    if(!s.identity||!s.targetId||!s.eligible){this.reset();return reject('native_priority');}
    const key=JSON.stringify([s.identity,s.targetId]);
    if(this.identity!==key||this.last===null||s.now<this.last||s.now-this.last>p.maximumFrameGapSeconds){
      this.reset();this.identity=key;this.last=s.now;this.acquired=s.now;this.velocity={...s.targetVelocity};}
    const dt=clamp(s.now-this.last,0,p.maximumStepSeconds);this.last=s.now;
    const lag=1-Math.exp(-dt/p.trackingResponseSeconds);
    for(const axis of ['x','y','z']){
      if(this.velocity[axis]*s.targetVelocity[axis]<0)this.velocity[axis]=0;
      this.velocity[axis]+=(s.targetVelocity[axis]-this.velocity[axis])*lag;
    }
    const distance=Math.hypot(s.target.x-s.muzzle.x,s.target.y-s.muzzle.y,s.target.z-s.muzzle.z);
    if(distance<p.minimumDistanceMeters){this.settled=null;return reject('overlap');}
    const lead={x:(this.velocity.x-s.selfVelocity.x)*p.predictionSeconds,
      y:(this.velocity.y-s.selfVelocity.y)*p.predictionSeconds,z:(this.velocity.z-s.selfVelocity.z)*p.predictionSeconds};
    const size=Math.hypot(lead.x,lead.y,lead.z),cap=s.radius*p.predictionRadiusRatio,scale=size>cap?cap/size:1;
    const predicted={x:s.target.x+lead.x*scale,y:s.target.y+lead.y*scale,z:s.target.z+lead.z*scale};
    const desired=direction(s.muzzle,predicted),alpha=1-Math.exp(-dt/p.recoilResponseSeconds);
    for(const axis of ['pitch','yaw'])this.comp[axis]+=clamp((s.recoil[axis]*p.recoilGain-this.comp[axis])*alpha,
      -p.maximumCompensationRateRadPerSecond*dt,p.maximumCompensationRateRadPerSecond*dt);
    const command={pitch:wrap(desired.pitch-this.comp.pitch),yaw:wrap(desired.yaw-this.comp.yaw)};
    const effective={pitch:wrap(s.inputView.pitch+s.recoil.pitch),yaw:wrap(s.inputView.yaw+s.recoil.yaw)};
    const angularRadius=Math.atan2(s.radius,distance),known=s.spreadRadians!==undefined;
    const tolerance=clamp(angularRadius*(known?p.knownSpreadToleranceRatio:p.unknownSpreadToleranceRatio),
      p.minimumToleranceRadians,p.maximumToleranceRadians),error=angularError(effective,desired);
    const stopSpeed=s.groundSpeed*p.stopSpeedRatio;
    const out={mode:'control',fire:false,reason:'acquiring',desiredView:desired,inputGoal:command,
      effectiveView:effective,recoil:{...s.recoil},compensation:{...this.comp},prediction:predicted,
      distance,tolerance,stopSpeed,maxTurnRate:p.maximumTurnRateRadPerSecond,turnResponse:p.trackingResponseSeconds,
      error,spreadVerified:known,spreadRadians:known?s.spreadRadians:null,yaw:command.yaw,pitch:command.pitch};
    let reason=null;
    if(!s.visible||!s.lineClear)reason='blocked';
    else if(s.reloading||s.weaponReady===false)reason='weapon_busy';
    else if(Number.isFinite(s.recoverUntil)&&s.now<s.recoverUntil)reason='recovery';
    else if(s.postBurstMoving)reason='post_burst_move';
    else if(s.speed>stopSpeed)reason='moving';
    else if(s.now-this.acquired<p.reactionSeconds)reason='acquiring';
    else if(error>tolerance)reason='tracking';
    else if(known&&s.spreadRadians+error>angularRadius*(this.wasReady?p.holdSpreadRatio:p.enterSpreadRatio))reason='spread';
    if(reason){this.settled=null;this.wasReady=false;out.reason=reason;return out;}
    if(this.settled===null)this.settled=s.now;
    if(s.now-this.settled<p.settleSeconds){out.reason='settling';return out;}
    this.wasReady=true;out.fire=true;out.reason=known?'ready':'ready_conservative';return out;
  }
}
module.exports={AimControl};
