// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const {number,integer,text,deepFreeze}=require('./math');
class DialogueControl {
  constructor({random=Math.random,probability={kill:.25,death:.2},phrases={},maximumQueue=8,
    minimumDelaySeconds=.8,maximumDelaySeconds=2,globalCooldownSeconds=3,botCooldownSeconds=45,
    eventTtlSeconds=8,openingGapSeconds=3,openingStartDelaySeconds=0}={}){
    if(typeof random!=='function')throw new TypeError('Random function required');
    integer(maximumQueue,'maximumQueue',1,1024);
    for(const [name,value] of Object.entries({minimumDelaySeconds,maximumDelaySeconds,globalCooldownSeconds,botCooldownSeconds,eventTtlSeconds,openingGapSeconds,openingStartDelaySeconds}))number(value,name);
    if(maximumDelaySeconds<minimumDelaySeconds||openingGapSeconds<=0||eventTtlSeconds<=0)throw new RangeError('Invalid dialogue timing');
    for(const value of Object.values(probability))number(value,'probability',0,1);
    for(const lines of Object.values(phrases))if(!Array.isArray(lines)||lines.some(l=>typeof l!=='string'||!l.length))throw new TypeError('Invalid phrases');
    this.options=deepFreeze({probability:structuredClone(probability),phrases:structuredClone(phrases),maximumQueue,
      minimumDelaySeconds,maximumDelaySeconds,globalCooldownSeconds,botCooldownSeconds,eventTtlSeconds,openingGapSeconds,openingStartDelaySeconds});
    this.random=random;this.serial=0;this.match=null;this.reset();
  }
  reset(){this.queue=[];this.opening=[];this.cooldown=new Map();this.events=new Map();this.recent=[];this.nextGlobal=0;this.last=null;this.round=null;}
  pruneRound(now,round){
    if(this.round!==null&&round<this.round)return false;
    this.round=round;this.queue=this.queue.filter(j=>j.expires>=now&&j.round===round);return true;
  }
  sample(){const v=this.random();if(!Number.isFinite(v)||v<0||v>=1)throw new RangeError('Random must produce [0,1)');return v;}
  startMatch(matchId,lines,now){
    text(matchId,'matchId');number(now,'time');if(this.match===matchId)return false;
    if(!Array.isArray(lines)||lines.length>this.options.maximumQueue)throw new RangeError('Opening exceeds queue bound');
    for(const l of lines){text(l.speaker,'speaker');if(typeof l.text!=='string'||!l.text.length)throw new TypeError('Invalid opening text');}
    this.reset();this.match=matchId;this.last=now;
    this.opening=lines.map((line,i)=>deepFreeze({id:'message-'+(++this.serial),matchId,speaker:line.speaker,text:line.text,
      trigger:'opening',round:null,due:now+this.options.openingStartDelaySeconds+i*this.options.openingGapSeconds}));
    return true;
  }
  offer({id,trigger,speaker,round,now}){
    const p=this.options;text(id,'event id');text(speaker,'speaker');integer(round,'round');number(now,'time');
    if(this.match===null||this.last!==null&&now<this.last||!this.pruneRound(now,round))return false;
    this.last=now;
    if(this.events.has(id))return false;
    this.events.set(id,now);while(this.events.size>512)this.events.delete(this.events.keys().next().value);
    const pool=p.phrases[trigger];
    if(!pool?.length||this.queue.length+this.opening.length>=p.maximumQueue||this.queue.some(j=>j.speaker===speaker)||
      now<(this.cooldown.get(speaker)??0)||this.sample()>=(p.probability[trigger]??0))return false;
    const fresh=pool.filter(line=>!this.recent.includes(line)),lines=fresh.length?fresh:pool;
    const message=lines[Math.floor(this.sample()*lines.length)],delay=p.minimumDelaySeconds+this.sample()*(p.maximumDelaySeconds-p.minimumDelaySeconds);
    this.queue.push(deepFreeze({id:'message-'+(++this.serial),matchId:this.match,trigger,speaker,round,text:message,due:now+delay,expires:now+p.eventTtlSeconds}));return true;
  }
  peek(now,round){
    number(now,'time');integer(round,'round');
    if(this.last!==null&&now<this.last){this.queue=[];this.opening=[];this.last=now;return null;}
    this.last=now;if(!this.pruneRound(now,round))return null;
    if(this.opening.length)return now>=this.opening[0].due&&now>=this.nextGlobal?this.opening[0]:null;
    if(now<this.nextGlobal)return null;
    return this.queue.filter(j=>j.due<=now&&now>=(this.cooldown.get(j.speaker)??0)).sort((a,b)=>a.due-b.due)[0]??null;
  }
  commit(id,now){
    number(now,'time');if(this.last!==null&&now<this.last)return false;
    const head=this.opening[0],job=head?.id===id?head:this.queue.find(j=>j.id===id);
    if(!job||now<job.due||now<this.nextGlobal||job.expires!==undefined&&now>job.expires)return false;
    if(job.trigger==='opening'){
      this.opening.shift();if(this.opening.length)this.opening=this.opening.map((j,i)=>deepFreeze({...j,due:Math.max(j.due,now+(i+1)*this.options.openingGapSeconds)}));
      this.nextGlobal=now+this.options.openingGapSeconds;
    }else{
      if(now<(this.cooldown.get(job.speaker)??0))return false;
      this.queue=this.queue.filter(j=>j.id!==id);this.cooldown.set(job.speaker,now+this.options.botCooldownSeconds);
      this.nextGlobal=now+this.options.globalCooldownSeconds;this.recent.push(job.text);if(this.recent.length>4)this.recent.shift();
    }
    this.last=now;return true;
  }
  clear(){this.queue=[];this.opening=[];}
}
module.exports={DialogueControl};
