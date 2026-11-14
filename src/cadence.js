// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const {number,integer,text,deepFreeze}=require('./math');
// Optional count-limited groups. Host reports terminal physical emissions once.
class ShotCadence {
  constructor({minimumShots=2,maximumShots=4,maximumBurstSeconds=2.5,
    minimumRecoverySeconds=.28,maximumRecoverySeconds=.36,random=Math.random}={}){
    integer(minimumShots,'minimumShots',1);integer(maximumShots,'maximumShots',minimumShots);
    number(maximumBurstSeconds,'maximumBurstSeconds',0,2.5,true);
    number(minimumRecoverySeconds,'minimumRecoverySeconds',0,Infinity,true);
    number(maximumRecoverySeconds,'maximumRecoverySeconds',minimumRecoverySeconds);
    if(typeof random!=='function')throw new TypeError('Random function required');
    this.options=Object.freeze({minimumShots,maximumShots,maximumBurstSeconds,minimumRecoverySeconds,maximumRecoverySeconds});
    this.random=random;this.reset();
  }
  reset(){this.identity=null;this.last=null;this.phase='idle';this.shots=0;this.limit=0;this.fireUntil=0;this.recoverUntil=0;this.recovery=0;this.events=new Set();}
  sample(){const v=this.random();if(!Number.isFinite(v)||v<0||v>=1)throw new RangeError('Random must produce [0,1)');return v;}
  advance(identityValue,now){
    text(identityValue,'identity');number(now,'time');
    if(this.identity!==identityValue||this.last!==null&&now<this.last){this.reset();this.identity=identityValue;}
    this.last=now;
    if(this.phase==='fire'&&now>=this.fireUntil)this.end(now);
    if(this.phase==='rest'&&now>=this.recoverUntil){this.phase='idle';this.shots=0;}
  }
  allows(identityValue,now){
    this.advance(identityValue,now);
    return {allowed:this.phase!=='rest',reason:this.phase==='rest'?'recovery':'ready',...this.snapshot()};
  }
  committed({id,identity:identityValue,time}){
    text(id,'event id');this.advance(identityValue,time);
    if(this.events.has(id)||this.phase==='rest')return false;
    if(this.phase==='idle'){
      const p=this.options;
      this.limit=p.minimumShots+Math.floor(this.sample()*(p.maximumShots-p.minimumShots+1));
      this.recovery=p.minimumRecoverySeconds+this.sample()*(p.maximumRecoverySeconds-p.minimumRecoverySeconds);
      this.phase='fire';this.shots=0;this.fireUntil=time+p.maximumBurstSeconds;
    }
    this.events.add(id);if(this.events.size>512)this.events.delete(this.events.values().next().value);
    this.shots++;if(this.shots>=this.limit)this.end(time);return true;
  }
  end(now){
    number(now,'time');if(this.phase!=='fire')return false;
    this.phase='rest';this.recoverUntil=now+this.recovery;return true;
  }
  snapshot(){return deepFreeze({phase:this.phase,shots:this.shots,limit:this.limit,fireUntil:this.fireUntil,recoverUntil:this.recoverUntil});}
}
module.exports={ShotCadence};
