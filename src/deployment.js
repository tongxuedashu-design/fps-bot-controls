// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const {number,integer,text,deepFreeze}=require('./math');
// Host executes commands and acknowledges create/equip separately from readiness.
class DeploymentControl {
  constructor({maximumInFlight=1,maximumCreatesPerTick=1,timeoutSeconds=30}={}){
    this.maximumInFlight=integer(maximumInFlight,'maximumInFlight',1,256);
    this.maximumCreatesPerTick=integer(maximumCreatesPerTick,'maximumCreatesPerTick',1,256);
    this.timeoutSeconds=number(timeoutSeconds,'timeoutSeconds',0,Infinity,true);
    this.serial=0;this.reset();
  }
  reset(){this.match=null;this.rows=[];this.started=null;this.last=null;this.phase='idle';this.deadline=0;this.records=new Map();}
  begin(matchId,rows,now){
    text(matchId,'matchId');number(now,'time');
    if(!['idle','failed'].includes(this.phase))throw new Error('Cancel the existing deployment before beginning another');
    if(!Array.isArray(rows)||rows.length>256||new Set(rows.map(r=>r.id)).size!==rows.length)throw new TypeError('Invalid roster');
    for(const row of rows)text(row.id,'roster id');
    this.reset();this.match=matchId;this.rows=structuredClone(rows);this.started=this.last=now;this.deadline=now+this.timeoutSeconds;
    this.phase=rows.length?'loading':'ready';
    return this.state([]);
  }
  state(commands){return deepFreeze({matchId:this.match,phase:this.phase,freeze:this.phase==='loading',
    ready:this.phase==='ready',commands,completed:[...this.records.values()].filter(r=>r.status==='ready').length,total:this.rows.length});}
  update(now,receipts=[]){
    number(now,'time');if(this.phase!=='loading')return this.state([]);
    const commands=[];
    if(now<this.last||now>=this.deadline){this.phase='failed';
      for(const row of this.records.values())commands.push({id:'deployment-'+(++this.serial),kind:'remove',matchId:this.match,botId:row.row.id});
      commands.push({id:'deployment-'+(++this.serial),kind:'unfreeze',matchId:this.match,reason:now<this.last?'clock_reversal':'timeout'});
      return this.state(commands);}
    this.last=now;
    for(const receipt of receipts){
      if(!receipt||receipt.matchId!==this.match||!Number.isFinite(receipt.time)||receipt.time>now)continue;
      const r=this.records.get(receipt.botId);
      if(!r||receipt.commandId!==r.commandId||receipt.time<r.issuedAt||r.status==='ready')continue;
      if(receipt.kind==='ready'){r.status='ready';}
      else if(receipt.kind==='failed'){
        this.phase='failed';for(const row of this.records.values())commands.push({id:'deployment-'+(++this.serial),kind:'remove',matchId:this.match,botId:row.row.id});
        commands.push({id:'deployment-'+(++this.serial),kind:'unfreeze',matchId:this.match,reason:'host_creation_failed'});
        return this.state(commands);
      }
    }
    const active=[...this.records.values()].filter(r=>r.status==='pending').length;
    let budget=Math.min(this.maximumCreatesPerTick,this.maximumInFlight-active);
    for(const row of this.rows){
      if(budget<=0)break;if(this.records.has(row.id))continue;
      const command={id:'deployment-'+(++this.serial),kind:'create-and-equip',matchId:this.match,botId:row.id,roster:row};
      this.records.set(row.id,{row,status:'pending',commandId:command.id,issuedAt:now});commands.push(command);budget--;
    }
    if(this.records.size===this.rows.length&&[...this.records.values()].every(r=>r.status==='ready')){
      this.phase='ready';commands.push({id:'deployment-'+(++this.serial),kind:'unfreeze',matchId:this.match,reason:'all_ready'});}
    return this.state(commands);
  }
  cancel(){
    const commands=[...this.records.values()].map(r=>({id:'deployment-'+(++this.serial),kind:'remove',matchId:this.match,botId:r.row.id}));
    if(this.match)commands.push({id:'deployment-'+(++this.serial),kind:'unfreeze',matchId:this.match,reason:'cancelled'});
    this.reset();return commands;
  }
}
module.exports={DeploymentControl};
