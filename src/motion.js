// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const {parameters}=require('./parameters');
const {identity,fresh,vector,speed,clamp}=require('./math');
class MotionControl {
  constructor(options={}){this.options=parameters({motion:options}).motion;this.reset();}
  reset(){this.current=null;this.key=null;this.lastGroup=null;this.lastStart=-Infinity;this.lastTime=null;this.side=1;}
  cancel(reason='cancelled'){this.current=null;return {phase:'idle',ready:true,hold:false,reason};}
  request(frame,group,recoveryUntil){
    const p=this.options,key=identity(frame.identity),now=frame.time;
    if(!['string','number'].includes(typeof group)||typeof group==='number'&&!Number.isFinite(group)||String(group).length>128)
      return {accepted:false,reason:'invalid_group'};
    if(!key||!Number.isFinite(now)||!frame.target||!vector(frame.self?.position))return {accepted:false,reason:'invalid_sample'};
    if(this.key!==key||this.lastTime!==null&&now<this.lastTime){this.reset();this.key=key;}
    this.lastTime=now;
    const token=JSON.stringify([key,group]);
    if(this.lastGroup===token)return {accepted:false,reason:'duplicate'};
    if(frame.ownership?.nativeTaskPriority||frame.ownership?.navigationPriority||frame.ownership?.threatEvasionActive)
      return {accepted:false,reason:'native_priority'};
    const old=this.status(frame);
    if(['queued','moving','braking'].includes(old.phase))return {accepted:false,reason:'movement_busy'};
    if(now-this.lastStart<p.nativeEvasionCooldownSeconds)return {accepted:false,reason:'native_evasion_busy'};
    const candidate=(frame.motionCandidates||[]).find(c=>typeof c.id==='string'&&vector(c.destination)&&
      (c.side===this.side||c.side===undefined)&&fresh(c.reachable,now)&&c.reachable.value===true&&fresh(c.clear,now)&&c.clear.value===true);
    if(!candidate)return {accepted:false,reason:'no_reachable_candidate'};
    this.current={group,target:frame.target.id,candidate:structuredClone(candidate),origin:{...frame.self.position},
      phase:'queued',startedAt:null,brakeAt:now+clamp(Number.isFinite(recoveryUntil)?recoveryUntil-now-p.recoveryLeadSeconds:p.fallbackBrakeDelaySeconds,
        p.minimumBrakeDelaySeconds,p.maximumBrakeDelaySeconds),
      deadline:Math.min(now+p.queueTimeoutSeconds,candidate.reachable.validUntil,candidate.clear.validUntil)};
    this.lastGroup=token;this.side=-this.side;
    return {accepted:true,...this.status(frame)};
  }
  started(frame){
    if(this.current&&this.current.phase==='queued'&&identity(frame.identity)===this.key&&frame.time<=this.current.deadline){
      this.current.phase='moving';this.current.startedAt=frame.time;this.lastStart=frame.time;
    }
  }
  status(frame){
    const now=frame.time,key=identity(frame.identity),m=this.current,p=this.options;
    if(!key||!Number.isFinite(now))return {phase:'native_priority',ready:false,hold:false,reason:'invalid_sample'};
    if(this.key&&this.key!==key||this.lastTime!==null&&now<this.lastTime){this.reset();this.key=key;}
    this.lastTime=now;
    if(frame.ownership?.nativeTaskPriority||frame.ownership?.navigationPriority||frame.ownership?.threatEvasionActive||!frame.active){
      this.current=null;return {phase:'native_priority',ready:false,hold:false,reason:'native_priority'};}
    if(!this.current)return {phase:'idle',ready:true,hold:false};
    if(this.current!==m)return {phase:'idle',ready:true,hold:false};
    if(!frame.target||frame.target.id!==m.target||frame.target.alive!==true||frame.target.hostile!==true)
      return this.cancel('target');
    if(!vector(frame.self?.position)||!vector(frame.self?.velocity))return this.cancel('invalid_geometry');
    const distance=Math.hypot(frame.self.position.x-m.origin.x,frame.self.position.y-m.origin.y),v=speed(frame.self.velocity);
    if(m.phase==='queued'&&now>m.deadline)return this.cancel('move_not_started');
    if(m.phase==='queued'&&(!fresh(m.candidate.clear,now)||!fresh(m.candidate.reachable,now)))return this.cancel('candidate_expired');
    if(m.phase==='moving'&&(now>=m.brakeAt||distance>=p.maximumDistanceMeters))m.phase='braking';
    if(['braking','settled'].includes(m.phase)&&v<=p.settledSpeedMetersPerSecond)m.phase='settled';
    else if(m.phase==='settled')m.phase='braking';
    return {phase:m.phase,ready:m.phase==='settled',hold:['braking','settled'].includes(m.phase),
      group:m.group,candidateId:m.candidate.id,startedAt:m.startedAt,brakeAt:m.brakeAt,deadline:m.deadline,distance,speed:v};
  }
}
module.exports={MotionControl};
