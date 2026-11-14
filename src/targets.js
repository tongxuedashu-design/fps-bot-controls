// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const {number,text}=require('./math');
// Selection hysteresis only; candidate perception and threat ranking stay with the host.
class TargetStability {
  constructor({minimumHoldSeconds=.55,closerDistanceRatio=.55}={}){
    this.minimumHoldSeconds=number(minimumHoldSeconds,'minimumHoldSeconds');
    this.closerDistanceRatio=number(closerDistanceRatio,'closerDistanceRatio',0,1,true);this.reset();
  }
  reset(){this.id=null;this.acquired=0;this.last=null;}
  select(now,candidates,preferredId){
    number(now,'time');if(!Array.isArray(candidates))throw new TypeError('Candidates required');
    const unique=new Set();
    for(const c of candidates){text(c.id,'candidate id');number(c.distance,'candidate distance');if(unique.has(c.id))throw new TypeError('Duplicate candidate');unique.add(c.id);}
    if(this.last!==null&&now<this.last)this.reset();this.last=now;
    const valid=candidates.filter(c=>c.alive===true&&c.hostile===true&&c.visible===true);
    const candidate=valid.find(c=>c.id===preferredId)??valid[0]??null,current=valid.find(c=>c.id===this.id);
    if(!candidate){this.id=null;return null;}
    if(current&&candidate.id!==current.id&&now-this.acquired<this.minimumHoldSeconds&&candidate.distance>current.distance*this.closerDistanceRatio)return current.id;
    if(candidate.id!==this.id){this.id=candidate.id;this.acquired=now;}return this.id;
  }
}
module.exports={TargetStability};
