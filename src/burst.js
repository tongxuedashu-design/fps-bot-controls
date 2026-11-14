// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const {number}=require('./math');
// Extracted timing semantics: counts and accepted calls never extend a window.
class BurstWindow {
  constructor(fireSeconds=.4,restSeconds=.32) {
    this.fireSeconds=number(fireSeconds,'fireSeconds',0,2.5,true);
    this.restSeconds=number(restSeconds,'restSeconds',0,2.5,true);
    this.reset();
  }
  reset(){this.phase='idle';this.fireUntil=0;this.restUntil=0;this.last=null;}
  advance(now){
    if(!Number.isFinite(now))return false;
    if(this.last!==null&&now<this.last){const active=this.phase==='fire';this.reset();this.last=now;return active;}
    this.last=now;
    if(this.phase==='fire'&&now>=this.fireUntil)return this.end(now);
    if(this.phase==='rest'&&now>=this.restUntil){this.phase='idle';this.restUntil=0;}
    return false;
  }
  begin(now){
    if(!Number.isFinite(now)||this.phase!=='idle')return false;
    this.phase='fire';this.fireUntil=now+this.fireSeconds;this.restUntil=0;this.last=now;return true;
  }
  end(now){
    if(!Number.isFinite(now)||this.phase!=='fire')return false;
    this.phase='rest';this.restUntil=now+this.restSeconds;this.last=now;return true;
  }
  snapshot(){return {phase:this.phase,fireUntil:this.fireUntil,restUntil:this.restUntil};}
}
module.exports={BurstWindow};
