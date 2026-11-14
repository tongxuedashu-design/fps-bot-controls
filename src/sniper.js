// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const {parameters}=require('./parameters');
class SniperControl {
  constructor(options={}){this.options=parameters({sniper:options}).sniper;this.reset();}
  reset(){this.identity=null;this.phase='native';this.started=null;this.scoped=null;
    this.settled=null;this.hidden=null;this.backoff=0;this.last=null;this.target=null;}
  release(now,reason,retry){
    this.phase='native';this.started=this.scoped=this.settled=this.hidden=null;
    if(retry)this.backoff=now+this.options.retryBackoffSeconds;
    return {control:false,fire:false,release:true,reason};
  }
  entered(now){this.scoped=now;this.phase='scope_wait';}
  fired(now){this.phase='recover';this.started=this.scoped=this.settled=null;this.last=now;}
  step(s){
    const p=this.options;
    if(!Number.isFinite(s.now))return this.release(0,'invalid_time',false);
    if(this.identity!==s.identity||this.last!==null&&s.now<this.last){this.reset();this.identity=s.identity;}
    this.last=s.now;
    if(!s.eligible)return this.release(s.now,'identity_or_priority',false);
    if(s.now<this.backoff)return {control:false,fire:false,release:true,reason:'retry_backoff'};
    if(s.busy){this.phase='recover';this.started=this.settled=null;
      return {control:true,fire:false,release:s.reload,brake:false,reason:'native_weapon_cycle'};}
    if(this.target!==s.target){this.target=s.target;this.settled=null;}
    if(!s.visible){this.settled=null;if(this.hidden===null)this.hidden=s.now;
      if(s.now-this.hidden>=p.lostSightGraceSeconds)return this.release(s.now,'lost_sight',true);
      return {control:true,fire:false,brake:false,reason:'occluded'};}
    this.hidden=null;if(this.started===null)this.started=s.now;
    if(s.now-this.started>=p.acquireTimeoutSeconds)return this.release(s.now,'acquire_timeout',true);
    const stopped=[s.speed,s.groundSpeed].every(Number.isFinite)&&s.groundSpeed>0&&
      s.speed<=s.groundSpeed*p.stopSpeedRatio&&s.stationarySpread;
    if(!stopped||!s.aligned)this.settled=null;else if(this.settled===null)this.settled=s.now;
    if(s.scope!==1){this.scoped=null;this.phase='acquire';
      return {control:true,fire:false,brake:true,enter:stopped,reason:stopped?'enter_scope':'settle'};}
    if(this.scoped===null)this.entered(s.now);
    const hold=Math.max(p.minimumScopeHoldSeconds,s.nativeScopeTime);
    const ready=Number.isFinite(hold)&&hold>=0&&s.now-this.scoped>=hold&&
      this.settled!==null&&s.now-this.settled>=p.settleSeconds&&stopped&&s.aligned;
    if(ready){this.phase='ready';this.started=s.now;}
    return {control:true,fire:ready,brake:true,reason:ready?'scoped_ready':'scope_wait'};
  }
}
module.exports={SniperControl};
